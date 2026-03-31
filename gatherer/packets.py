"""
F1 2025 UDP packet parsers.
All structs based on the official "Data Output from F1 25 v3" spec.
All values little-endian, packed (no padding).
"""

import struct
from dataclasses import dataclass
from typing import Optional, Tuple

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

TRACK_NAMES = {
    0: "Melbourne", 1: "Paul Ricard", 2: "Shanghai", 3: "Bahrain",
    4: "Catalunya", 5: "Monaco", 6: "Montreal", 7: "Silverstone",
    8: "Hockenheim", 9: "Hungaroring", 10: "Spa", 11: "Monza",
    12: "Singapore", 13: "Suzuka", 14: "Abu Dhabi", 15: "Austin (COTA)",
    16: "Interlagos", 17: "Austria", 18: "Sochi", 19: "Mexico City",
    20: "Baku", 21: "Bahrain Short", 22: "Silverstone Short",
    23: "Austin Short", 24: "Suzuka Short", 25: "Hanoi", 26: "Zandvoort",
    27: "Imola", 28: "Portimão", 29: "Jeddah", 30: "Miami",
    31: "Las Vegas", 32: "Lusail",
}

SESSION_TYPES = {
    0: "Unknown",
    1: "Practice 1", 2: "Practice 2", 3: "Practice 3", 4: "Short Practice",
    5: "Qualifying 1", 6: "Qualifying 2", 7: "Qualifying 3",
    8: "Short Qualifying", 9: "One-Shot Qualifying",
    # F1 2025: Sprint Shootout IDs 10-14 (new), Race moved to 15
    10: "Sprint Shootout 1", 11: "Sprint Shootout 2", 12: "Sprint Shootout 3",
    13: "Short Sprint Shootout", 14: "One-Shot Sprint Shootout",
    15: "Race", 16: "Race 2", 17: "Race 3",
    18: "Time Trial",
}

WEATHER = {
    0: "Clear", 1: "Light Cloud", 2: "Overcast",
    3: "Light Rain", 4: "Heavy Rain", 5: "Storm",
}

# F1 2025 actual compound IDs (from spec page 11)
ACTUAL_COMPOUND = {
    16: "C5", 17: "C4", 18: "C3", 19: "C2", 20: "C1", 21: "C0", 22: "C6",
    7: "Intermediate", 8: "Wet",
    9: "Dry (Classic)", 10: "Wet (Classic)",
    11: "Super Soft", 12: "Soft", 13: "Medium", 14: "Hard", 15: "Wet (F2)",
}

VISUAL_COMPOUND = {
    16: "Soft", 17: "Medium", 18: "Hard",
    7: "Intermediate", 8: "Wet",
    19: "Super Soft", 20: "Soft", 21: "Medium", 22: "Hard", 15: "Wet",
}

TEAM_IDS = {
    0: "Mercedes", 1: "Ferrari", 2: "Red Bull Racing", 3: "Williams",
    4: "Aston Martin", 5: "Alpine", 6: "RB", 7: "Haas", 8: "McLaren",
    9: "Sauber",
}

ACTIVE_SESSION_TYPES = {
    "Practice 1", "Practice 2", "Practice 3", "Short Practice",
    "Qualifying 1", "Qualifying 2", "Qualifying 3", "Short Qualifying",
    "One-Shot Qualifying",
    "Sprint Shootout 1", "Sprint Shootout 2", "Sprint Shootout 3",
    "Short Sprint Shootout", "One-Shot Sprint Shootout",
    "Race", "Race 2", "Race 3", "Time Trial",
}

# ---------------------------------------------------------------------------
# Packet Header  (29 bytes)
# ---------------------------------------------------------------------------
# uint16 packetFormat, uint8 gameYear, gameMajor, gameMinor, packetVersion,
# packetId, uint64 sessionUID, float sessionTime, uint32 frameId,
# uint32 overallFrameId, uint8 playerCarIndex, uint8 secondaryPlayerCarIndex

HEADER_FMT  = "<HBBBBBQfIIBB"
HEADER_SIZE = struct.calcsize(HEADER_FMT)   # 29 bytes

assert HEADER_SIZE == 29

