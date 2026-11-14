export interface Site {
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevation_m: number;
  description: string;
  nasa_source_url: string;
  color: string;
}

export interface EphemerisPoint {
  t: number;
  sun_az: number;
  sun_el: number;
  earth_az: number;
  earth_el: number;
  sun_radius: number;
  earth_radius: number;
}

export interface HorizonMask {
  site_id: string;
  resolution_deg: number;
  horizon: number[];
  metadata: {
    dem_source: string;
    dem_resolution_m: number;
    max_distance_km: number;
    curvature_radius_km: number;
    generated_at: string;
    sample: boolean;
  };
}

export interface Manifest {
  version: string;
  generated_at: string;
  date_range: { start: string; end: string };
  step_hours: number;
  sites: Site[];
  ephemeris: Record<string, { url: string; points: number; bytes: number }>;
  horizon: Record<string, { url: string }>;
  sample: boolean;
  notes: string;
}

export interface VisibilitySeries {
  sun: Uint8Array;
  earth: Uint8Array;
  both: Uint8Array;
}

export interface RLESegment {
  start: number;
  end: number;
  visible: boolean;
}

export interface RLESeries {
  segments: RLESegment[];
  total_points: number;
}

export interface Metrics {
  sunlit_pct: number;
  longest_sunlight_h: number;
  longest_darkness_h: number;
  earth_visible_h: number;
  earth_windows: number;
  longest_earth_window_h: number;
  both_windows: BothWindow[];
}

export interface BothWindow {
  start_idx: number;
  end_idx: number;
  duration_h: number;
  sun_el_start: number;
  earth_el_start: number;
  sun_margin_deg: number;
  earth_margin_deg: number;
}

export interface ScoreBreakdown {
  sunlit_score: number;
  darkness_score: number;
  earth_score: number;
  both_score: number;
  total: number;
  weights: {
    sunlit: number;
    darkness: number;
    earth: number;
    both: number;
  };
}

export interface ComparisonResult {
  meta: {
    sites: string[];
    start: string;
    end: string;
    step_hours: number;
    limb: "upper" | "center";
    generated_at: string;
  };
  sites: ComparisonSite[];
}

export interface ComparisonSite {
  site: Site;
  horizon: HorizonMask;
  series: VisibilitySeries;
  rle: {
    sun: RLESeries;
    earth: RLESeries;
    both: RLESeries;
  };
  metrics: Metrics;
  score: ScoreBreakdown;
  best_windows: BothWindow[];
}

export interface NarrateRequest {
  context: {
    sites: ComparisonSite[];
    audience: "planner" | "educator" | "public";
    current_time_idx?: number;
    best_windows?: BothWindow[];
  };
}

export interface NarrateResponse {
  sentences: string[];
  text: string;
  source: "llm" | "template";
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context?: {
    sites?: ComparisonSite[];
    current_time_idx?: number;
  };
}

export interface ChatResponseChunk {
  type: "text" | "sources" | "actions" | "error" | "done";
  content?: string;
  sources?: SourceCitation[];
  actions?: ToolAction[];
  error?: string;
}

export interface SourceCitation {
  url: string;
  title: string;
  domain: string;
}

export interface ToolAction {
  type: "select_site" | "set_dates" | "fly_to_site" | "run_best_window" | "open_first_person";
  payload: Record<string, unknown>;
}

export interface APIError {
  error: string;
  code: string;
  details?: unknown;
}

export interface ScoreWeights {
  sunlit: number;
  darkness: number;
  earth: number;
  both: number;
}

export type Audience = "planner" | "educator" | "public";
export type QualityTier = "auto" | "high" | "medium" | "low";
export type LimbMode = "upper" | "center";