"""
F1tel Gatherer 25 - entry point.
Run:   python main.py
Build: pyinstaller build.spec
"""

import logging
import socket
import sys
import threading
import time
from pathlib import Path
from typing import Optional

import customtkinter as ctk
from tkinter import filedialog

from packets import (
    parse_header, parse_session, parse_lap_data, parse_participants,
    parse_car_telemetry, parse_car_status, parse_car_damage, parse_session_history,
    HEADER_SIZE, ACTIVE_SESSION_TYPES,
)
from session import SessionCollector, save

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("f1tel")

# ---------------------------------------------------------------------------
# Config (simple, no external lib needed on first run)
# ---------------------------------------------------------------------------
DEFAULT_PORT   = 20777
DEFAULT_HOST   = "0.0.0.0"
DEFAULT_FOLDER = str(Path.home() / "Desktop" / "f1tel")

def load_config() -> dict:
    cfg_path = Path(__file__).parent / "config.toml"
    if not cfg_path.exists():
        return {}
    try:
        try:
            import tomllib
        except ImportError:
            import tomli as tomllib
        with open(cfg_path, "rb") as f:
            return tomllib.load(f)
    except Exception as e:
        log.warning("config.toml unreadable: %s", e)
        return {}

# ---------------------------------------------------------------------------
# UDP listener thread
# ---------------------------------------------------------------------------
WANTED_IDS = {1, 2, 4, 6, 7, 10, 11}