@dataclass
class Header:
    packet_format: int
    game_year: int
    packet_id: int
    session_uid: int
    session_time: float
    player_car_index: int

def parse_header(data: bytes) -> Optional[Header]:
    if len(data) < HEADER_SIZE:
        return None
    try:
        f = struct.unpack_from(HEADER_FMT, data, 0)
        # "<HBBBBBQfIIBB"
        # f[0]=packetFormat, f[1]=gameYear, f[2]=gameMajor, f[3]=gameMinor,
        # f[4]=packetVersion, f[5]=packetId, f[6]=sessionUID,
        # f[7]=sessionTime, f[8]=frameId, f[9]=overallFrameId,
        # f[10]=playerCarIndex, f[11]=secondaryPlayerCarIndex
        return Header(
            packet_format=f[0],
            game_year=f[1],
            packet_id=f[5],
            session_uid=f[6],
            session_time=f[7],
            player_car_index=f[10],
        )
    except struct.error:
        return None

# ---------------------------------------------------------------------------
# Session Packet  (ID=1)
# ---------------------------------------------------------------------------
# Immediately after header:
# uint8 weather, int8 trackTemp, int8 airTemp, uint8 totalLaps,
# uint16 trackLength, uint8 sessionType, int8 trackId, ...rest not needed

_SESSION_FMT  = "<BbbBHBb"
_SESSION_SIZE = struct.calcsize(_SESSION_FMT)  # 8 bytes

@dataclass
class SessionData:
    weather: str
    track_temp_c: int
    air_temp_c: int
    total_laps: int
    track_length_m: int
    session_type: str
    track_id: int
    track_name: str

def parse_session(data: bytes) -> Optional[SessionData]:
    offset = HEADER_SIZE
    if len(data) < offset + _SESSION_SIZE:
        return None
    try:
        f = struct.unpack_from(_SESSION_FMT, data, offset)
        track_id = int(f[6])
        return SessionData(
            weather=WEATHER.get(f[0], "Unknown"),
            track_temp_c=int(f[1]),
            air_temp_c=int(f[2]),
            total_laps=int(f[3]),
            track_length_m=int(f[4]),
            session_type=SESSION_TYPES.get(f[5], "Unknown"),
            track_id=track_id,
            track_name=TRACK_NAMES.get(track_id, f"Track_{track_id}"),
        )
    except struct.error:
        return None

# ---------------------------------------------------------------------------
# Lap Data Packet  (ID=2)  - LapData per car: 57 bytes
# ---------------------------------------------------------------------------
# uint32 lastLapMS, uint32 currentLapMS,
# uint16 s1MS, uint8 s1Min, uint16 s2MS, uint8 s2Min,
# uint16 deltaFrontMS, uint8 deltaFrontMin,
# uint16 deltaLeaderMS, uint8 deltaLeaderMin,
# float lapDistance, float totalDistance, float safetyCarDelta,
# uint8 carPos, uint8 currentLapNum, uint8 pitStatus, uint8 numPitStops,
# uint8 sector, uint8 currentLapInvalid, uint8 penalties,
# uint8 totalWarnings, uint8 cornerCutting,
# uint8 numUnservedDT, uint8 numUnservedSG, uint8 gridPos,
# uint8 driverStatus, uint8 resultStatus,
# uint8 pitLaneTimerActive, uint16 pitLaneTimeMS, uint16 pitStopTimerMS,
# uint8 pitStopShouldServePen, float speedTrapFastest, uint8 speedTrapFastestLap

_LAP_FMT  = "<IIHBHBHBHBfffBBBBBBBBBBBBBBBHHBfB"
_LAP_SIZE = struct.calcsize(_LAP_FMT)

assert _LAP_SIZE == 57

@dataclass
class LapData:
    last_lap_ms: int
    sector1_ms: int
    sector2_ms: int
    lap_distance_m: float
    current_lap_num: int
    pit_status: int
    num_pit_stops: int
    sector: int
    lap_invalid: bool
    driver_status: int
    result_status: int
    pit_lane_time_ms: int    # total time in pit lane
    pit_stop_timer_ms: int   # actual box stop time (stationary in box)

