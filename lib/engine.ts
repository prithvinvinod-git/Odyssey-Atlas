import type {
  EphemerisPoint,
  HorizonMask,
  VisibilitySeries,
  RLESeries,
  Metrics,
  BothWindow,
  ScoreBreakdown,
  Site,
  LimbMode,
  ScoreWeights,
} from "./types";

const LUNAR_RADIUS_KM = 1737.4;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function interpolateHorizon(horizon: number[], azimuth: number): number {
  const az = ((azimuth % 360) + 360) % 360;
  const i0 = Math.floor(az);
  const i1 = (i0 + 1) % 360;
  const t = az - i0;
  return horizon[i0] * (1 - t) + horizon[i1] * t;
}

export function computeVisibility(
  ephemeris: EphemerisPoint[],
  horizon: HorizonMask | number[],
  limbMode: LimbMode = "upper"
): VisibilitySeries {
  const n = ephemeris.length;
  const sun = new Uint8Array(n);
  const earth = new Uint8Array(n);
  const both = new Uint8Array(n);

  const horizonArr = Array.isArray(horizon) ? horizon : horizon.horizon;

  for (let i = 0; i < n; i++) {
    const eph = ephemeris[i];
    const sunRadius = limbMode === "upper" ? eph.sun_radius : 0;
    const earthRadius = limbMode === "upper" ? eph.earth_radius : 0;

    const sunVisible = eph.sun_el + sunRadius > interpolateHorizon(horizonArr, eph.sun_az);
    const earthVisible = eph.earth_el + earthRadius > interpolateHorizon(horizonArr, eph.earth_az);

    sun[i] = sunVisible ? 1 : 0;
    earth[i] = earthVisible ? 1 : 0;
    both[i] = sunVisible && earthVisible ? 1 : 0;
  }

  return { sun, earth, both };
}

export function rleEncode(arr: Uint8Array): RLESeries {
  const segments: { start: number; end: number; visible: boolean }[] = [];
  let start = 0;
  let current = arr[0];

  for (let i = 1; i <= arr.length; i++) {
    const val = i < arr.length ? arr[i] : 1 - current;
    if (val !== current) {
      segments.push({ start, end: i - 1, visible: current === 1 });
      start = i;
      current = val;
    }
  }

  return { segments, total_points: arr.length };
}

export function rleDecode(rle: RLESeries): Uint8Array {
  const arr = new Uint8Array(rle.total_points);
  for (const seg of rle.segments) {
    const val = seg.visible ? 1 : 0;
    for (let i = seg.start; i <= seg.end; i++) {
      arr[i] = val;
    }
  }
  return arr;
}

export function computeMetrics(
  visibility: VisibilitySeries,
  stepHours: number
): Metrics {
  const { sun, earth, both } = visibility;
  const n = sun.length;

  let sunlitCount = 0;
  let maxSunlight = 0;
  let currentSunlight = 0;
  let maxDarkness = 0;
  let currentDarkness = 0;
  let earthVisibleCount = 0;
  let maxEarthWindow = 0;
  let currentEarthWindow = 0;
  let earthWindows = 0;
  let inEarthWindow = false;

  const bothWindows: BothWindow[] = [];
  let inBothWindow = false;
  let bothStart = 0;

  for (let i = 0; i < n; i++) {
    if (sun[i]) {
      sunlitCount++;
      currentSunlight += stepHours;
      maxSunlight = Math.max(maxSunlight, currentSunlight);
      currentDarkness = 0;
    } else {
      currentDarkness += stepHours;
      maxDarkness = Math.max(maxDarkness, currentDarkness);
      currentSunlight = 0;
    }

    if (earth[i]) {
      earthVisibleCount += stepHours;
      if (!inEarthWindow) {
        inEarthWindow = true;
        earthWindows++;
        currentEarthWindow = stepHours;
      } else {
        currentEarthWindow += stepHours;
      }
      maxEarthWindow = Math.max(maxEarthWindow, currentEarthWindow);
    } else {
      inEarthWindow = false;
      currentEarthWindow = 0;
    }

    if (both[i]) {
      if (!inBothWindow) {
        inBothWindow = true;
        bothStart = i;
      }
    } else if (inBothWindow) {
      inBothWindow = false;
      const duration = (i - bothStart) * stepHours;
      bothWindows.push({
        start_idx: bothStart,
        end_idx: i - 1,
        duration_h: duration,
        sun_el_start: 0,
        earth_el_start: 0,
        sun_margin_deg: 0,
        earth_margin_deg: 0,
      });
    }
  }

  if (inBothWindow) {
    const duration = (n - bothStart) * stepHours;
    bothWindows.push({
      start_idx: bothStart,
      end_idx: n - 1,
      duration_h: duration,
      sun_el_start: 0,
      earth_el_start: 0,
      sun_margin_deg: 0,
      earth_margin_deg: 0,
    });
  }

  bothWindows.sort((a, b) => b.duration_h - a.duration_h);

  return {
    sunlit_pct: (sunlitCount / n) * 100,
    longest_sunlight_h: maxSunlight,
    longest_darkness_h: maxDarkness,
    earth_visible_h: earthVisibleCount,
    earth_windows: earthWindows,
    longest_earth_window_h: maxEarthWindow,
    both_windows: bothWindows,
  };
}

