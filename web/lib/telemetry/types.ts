export interface SessionInfo {
  uid: string;
  type: string;
  track_id: number;
  track_name: string;
  track_length_m: number;
  total_laps: number;
  weather: string;
  air_temp_c: number;
  track_temp_c: number;
}

export interface Player {
  name: string;
  team: string;
}

export interface Lap {
  lap_number: number;
  lap_time_ms: number;
  sector1_ms: number;
  sector2_ms: number;
  sector3_ms: number;
  valid: boolean;
  pit_in: boolean;
  pit_out: boolean;
  pit_stop_time_ms?: number;
  pit_lane_time_ms?: number;
}

export interface TyreStint {
  start_lap: number;
  end_lap: number;
  compound_visual: string;
  compound_actual: string;
}

export interface TelemetryFrame {
  lap: number;
  lap_distance_m: number;
  speed_kmh: number;
  throttle: number;
  brake: number;
  steering: number;
  gear: number;
  rpm: number;
  drs: boolean;
  brake_temp_fl: number;
  brake_temp_fr: number;
  brake_temp_rl: number;
  brake_temp_rr: number;
  tyre_surf_fl: number;
  tyre_surf_fr: number;
  tyre_surf_rl: number;
  tyre_surf_rr: number;
  tyre_inner_fl: number;
  tyre_inner_fr: number;
  tyre_inner_rl: number;
  tyre_inner_rr: number;
  tyre_press_fl: number;
  tyre_press_fr: number;
  tyre_press_rl: number;
  tyre_press_rr: number;
  engine_temp: number;
  ers_store_pct: number;
  tyre_wear_fl: number;
  tyre_wear_fr: number;
  tyre_wear_rl: number;
  tyre_wear_rr: number;
}

export interface F1TelData {
  format_version: number;
  game_year: number;
  captured_at: string;
  session: SessionInfo;
  player: Player;
  laps: Lap[];
  tyre_stints: TyreStint[];
  telemetry_frames: TelemetryFrame[];
}