def parse_lap_data(data: bytes, car_idx: int) -> Optional[LapData]:
    offset = HEADER_SIZE + car_idx * _LAP_SIZE
    if len(data) < offset + _LAP_SIZE:
        return None
    try:
        f = struct.unpack_from(_LAP_FMT, data, offset)
        return LapData(
            last_lap_ms=f[0],
            sector1_ms=f[3] * 60_000 + f[2],
            sector2_ms=f[5] * 60_000 + f[4],
            lap_distance_m=float(f[10]),
            current_lap_num=f[14],
            pit_status=f[15],
            num_pit_stops=f[16],
            sector=f[17],
            lap_invalid=bool(f[18]),
            driver_status=f[25],
            result_status=f[26],
            pit_lane_time_ms=int(f[28]),
            pit_stop_timer_ms=int(f[29]),
        )
    except struct.error:
        return None

# ---------------------------------------------------------------------------
# Participants Packet  (ID=4)  - ParticipantData per car: 57 bytes
# ---------------------------------------------------------------------------
# uint8 aiControlled, driverId, networkId, teamId, myTeam, raceNumber, nationality
# char name[32], uint8 yourTelemetry, showOnlineNames, uint16 techLevel,
# uint8 platform, numColours, bytes liveryColours[12]

_PART_FMT  = "<BBBBBBB32sBBHBB12s"
_PART_SIZE = struct.calcsize(_PART_FMT)

assert _PART_SIZE == 57

@dataclass
class ParticipantData:
    name: str
    team: str
    is_human: bool

def parse_participants(data: bytes, car_idx: int) -> Optional[ParticipantData]:
    offset = HEADER_SIZE + 1 + car_idx * _PART_SIZE   # +1 for numActiveCars byte
    if len(data) < offset + _PART_SIZE:
        return None
    try:
        f = struct.unpack_from(_PART_FMT, data, offset)
        name = f[7].rstrip(b"\x00").decode("utf-8", errors="replace") or "PLAYER"
        return ParticipantData(
            name=name,
            team=TEAM_IDS.get(int(f[3]), f"Team_{f[3]}"),
            is_human=f[0] == 0,
        )
    except struct.error:
        return None

# ---------------------------------------------------------------------------
# Car Telemetry Packet  (ID=6)  - CarTelemetryData per car: 60 bytes
# ---------------------------------------------------------------------------
# uint16 speed, float throttle, steer, brake, uint8 clutch, int8 gear,
# uint16 engineRPM, uint8 drs, revLightsPercent, uint16 revLightsBitValue,
# uint16 brakesTemp[4], uint8 tyreSurfaceTemp[4], tyreInnerTemp[4],
# uint16 engineTemp, float tyresPressure[4], uint8 surfaceType[4]

_TELEM_FMT  = "<HfffBbHBBHHHHHBBBBBBBBHffffBBBB"
_TELEM_SIZE = struct.calcsize(_TELEM_FMT)

assert _TELEM_SIZE == 60

@dataclass
class CarTelemetry:
    speed_kmh: int
    throttle: float
    steer: float
    brake: float
    gear: int
    rpm: int
    drs: bool
    brake_temp: Tuple[int, int, int, int]            # FL FR RL RR  (spec 0=RL 1=RR 2=FL 3=FR → reordered)
    tyre_surface_temp: Tuple[int, int, int, int]     # FL FR RL RR
    tyre_inner_temp: Tuple[int, int, int, int]       # FL FR RL RR
    engine_temp: int
    tyre_pressure: Tuple[float, float, float, float] # FL FR RL RR (PSI)

