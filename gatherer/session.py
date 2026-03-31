"""
Session state collector + .f1tel file writer.
"""

import gzip
import json
import logging
import re
import struct
import threading
import zlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from packets import (
    SessionData, LapData, CarTelemetry, CarStatus, CarDamage,
    ParticipantData, SessionHistory, LapRecord, TyreStint,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# .f1tel binary format
# ---------------------------------------------------------------------------
# [0-3]   "F1TL" magic bytes
# [4-5]   game year uint16 LE  (e.g. 2025)
# [6]     format version uint8  (0x01)
# [7-10]  uncompressed payload size uint32 LE
# [11..N] gzip-compressed JSON payload
# [N+1..N+4] CRC32 of uncompressed JSON, uint32 LE

MAGIC          = b"F1TL"
FORMAT_VERSION = 0x01
SAMPLE_HZ      = 10.0   # telemetry frame capture rate


class SessionCollector:
    """Thread-safe collector. Feed it parsed packet objects; call snapshot() to get serialisable dict."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._reset()

    def _reset(self) -> None:
        self.uid: Optional[int] = None
        self.is_active = False
        self.raw_packets: int = 0   # set directly by UDP thread

        self._session: Optional[SessionData] = None
        self._player: Optional[ParticipantData] = None

        self._lap: int = 1
        self._lap_dist: float = 0.0
        self._lap_invalid: bool = False
        self._pit_status: int = 0
        self._num_pit_stops: int = 0
        self._driver_status: int = 0
        self._result_status: int = 0

        self._compound: str = "Unknown"
        self._visual_compound: str = "Unknown"
        self._tyre_age: int = 0
        self._fuel_laps: float = 0.0
        self._ers_pct: float = 0.0
        self._tyre_wear = (0.0, 0.0, 0.0, 0.0)

        self._frames: list = []
        self._last_sample_t: float = -99.0

        self._lap_records: dict = {}    # lap_number → LapRecord
        self._stints: list = []
        self._pit_flags: dict = {}      # lap_number → {pit_in, pit_out}
        self._prev_pit_status: int = 0
        self._pit_stop_timer_max: dict = {}   # lap_number → max pit_stop_timer_ms seen
        self._pit_lane_timer_max: dict = {}   # lap_number → max pit_lane_time_ms seen
        self._saved: bool = False

    # -----------------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------------

    def start(self, uid: int) -> None:
        with self._lock:
            self._reset()
            self.uid = uid
            self.is_active = True

    def finish(self) -> None:
        with self._lock:
            self.is_active = False

    def has_data(self) -> bool:
        with self._lock:
            return bool(self._lap_records or self._frames)

    def mark_saved(self) -> None:
        with self._lock:
            self._saved = True

    def has_unsaved_data(self) -> bool:
        with self._lock:
            return bool((self._lap_records or self._frames) and not self._saved)

    # -----------------------------------------------------------------------
    # Packet updates (called from UDP thread)
    # -----------------------------------------------------------------------

    def on_session(self, d: SessionData) -> None:
        with self._lock:
            self._session = d

    def on_participant(self, d: ParticipantData) -> None:
        with self._lock:
            if self._player is None:
                self._player = d

    def on_lap_data(self, d: LapData) -> None:
        with self._lock:
            lap = d.current_lap_num
            # pit_in: transition from not-in-pit to in-pit (status 1 or 2)
            if d.pit_status in (1, 2) and self._prev_pit_status not in (1, 2):
                self._pit_flags.setdefault(lap, {"pit_in": False, "pit_out": False})
                self._pit_flags[lap]["pit_in"] = True
            # track max pit timers while in pits
            if d.pit_status in (1, 2):
                if d.pit_stop_timer_ms > self._pit_stop_timer_max.get(lap, 0):
                    self._pit_stop_timer_max[lap] = d.pit_stop_timer_ms
                if d.pit_lane_time_ms > self._pit_lane_timer_max.get(lap, 0):
                    self._pit_lane_timer_max[lap] = d.pit_lane_time_ms
            self._prev_pit_status = d.pit_status
            self._lap = lap
            self._lap_dist = d.lap_distance_m
            self._lap_invalid = d.lap_invalid
            self._pit_status = d.pit_status
            self._num_pit_stops = d.num_pit_stops
            self._driver_status = d.driver_status
            self._result_status = d.result_status

    def on_car_status(self, d: CarStatus) -> None:
        with self._lock:
            self._compound = d.actual_compound
            self._visual_compound = d.visual_compound
            self._tyre_age = d.tyre_age_laps
            self._fuel_laps = d.fuel_remaining_laps
            self._ers_pct = d.ers_store_pct

    def on_car_damage(self, d: CarDamage) -> None:
        with self._lock:
            self._tyre_wear = d.tyre_wear

    def on_car_telemetry(self, d: CarTelemetry, session_time: float) -> None:
        with self._lock:
            if session_time - self._last_sample_t < 1.0 / SAMPLE_HZ:
                return
            self._last_sample_t = session_time
            tw = self._tyre_wear
            self._frames.append({
                "lap": self._lap,
                "lap_distance_m": round(self._lap_dist, 1),
                "speed_kmh": d.speed_kmh,
                "throttle": d.throttle,
                "brake": d.brake,
                "steering": d.steer,
                "gear": d.gear,
                "rpm": d.rpm,
                "drs": d.drs,
                "brake_temp_fl": d.brake_temp[0],
                "brake_temp_fr": d.brake_temp[1],
                "brake_temp_rl": d.brake_temp[2],
                "brake_temp_rr": d.brake_temp[3],
                "tyre_surf_fl": d.tyre_surface_temp[0],
                "tyre_surf_fr": d.tyre_surface_temp[1],
                "tyre_surf_rl": d.tyre_surface_temp[2],
                "tyre_surf_rr": d.tyre_surface_temp[3],
                "tyre_inner_fl": d.tyre_inner_temp[0],
                "tyre_inner_fr": d.tyre_inner_temp[1],
                "tyre_inner_rl": d.tyre_inner_temp[2],
                "tyre_inner_rr": d.tyre_inner_temp[3],
                "tyre_press_fl": d.tyre_pressure[0],
                "tyre_press_fr": d.tyre_pressure[1],
                "tyre_press_rl": d.tyre_pressure[2],
                "tyre_press_rr": d.tyre_pressure[3],
                "engine_temp": d.engine_temp,
                "ers_store_pct": self._ers_pct,
                "tyre_wear_fl": tw[0],
                "tyre_wear_fr": tw[1],
                "tyre_wear_rl": tw[2],
                "tyre_wear_rr": tw[3],
            })

    def on_session_history(self, h: SessionHistory) -> None:
        with self._lock:
            for lap in h.laps:
                if lap.lap_time_ms > 0:
                    self._lap_records[lap.lap_number] = lap
            if h.stints:
                self._stints = list(h.stints)

    # -----------------------------------------------------------------------
    # GUI status snapshot (called from main thread via poll)
    # -----------------------------------------------------------------------

    @property
    def status(self) -> dict:
        with self._lock:
            return {
                "active":      self.is_active,
                "track":       self._session.track_name if self._session else "-",
                "session_type":self._session.session_type if self._session else "-",
                "lap":         self._lap,
                "total_laps":  self._session.total_laps if self._session else 0,
                "compound":    self._visual_compound,
                "tyre_age":    self._tyre_age,
                "frame_count": len(self._frames),
                "lap_count":   len(self._lap_records),
            }

    # -----------------------------------------------------------------------
    # Serialise
    # -----------------------------------------------------------------------

    def to_dict(self, game_year: int) -> dict:
        with self._lock:
            si = self._session
            pi = self._player

            laps_out = []
            for n in sorted(self._lap_records):
                r = self._lap_records[n]
                pf = self._pit_flags.get(n, {})
                laps_out.append({
                    "lap_number":  r.lap_number,
                    "lap_time_ms": r.lap_time_ms,
                    "sector1_ms":  r.sector1_ms,
                    "sector2_ms":  r.sector2_ms,
                    "sector3_ms":  r.sector3_ms,
                    "valid":       r.lap_valid,
                    "pit_in":      pf.get("pit_in", False),
                    "pit_out":     pf.get("pit_out", False),
                    "pit_stop_time_ms": self._pit_stop_timer_max.get(n, 0),
                    "pit_lane_time_ms": self._pit_lane_timer_max.get(n, 0),
                })

            stints_out = [
                {
                    "start_lap":       s.start_lap,
                    "end_lap":         s.end_lap,
                    "compound_visual": s.visual_compound,
                    "compound_actual": s.actual_compound,
                }
                for s in self._stints
            ]

            return {
                "format_version": 1,
                "game_year":      game_year,
                "captured_at":    datetime.now(timezone.utc).isoformat(),
                "session": {
                    "uid":          str(self.uid),
                    "type":         si.session_type if si else "Unknown",
                    "track_id":     si.track_id if si else -1,
                    "track_name":   si.track_name if si else "Unknown",
                    "track_length_m": si.track_length_m if si else 0,
                    "total_laps":   si.total_laps if si else 0,
                    "weather":      si.weather if si else "Unknown",
                    "air_temp_c":   si.air_temp_c if si else 0,
                    "track_temp_c": si.track_temp_c if si else 0,
                },
                "player": {
                    "name": pi.name if pi else "PLAYER",
                    "team": pi.team if pi else "Unknown",
                },
                "laps":             laps_out,
                "tyre_stints":      stints_out,
                "telemetry_frames": list(self._frames),
            }


# ---------------------------------------------------------------------------
# File writer
# ---------------------------------------------------------------------------

def save(collector: SessionCollector, folder: str, game_year: int) -> Optional[Path]:
    if not collector.has_data():
        log.warning("Nothing to save.")
        return None

    data = collector.to_dict(game_year)
    json_bytes = json.dumps(data, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(json_bytes, compresslevel=6)
    crc = zlib.crc32(json_bytes) & 0xFFFFFFFF

    header = struct.pack("<4sHBI", MAGIC, game_year, FORMAT_VERSION, len(json_bytes))
    footer = struct.pack("<I", crc)
    file_bytes = header + compressed + footer

    path = Path(folder)
    path.mkdir(parents=True, exist_ok=True)

    session = data.get("session", {})
    track = re.sub(r"[^\w\-]", "", session.get("track_name", "Unknown").replace(" ", "_"))
    stype = re.sub(r"[^\w\-]", "", session.get("type", "Session").replace(" ", "_"))
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = path / f"{track}_{stype}_{ts}.f1tel"

    try:
        out.write_bytes(file_bytes)
        log.info("Saved %s (%d KB, %d laps, %d frames)",
                 out.name, len(file_bytes) // 1024,
                 len(data["laps"]), len(data["telemetry_frames"]))
        return out
    except OSError as e:
        log.error("Save failed: %s", e)
        return None
