import { describe, it, expect } from "vitest";
import {
  interpolateHorizon,
  computeVisibility,
  rleEncode,
  rleDecode,
  computeMetrics,
  computeScore,
  findBestWindows,
  createEmptySeries,
} from "./engine";
import type { HorizonMask, EphemerisPoint, VisibilitySeries, ScoreWeights } from "./types";

const mockHorizon: HorizonMask = {
  site_id: "test",
  resolution_deg: 1,
  horizon: new Array(360).fill(0),
  metadata: {
    dem_source: "test",
    dem_resolution_m: 60,
    max_distance_km: 150,
    curvature_radius_km: 1737.4,
    generated_at: new Date().toISOString(),
    sample: true,
  },
};

const mockEphemeris: EphemerisPoint[] = [
  { t: 0, sun_az: 0, sun_el: 10, earth_az: 180, earth_el: 5, sun_radius: 0.27, earth_radius: 0.95 },
  { t: 3600, sun_az: 15, sun_el: 5, earth_az: 195, earth_el: -2, sun_radius: 0.27, earth_radius: 0.95 },
  { t: 7200, sun_az: 30, sun_el: -5, earth_az: 210, earth_el: -10, sun_radius: 0.27, earth_radius: 0.95 },
];

describe("interpolateHorizon", () => {
  it("returns exact value at integer azimuth", () => {
    const h = new Array(360).fill(0);
    h[0] = 5;
    h[1] = 10;
    expect(interpolateHorizon(h, 0)).toBe(5);
    expect(interpolateHorizon(h, 1)).toBe(10);
  });

  it("interpolates between integer azimuths", () => {
    const h = new Array(360).fill(0);
    h[0] = 0;
    h[1] = 10;
    expect(interpolateHorizon(h, 0.5)).toBe(5);
  });

  it("wraps at 360 degrees", () => {
    const h = new Array(360).fill(0);
    h[359] = 5;
    h[0] = 10;
    expect(interpolateHorizon(h, 359.5)).toBe(7.5);
  });

  it("handles negative azimuth", () => {
    const h = new Array(360).fill(0);
    h[359] = 5;
    expect(interpolateHorizon(h, -1)).toBe(5);
  });
});

describe("computeVisibility", () => {
  it("returns visible when body above horizon", () => {
    const h = { ...mockHorizon, horizon: new Array(360).fill(0) };
    const vis = computeVisibility(mockEphemeris, h, "upper");
    expect(vis.sun[0]).toBe(1); // sun_el 10 + radius 0.27 > horizon 0
    expect(vis.earth[0]).toBe(1); // earth_el 5 + radius 0.95 > horizon 0
  });

  it("returns blocked when body below horizon", () => {
    const h = { ...mockHorizon, horizon: new Array(360).fill(20) };
    const vis = computeVisibility(mockEphemeris, h, "upper");
    expect(vis.sun[0]).toBe(0); // 10 + 0.27 < 20
    expect(vis.earth[0]).toBe(0); // 5 + 0.95 < 20
  });

  it("center mode ignores angular radius", () => {
    const h = { ...mockHorizon, horizon: new Array(360).fill(5) };
    const visUpper = computeVisibility(mockEphemeris, h, "upper");
    const visCenter = computeVisibility(mockEphemeris, h, "center");
    // At index 1: sun_el=5, radius=0.27 -> upper: 5.27 > 5 (visible), center: 5 = 5 (not visible)
    expect(visUpper.sun[1]).toBe(1);
    expect(visCenter.sun[1]).toBe(0);
  });
});

describe("rleEncode / rleDecode", () => {
  it("encodes and decodes correctly", () => {
    const arr = new Uint8Array([1, 1, 1, 0, 0, 1, 1]);
    const rle = rleEncode(arr);
    expect(rle.segments).toHaveLength(3);
    expect(rle.segments[0]).toEqual({ start: 0, end: 2, visible: true });
    expect(rle.segments[1]).toEqual({ start: 3, end: 4, visible: false });
    expect(rle.segments[2]).toEqual({ start: 5, end: 6, visible: true });

    const decoded = rleDecode(rle);
    expect(decoded).toEqual(arr);
  });

  it("handles all visible", () => {
    const arr = new Uint8Array([1, 1, 1]);
    const rle = rleEncode(arr);
    expect(rle.segments).toHaveLength(1);
    expect(rle.segments[0]).toEqual({ start: 0, end: 2, visible: true });
    expect(rleDecode(rle)).toEqual(arr);
  });

  it("handles all blocked", () => {
    const arr = new Uint8Array([0, 0, 0]);
    const rle = rleEncode(arr);
    expect(rle.segments).toHaveLength(1);
    expect(rle.segments[0]).toEqual({ start: 0, end: 2, visible: false });
    expect(rleDecode(rle)).toEqual(arr);
  });

  it("handles single element", () => {
    const arr = new Uint8Array([1]);
    const rle = rleEncode(arr);
    expect(rle.segments).toHaveLength(1);
    expect(rleDecode(rle)).toEqual(arr);
  });
});