def parse_car_telemetry(data: bytes, car_idx: int) -> Optional[CarTelemetry]:
    offset = HEADER_SIZE + car_idx * _TELEM_SIZE
    if len(data) < offset + _TELEM_SIZE:
        return None
    try:
        f = struct.unpack_from(_TELEM_FMT, data, offset)
        return CarTelemetry(
            speed_kmh=int(f[0]),
            throttle=round(float(f[1]), 3),
            steer=round(float(f[2]), 3),
            brake=round(float(f[3]), 3),
            gear=int(f[5]),
            rpm=int(f[6]),
            drs=bool(f[7]),
            # Spec wheel order: 0=RL 1=RR 2=FL 3=FR → reorder to FL FR RL RR
            brake_temp=(int(f[12]), int(f[13]), int(f[10]), int(f[11])),
            tyre_surface_temp=(int(f[16]), int(f[17]), int(f[14]), int(f[15])),
            tyre_inner_temp=(int(f[20]), int(f[21]), int(f[18]), int(f[19])),
            engine_temp=int(f[22]),
            tyre_pressure=(round(float(f[25]), 2), round(float(f[26]), 2),
                           round(float(f[23]), 2), round(float(f[24]), 2)),
        )
    except struct.error:
        return None

# ---------------------------------------------------------------------------
# Car Status Packet  (ID=7)  - CarStatusData per car: 55 bytes
# ---------------------------------------------------------------------------
# uint8 TC, ABS, fuelMix, frontBrakeBias, pitLimiter,
# float fuelInTank, fuelCapacity, fuelRemainingLaps,
# uint16 maxRPM, idleRPM, uint8 maxGears, drsAllowed,
# uint16 drsActivationDistance, uint8 actualTyreCompound, visualTyreCompound,
# tyresAgeLaps, int8 vehicleFiaFlags,
# float enginePowerICE, enginePowerMGUK, ersStoreEnergy,
# uint8 ersDeployMode, float ersHarvestedMGUK, ersHarvestedMGUH, ersDeployed,
# uint8 networkPaused

_STATUS_FMT  = "<BBBBBfffHHBBHBBBbfffBfffB"
_STATUS_SIZE = struct.calcsize(_STATUS_FMT)

assert _STATUS_SIZE == 55

_ERS_MAX_JOULES = 4_000_000.0

@dataclass
class CarStatus:
    actual_compound: str
    visual_compound: str
    tyre_age_laps: int
    fuel_remaining_laps: float
    ers_store_pct: float
    drs_allowed: bool
    pit_limiter: bool

def parse_car_status(data: bytes, car_idx: int) -> Optional[CarStatus]:
    offset = HEADER_SIZE + car_idx * _STATUS_SIZE
    if len(data) < offset + _STATUS_SIZE:
        return None
    try:
        f = struct.unpack_from(_STATUS_FMT, data, offset)
        ers_pct = round(min(100.0, float(f[19]) / _ERS_MAX_JOULES * 100.0), 1)
        return CarStatus(
            actual_compound=ACTUAL_COMPOUND.get(int(f[13]), f"Compound_{f[13]}"),
            visual_compound=VISUAL_COMPOUND.get(int(f[14]), f"Compound_{f[14]}"),
            tyre_age_laps=int(f[15]),
            fuel_remaining_laps=round(float(f[7]), 2),
            ers_store_pct=ers_pct,
            drs_allowed=bool(f[11]),
            pit_limiter=bool(f[4]),
        )
    except struct.error:
        return None

# ---------------------------------------------------------------------------
# Car Damage Packet  (ID=10)  - CarDamageData per car: 46 bytes
# ---------------------------------------------------------------------------
# float tyresWear[4], uint8 tyresDamage[4], brakesDamage[4],
# tyreBlisters[4]  ← NEW F1 2025
# uint8 frontLeftWing, frontRightWing, rearWing, floor, diffuser, sidepod,
# drsFault, ersFault, gearBoxDamage, engineDamage,
# engineMGUHWear, engineESWear, engineCEWear, engineICEWear,
# engineMGUKWear, engineTCWear, engineBlown, engineSeized

_DAMAGE_FMT  = "<ffffBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
_DAMAGE_SIZE = struct.calcsize(_DAMAGE_FMT)

assert _DAMAGE_SIZE == 46

@dataclass
class CarDamage:
    tyre_wear: Tuple[float, float, float, float]   # FL FR RL RR (%)  (spec 0=RL 1=RR 2=FL 3=FR → reordered)
    tyre_blisters: Tuple[int, int, int, int]       # FL FR RL RR (%) - F1 2025 new