def udp_thread(host, port, collector: SessionCollector, game_year_box: list,
               on_status, on_save_trigger):
    """Runs in a daemon thread. on_status(str) and on_save_trigger() are thread-safe callbacks."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        sock.settimeout(1.0)
    except OSError as e:
        on_status(f"error:Port {port} in use ({e})")
        return

    on_status("waiting")
    log.info("Listening on %s:%d", host, port)
    current_uid = None
    raw_count = 0
    last_wanted_time = time.time()
    status_is_active = False
    TIMEOUT_SECS = 5.0

    while not _stop.is_set():
        try:
            data, _ = sock.recvfrom(4096)
        except socket.timeout:
            if status_is_active and time.time() - last_wanted_time > TIMEOUT_SECS:
                on_status("waiting")
                status_is_active = False
            continue
        except OSError:
            break

        raw_count += 1
        collector.raw_packets = raw_count

        hdr = parse_header(data)
        if hdr is None or hdr.packet_id not in WANTED_IDS:
            continue

        last_wanted_time = time.time()
        game_year_box[0] = hdr.packet_format

        uid = hdr.session_uid
        pid = hdr.player_car_index

        if uid != current_uid and uid != 0:
            if current_uid is not None and collector.has_data():
                on_status("saving")
                on_save_trigger()
            current_uid = uid
            collector.start(uid)
            on_status("waiting")

        try:
            if hdr.packet_id == 1:
                d = parse_session(data)
                if d:
                    collector.on_session(d)
                    if d.track_id >= 0:
                        on_status("active")
                        status_is_active = True
                    else:
                        on_status("waiting")
                        status_is_active = False

            elif hdr.packet_id == 4:
                d = parse_participants(data, pid)
                if d:
                    collector.on_participant(d)

            elif hdr.packet_id == 2:
                d = parse_lap_data(data, pid)
                if d:
                    collector.on_lap_data(d)

            elif hdr.packet_id == 6:
                d = parse_car_telemetry(data, pid)
                if d:
                    collector.on_car_telemetry(d, hdr.session_time)

            elif hdr.packet_id == 7:
                d = parse_car_status(data, pid)
                if d:
                    collector.on_car_status(d)

            elif hdr.packet_id == 10:
                d = parse_car_damage(data, pid)
                if d:
                    collector.on_car_damage(d)

            elif hdr.packet_id == 11:
                d = parse_session_history(data)
                if d and d.car_idx == pid:
                    collector.on_session_history(d)

        except Exception as e:
            log.warning("Packet %d error: %s", hdr.packet_id, e)

    sock.close()

_stop = threading.Event()

# ---------------------------------------------------------------------------
# Strings
# ---------------------------------------------------------------------------
STRINGS: dict[str, dict[str, str]] = {
    "en": {
        "status_waiting":    "Waiting for game...",
        "status_active":     "Recording active",
        "status_saving":     "Saving...",
        "status_saved":      "Saved \u2713",
        "status_error":      "Error",
        "info_track":        "Track:",
        "info_session":      "Session:",
        "info_lap":          "Lap:",
        "info_tyre":         "Tyre:",
        "info_frames":       "Frames:",
        "info_udp":          "UDP:",
        "info_tyre_laps":    "laps",
        "info_udp_packets":  "packets",
        "folder_placeholder":"Save folder...",
        "btn_save":          "Save",
        "btn_quit":          "Quit",
        "btn_show":          "\U0001f4c2  Show Recordings",
        "btn_about":         "About",
        "dlg_browse_title":  "Select save folder",
        "dlg_quit_title":    "Unsaved Data",
        "dlg_quit_msg":      "There is unsaved telemetry data.\n\nDo you want to save it?",
        "dlg_about_title":   "About",
        "dlg_about_msg":     "F1tel Gatherer 25\n\nF1 2025 telemetry recorder. Parse your data at https://f1tel.linuxhate.com\n\nAli Sezi\u015fli - 2026",
        "err_save_failed":   "Save failed",
    },
    "tr": {
        "status_waiting":    "Oyun bekleniyor...",
        "status_active":     "Kay\u0131t aktif",
        "status_saving":     "Kaydediliyor...",
        "status_saved":      "Kaydedildi \u2713",
        "status_error":      "Hata",
        "info_track":        "Pist:",
        "info_session":      "Oturum:",
        "info_lap":          "Tur:",
        "info_tyre":         "Lastik:",
        "info_frames":       "Frames:",
        "info_udp":          "UDP:",
        "info_tyre_laps":    "tur",
        "info_udp_packets":  "paket",
        "folder_placeholder":"Kay\u0131t klas\u00f6r\u00fc...",
        "btn_save":          "Kaydet",
        "btn_quit":          "\u00c7\u0131k",
        "btn_show":          "\U0001f4c2  Kay\u0131tlar\u0131 G\u00f6ster",
        "btn_about":         "Hakk\u0131nda",
        "dlg_browse_title":  "Kay\u0131t klas\u00f6r\u00fc se\u00e7",
        "dlg_quit_title":    "Kaydedilmemi\u015f Veri",
        "dlg_quit_msg":      "Kaydedilmemi\u015f telemetri verisi var.\n\nKaydetmek ister misiniz?",
        "dlg_about_title":   "Hakk\u0131nda",
        "dlg_about_msg":     "F1tel Gatherer 25\n\nF1 2025 telemetri kaydedicisi. Verinizi analiz etmek i\u00e7in: https://f1tel.linuxhate.com\n\nAli Sezi\u015fli - 2026",
        "err_save_failed":   "Kay\u0131t ba\u015far\u0131s\u0131z",
    },
}

# ---------------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------------
F1_RED      = "#E10600"
F1_RED_DIM  = "#A30400"
BG_CARD     = "#1A1A1A"
BG_INPUT    = "#222222"
FG_MUTED    = "#888888"
FG_LABEL    = "#AAAAAA"

STATUS_COLOR = {
    "waiting": "#555555",
    "active":  "#E10600",
    "saving":  "#FFB300",
    "saved":   "#E10600",
    "error":   "#FF453A",
}

class App(ctk.CTk):
    def __init__(self, collector: SessionCollector, game_year_box: list,
                 output_folder: list):
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")
        self.title("F1tel Gatherer 25")
        self.resizable(True, True)
        self.minsize(420, 400)
        icon_path = Path(__file__).parent / "icon.ico"
        if icon_path.exists():
            self.iconbitmap(str(icon_path))
        self.protocol("WM_DELETE_WINDOW", self._quit)

        self._collector = collector
        self._game_year = game_year_box
        self._folder    = output_folder
        self._lang: str = "en"
        self._current_status_key: str = "waiting"

        self._build()
        self._poll()

    def _s(self, key: str) -> str:
        return STRINGS[self._lang][key]

    def _build(self):
        self.columnconfigure(0, weight=1)
        self.columnconfigure(1, weight=0)

        P = {"padx": 14, "sticky": "ew"}

        # --- Title (col 0) ---
        ctk.CTkLabel(
            self, text="F1tel Gatherer 25",
            font=ctk.CTkFont(size=18, weight="bold"), anchor="w",
            text_color=F1_RED,
        ).grid(row=0, column=0, padx=14, pady=(14, 6), sticky="ew")

        # --- Language toggle (col 1, row 0) ---
        lf = ctk.CTkFrame(self, fg_color="transparent")
        lf.grid(row=0, column=1, padx=(0, 14), pady=(14, 6), sticky="e")
        self._en_btn = ctk.CTkButton(
            lf, text="EN", width=34, height=24,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=F1_RED, hover_color=F1_RED_DIM,
            command=lambda: self._set_lang("en"),
        )
        self._en_btn.grid(row=0, column=0)
        self._tr_btn = ctk.CTkButton(
            lf, text="TR", width=34, height=24,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#2A2A2A", hover_color="#333333",
            command=lambda: self._set_lang("tr"),
        )
        self._tr_btn.grid(row=0, column=1, padx=(4, 0))

        # --- Status (spans both cols) ---
        sf = ctk.CTkFrame(self, corner_radius=8, fg_color=BG_CARD)
        sf.grid(row=1, column=0, columnspan=2, pady=4, **P)
        sf.columnconfigure(1, weight=1)
        self._dot = ctk.CTkLabel(sf, text="●", font=ctk.CTkFont(size=16),
                                 text_color="#555555")
        self._dot.grid(row=0, column=0, padx=(12, 6), pady=8)
        self._status_lbl = ctk.CTkLabel(sf, text=self._s("status_waiting"),
                                        font=ctk.CTkFont(size=13), anchor="w")
        self._status_lbl.grid(row=0, column=1, padx=(0, 12), pady=8, sticky="w")

        # --- Info grid ---
        inf = ctk.CTkFrame(self, corner_radius=8, fg_color=BG_CARD)
        inf.grid(row=2, column=0, columnspan=2, pady=4, **P)
        inf.columnconfigure(1, weight=1)
        self._info: dict[str, ctk.CTkLabel] = {}
        self._info_key_labels: dict[str, ctk.CTkLabel] = {}
        info_keys = ["track", "session", "lap", "tyre", "frames", "udp"]
        init_vals = ["-", "-", "-", "-", "0", "0"]
        for i, (key, val) in enumerate(zip(info_keys, init_vals)):
            key_lbl = ctk.CTkLabel(inf, text=self._s(f"info_{key}"),
                                   font=ctk.CTkFont(size=12),
                                   text_color=FG_LABEL, anchor="w")
            key_lbl.grid(row=i, column=0, padx=(12, 6), pady=3, sticky="w")
            self._info_key_labels[key] = key_lbl
            val_lbl = ctk.CTkLabel(inf, text=val, font=ctk.CTkFont(size=12), anchor="w")
            val_lbl.grid(row=i, column=1, padx=(0, 12), pady=3, sticky="w")
            self._info[key] = val_lbl

        # --- Folder ---
        ff = ctk.CTkFrame(self, corner_radius=8, fg_color=BG_CARD)
        ff.grid(row=3, column=0, columnspan=2, pady=4, **P)
        ff.columnconfigure(0, weight=1)
        self._folder_entry = ctk.CTkEntry(ff, placeholder_text=self._s("folder_placeholder"),
                                          fg_color=BG_INPUT, border_color="#333333")
        self._folder_entry.insert(0, self._folder[0])
        self._folder_entry.grid(row=0, column=0, padx=(10, 6), pady=10, sticky="ew")
        ctk.CTkButton(ff, text="📁", width=36,
                      fg_color=BG_INPUT, hover_color="#333333",
                      command=self._browse).grid(row=0, column=1, padx=(0, 10), pady=10)

        # --- Buttons ---
        bf = ctk.CTkFrame(self, fg_color="transparent")
        bf.grid(row=4, column=0, columnspan=2, padx=14, pady=(6, 4), sticky="ew")
        bf.columnconfigure((0, 1), weight=1)
        self._save_btn = ctk.CTkButton(bf, text=self._s("btn_save"), height=36,
                                       fg_color=F1_RED, hover_color=F1_RED_DIM,
                                       command=self._save)
        self._save_btn.grid(row=0, column=0, padx=(0, 6), sticky="ew")
        self._quit_btn = ctk.CTkButton(bf, text=self._s("btn_quit"), height=36,
                                       fg_color="#2A2A2A", hover_color="#333333",
                                       command=self._quit)
        self._quit_btn.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        self._show_btn = ctk.CTkButton(
            self, text=self._s("btn_show"), height=32,
            fg_color="transparent", hover_color="#1E1E1E",
            text_color="white", border_width=1, border_color="#333333",
            command=self._open_folder,
        )
        self._show_btn.grid(row=5, column=0, columnspan=2, padx=14, pady=(0, 4), sticky="ew")

        self._about_btn = ctk.CTkButton(
            self, text=self._s("btn_about"), height=32,
            fg_color="transparent", hover_color="#1E1E1E",
            text_color="white", border_width=1, border_color="#333333",
            command=self._about,
        )
        self._about_btn.grid(row=6, column=0, columnspan=2, padx=14, pady=(0, 14), sticky="ew")

    def _set_lang(self, lang: str):
        self._lang = lang
        if lang == "en":
            self._en_btn.configure(fg_color=F1_RED, hover_color=F1_RED_DIM)
            self._tr_btn.configure(fg_color="#2A2A2A", hover_color="#333333")
        else:
            self._tr_btn.configure(fg_color=F1_RED, hover_color=F1_RED_DIM)
            self._en_btn.configure(fg_color="#2A2A2A", hover_color="#333333")
        self._apply_lang()

    def _apply_lang(self):
        # Status label
        if self._current_status_key != "error":
            self._status_lbl.configure(
                text=self._s(f"status_{self._current_status_key}")
            )
        # Info key labels
        for key in ["track", "session", "lap", "tyre", "frames", "udp"]:
            self._info_key_labels[key].configure(text=self._s(f"info_{key}"))
        # Buttons
        self._save_btn.configure(text=self._s("btn_save"))
        self._quit_btn.configure(text=self._s("btn_quit"))
        self._show_btn.configure(text=self._s("btn_show"))
        self._about_btn.configure(text=self._s("btn_about"))
        # UDP and tyre labels will refresh on next _poll tick

    def _poll(self):
        s = self._collector.status
        lbl = self._info
        total = s["total_laps"]
        lbl["track"].configure(text=s["track"])
        lbl["session"].configure(text=s["session_type"])
        lbl["lap"].configure(text=f"{s['lap']} / {total}" if total else str(s["lap"]))
        compound = s["compound"]
        lbl["tyre"].configure(
            text=f"{compound} ({s['tyre_age']} {self._s('info_tyre_laps')})"
            if compound not in ("Unknown", "-") else "-"
        )
        lbl["frames"].configure(text=f"{s['frame_count']:,}")
        lbl["udp"].configure(
            text=f"{self._collector.raw_packets:,} {self._s('info_udp_packets')}"
        )
        self.after(500, self._poll)

    def set_status(self, status: str):
        self.after(0, self._apply_status, status)

    def _apply_status(self, status: str):
        key = status.split(":")[0]
        color = STATUS_COLOR.get(key, "#888888")
        if key == "error":
            self._current_status_key = "error"
            text = status[6:] or self._s("status_error")
        else:
            self._current_status_key = key
            text = self._s(f"status_{key}")
        self._dot.configure(text_color=color)
        self._status_lbl.configure(text=text)
        if key == "saved":
            self.after(3000, lambda: self._apply_status("waiting"))

    def _save(self):
        self._apply_status("saving")
        self._save_btn.configure(state="disabled")
        folder = self._folder_entry.get().strip() or DEFAULT_FOLDER
        self._folder[0] = folder

        def _do():
            result = save(self._collector, folder, self._game_year[0])
            if result:
                self._collector.mark_saved()
            err_key = "err_save_failed"
            self.after(0, self._apply_status,
                       "saved" if result else f"error:{STRINGS[self._lang][err_key]}")
            self.after(0, lambda: self._save_btn.configure(state="normal"))

        threading.Thread(target=_do, daemon=True).start()

    def _about(self):
        from tkinter import messagebox
        messagebox.showinfo(
            self._s("dlg_about_title"),
            self._s("dlg_about_msg"),
        )

    def _browse(self):
        folder = filedialog.askdirectory(title=self._s("dlg_browse_title"))
        if folder:
            self._folder_entry.delete(0, "end")
            self._folder_entry.insert(0, folder)
            self._folder[0] = folder

    def _open_folder(self):
        import subprocess
        folder = str(Path(self._folder_entry.get().strip() or DEFAULT_FOLDER).resolve())
        Path(folder).mkdir(parents=True, exist_ok=True)
        subprocess.Popen(f'explorer "{folder}"')

    def _quit(self):
        if self._collector.has_unsaved_data():
            from tkinter import messagebox
            answer = messagebox.askyesnocancel(
                self._s("dlg_quit_title"),
                self._s("dlg_quit_msg"),
                default=messagebox.YES,
            )
            if answer is None:
                return
            if answer:
                folder = self._folder_entry.get().strip() or DEFAULT_FOLDER
                result = save(self._collector, folder, self._game_year[0])
                if result:
                    self._collector.mark_saved()
        _stop.set()
        self.destroy()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    cfg     = load_config()
    host    = cfg.get("udp", {}).get("host", DEFAULT_HOST)
    port    = int(cfg.get("udp", {}).get("port", DEFAULT_PORT))
    folder  = cfg.get("output", {}).get("folder", "") or DEFAULT_FOLDER

    collector    = SessionCollector()
    game_year    = [2025]
    output_folder = [folder]

    app = App(collector, game_year, output_folder)

    def on_save_trigger():
        result = save(collector, output_folder[0], game_year[0])
        if result:
            collector.mark_saved()
        app.set_status("saved")

    t = threading.Thread(
        target=udp_thread,
        args=(host, port, collector, game_year, app.set_status, on_save_trigger),
        daemon=True,
    )
    t.start()

    log.info("F1tel Gatherer 25 - %s:%d -> %s", host, port, folder)
    app.mainloop()
    _stop.set()


if __name__ == "__main__":
    main()