describe("computeMetrics", () => {
  it("computes basic metrics", () => {
    const vis: VisibilitySeries = {
      sun: new Uint8Array([1, 1, 0, 0, 1]),
      earth: new Uint8Array([1, 0, 0, 1, 1]),
      both: new Uint8Array([1, 0, 0, 0, 1]),
    };
    const metrics = computeMetrics(vis, 1);
    expect(metrics.sunlit_pct).toBe(60);
    expect(metrics.longest_sunlight_h).toBe(2);
    expect(metrics.longest_darkness_h).toBe(2);
    expect(metrics.earth_visible_h).toBe(3);
    expect(metrics.earth_windows).toBe(2);
    expect(metrics.longest_earth_window_h).toBe(2);
    expect(metrics.both_windows.length).toBe(2);
  });

  it("handles all visible", () => {
    const vis: VisibilitySeries = {
      sun: new Uint8Array([1, 1, 1]),
      earth: new Uint8Array([1, 1, 1]),
      both: new Uint8Array([1, 1, 1]),
    };
    const metrics = computeMetrics(vis, 1);
    expect(metrics.sunlit_pct).toBe(100);
    expect(metrics.longest_darkness_h).toBe(0);
    expect(metrics.earth_visible_h).toBe(3);
  });

  it("handles all blocked", () => {
    const vis: VisibilitySeries = {
      sun: new Uint8Array([0, 0, 0]),
      earth: new Uint8Array([0, 0, 0]),
      both: new Uint8Array([0, 0, 0]),
    };
    const metrics = computeMetrics(vis, 1);
    expect(metrics.sunlit_pct).toBe(0);
    expect(metrics.longest_sunlight_h).toBe(0);
    expect(metrics.longest_darkness_h).toBe(3);
  });
});

describe("computeScore", () => {
  const weights: ScoreWeights = { sunlit: 0.45, darkness: 0.2, earth: 0.25, both: 0.1 };

  it("returns 0-100 score", () => {
    const metrics = {
      sunlit_pct: 50,
      longest_sunlight_h: 10,
      longest_darkness_h: 5,
      earth_visible_h: 100,
      earth_windows: 5,
      longest_earth_window_h: 30,
      both_windows: [{ start_idx: 0, end_idx: 10, duration_h: 10, sun_el_start: 0, earth_el_start: 0, sun_margin_deg: 0, earth_margin_deg: 0 }],
    };
    const score = computeScore(metrics, weights, 200);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.sunlit_score).toBe(50);
    expect(score.weights).toEqual(weights);
  });

  it("perfect score for ideal metrics", () => {
    const metrics = {
      sunlit_pct: 100,
      longest_sunlight_h: 200,
      longest_darkness_h: 0,
      earth_visible_h: 200,
      earth_windows: 1,
      longest_earth_window_h: 200,
      both_windows: [{ start_idx: 0, end_idx: 199, duration_h: 200, sun_el_start: 0, earth_el_start: 0, sun_margin_deg: 0, earth_margin_deg: 0 }],
    };
    const score = computeScore(metrics, weights, 200);
    expect(score.total).toBe(100);
  });
});

describe("findBestWindows", () => {
  it("finds top N windows by duration", () => {
    const vis: VisibilitySeries = {
      sun: new Uint8Array([1, 1, 0, 1, 1, 1, 0, 1]),
      earth: new Uint8Array([1, 1, 0, 1, 1, 1, 0, 1]),
      both: new Uint8Array([1, 1, 0, 1, 1, 1, 0, 1]),
    };
    const windows = findBestWindows(vis, 1, 2);
    expect(windows.length).toBeLessThanOrEqual(2);
    expect(windows[0].duration_h).toBeGreaterThanOrEqual(windows[1]?.duration_h ?? 0);
  });

  it("returns empty for no both-visible", () => {
    const vis: VisibilitySeries = {
      sun: new Uint8Array([1, 0, 1]),
      earth: new Uint8Array([0, 1, 0]),
      both: new Uint8Array([0, 0, 0]),
    };
    const windows = findBestWindows(vis, 1);
    expect(windows).toHaveLength(0);
  });
});

describe("createEmptySeries", () => {
  it("creates zero-filled arrays", () => {
    const s = createEmptySeries(10);
    expect(s.sun).toHaveLength(10);
    expect(s.earth).toHaveLength(10);
    expect(s.both).toHaveLength(10);
    expect(s.sun.every((v) => v === 0)).toBe(true);
  });
});