def parse_car_damage(data: bytes, car_idx: int) -> Optional[CarDamage]:
    offset = HEADER_SIZE + car_idx * _DAMAGE_SIZE
    if len(data) < offset + _DAMAGE_SIZE:
        return None
    try:
        f = struct.unpack_from(_DAMAGE_FMT, data, offset)
        # Spec wheel order: 0=RL 1=RR 2=FL 3=FR → reorder to FL FR RL RR
        return CarDamage(
            tyre_wear=(round(float(f[2]), 1), round(float(f[3]), 1),
                       round(float(f[0]), 1), round(float(f[1]), 1)),
            tyre_blisters=(int(f[14]), int(f[15]), int(f[12]), int(f[13])),
        )
    except struct.error:
        return None

# ---------------------------------------------------------------------------
# Session History Packet  (ID=11)
# ---------------------------------------------------------------------------
# LapHistoryData (14 bytes):
#   uint32 lapTimeMS, uint16 s1MS, uint8 s1Min,
#   uint16 s2MS, uint8 s2Min, uint16 s3MS, uint8 s3Min, uint8 validFlags
#
# TyreStintHistoryData (3 bytes):
#   uint8 endLap, actualCompound, visualCompound
#
# Packet layout after header:
#   uint8 carIdx, numLaps, numTyreStints, bestLap, bestS1, bestS2, bestS3 (7 bytes)
#   LapHistoryData[100]
#   TyreStintHistoryData[8]

_LAP_HIST_FMT  = "<IHBHBHBB"
_LAP_HIST_SIZE = struct.calcsize(_LAP_HIST_FMT)   # 14 bytes
_STINT_FMT     = "<BBB"
_STINT_SIZE    = struct.calcsize(_STINT_FMT)       # 3 bytes
_META_OFFSET   = HEADER_SIZE                       # 29
_LAPS_OFFSET   = _META_OFFSET + 7                 # 36
_STINTS_OFFSET = _LAPS_OFFSET + 100 * _LAP_HIST_SIZE  # 36 + 1400 = 1436

assert _LAP_HIST_SIZE == 14

@dataclass
class LapRecord:
    lap_number: int
    lap_time_ms: int
    sector1_ms: int
    sector2_ms: int
    sector3_ms: int
    lap_valid: bool

@dataclass
class TyreStint:
    start_lap: int
    end_lap: int        # 255 = ongoing
    actual_compound: str
    visual_compound: str

@dataclass
class SessionHistory:
    car_idx: int
    num_laps: int
    laps: list
    stints: list

def parse_session_history(data: bytes) -> Optional[SessionHistory]:
    min_len = _STINTS_OFFSET + 8 * _STINT_SIZE   # 1460 bytes
    if len(data) < min_len:
        return None
    try:
        meta = struct.unpack_from("<BBBBBBB", data, _META_OFFSET)
        car_idx, num_laps, num_stints = meta[0], meta[1], meta[2]

        laps = []
        for i in range(min(num_laps, 100)):
            f = struct.unpack_from(_LAP_HIST_FMT, data, _LAPS_OFFSET + i * _LAP_HIST_SIZE)
            flags = int(f[7])
            laps.append(LapRecord(
                lap_number=i + 1,
                lap_time_ms=int(f[0]),
                sector1_ms=int(f[2]) * 60_000 + int(f[1]),
                sector2_ms=int(f[4]) * 60_000 + int(f[3]),
                sector3_ms=int(f[6]) * 60_000 + int(f[5]),
                lap_valid=bool(flags & 0x01),
            ))

        stints = []
        prev_end = 0
        for i in range(min(num_stints, 8)):
            end_lap, actual_raw, visual_raw = struct.unpack_from(
                _STINT_FMT, data, _STINTS_OFFSET + i * _STINT_SIZE
            )
            stints.append(TyreStint(
                start_lap=prev_end + 1,
                end_lap=int(end_lap),
                actual_compound=ACTUAL_COMPOUND.get(int(actual_raw), f"Compound_{actual_raw}"),
                visual_compound=VISUAL_COMPOUND.get(int(visual_raw), f"Compound_{visual_raw}"),
            ))
            if end_lap != 255:
                prev_end = end_lap

        return SessionHistory(car_idx=car_idx, num_laps=num_laps, laps=laps, stints=stints)
    except struct.error:
        return None