export function computeScore(
  metrics: Metrics,
  weights: ScoreWeights,
  totalHours: number
): ScoreBreakdown {
  const sunlitScore = metrics.sunlit_pct;
  const darknessScore = Math.max(0, 100 - (metrics.longest_darkness_h / totalHours) * 100);
  const earthScore = (metrics.earth_visible_h / totalHours) * 100;
  const bothScore = metrics.both_windows.length > 0
    ? Math.min(100, (metrics.both_windows[0].duration_h / totalHours) * 200)
    : 0;

  const total =
    sunlitScore * weights.sunlit +
    darknessScore * weights.darkness +
    earthScore * weights.earth +
    bothScore * weights.both;

  return {
    sunlit_score: sunlitScore,
    darkness_score: darknessScore,
    earth_score: earthScore,
    both_score: bothScore,
    total: Math.round(total * 100) / 100,
    weights,
  };
}

export function findBestWindows(
  visibility: VisibilitySeries,
  stepHours: number,
  topN = 5
): BothWindow[] {
  const { both } = visibility;
  const n = both.length;
  const windows: BothWindow[] = [];

  let inWindow = false;
  let start = 0;

  for (let i = 0; i <= n; i++) {
    const val = i < n ? both[i] : 0;
    if (val && !inWindow) {
      inWindow = true;
      start = i;
    } else if (!val && inWindow) {
      inWindow = false;
      windows.push({
        start_idx: start,
        end_idx: i - 1,
        duration_h: (i - start) * stepHours,
        sun_el_start: 0,
        earth_el_start: 0,
        sun_margin_deg: 0,
        earth_margin_deg: 0,
      });
    }
  }

  windows.sort((a, b) => b.duration_h - a.duration_h);
  return windows.slice(0, topN);
}

export async function loadEphemerisBinary(url: string): Promise<EphemerisPoint[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ephemeris: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const view = new DataView(buffer);
  const n = view.byteLength / 28;
  const points: EphemerisPoint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const offset = i * 28;
    points[i] = {
      t: view.getFloat64(offset, true),
      sun_az: view.getFloat32(offset + 8, true),
      sun_el: view.getFloat32(offset + 12, true),
      earth_az: view.getFloat32(offset + 16, true),
      earth_el: view.getFloat32(offset + 20, true),
      sun_radius: view.getFloat32(offset + 24, true),
      earth_radius: view.getFloat32(offset + 28, true),
    };
  }
  return points;
}

export async function loadHorizonJson(url: string): Promise<HorizonMask> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load horizon: ${res.status}`);
  return res.json();
}

export async function loadManifest(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  return res.json();
}

export function createEmptySeries(n: number): VisibilitySeries {
  return {
    sun: new Uint8Array(n),
    earth: new Uint8Array(n),
    both: new Uint8Array(n),
  };
}

export function computeComparison(
  sites: Site[],
  ephemerisMap: Map<string, EphemerisPoint[]>,
  horizonMap: Map<string, HorizonMask>,
  limbMode: LimbMode,
  weights: ScoreWeights
): { sites: any[]; meta: any } {
  const results = [];
  const stepHours = 1;

  for (const site of sites) {
    const ephemeris = ephemerisMap.get(site.id);
    const horizon = horizonMap.get(site.id);
    if (!ephemeris || !horizon) continue;

    const visibility = computeVisibility(ephemeris, horizon, limbMode);
    const metrics = computeMetrics(visibility, stepHours);
    const score = computeScore(metrics, weights, ephemeris.length * stepHours);
    const bestWindows = findBestWindows(visibility, stepHours);
    const rle = {
      sun: rleEncode(visibility.sun),
      earth: rleEncode(visibility.earth),
      both: rleEncode(visibility.both),
    };

    results.push({
      site,
      horizon,
      series: visibility,
      rle,
      metrics,
      score,
      best_windows: bestWindows,
    });
  }

  return {
    meta: {
      sites: sites.map((s) => s.id),
      step_hours: stepHours,
      limb: limbMode,
      generated_at: new Date().toISOString(),
    },
    sites: results,
  };
}