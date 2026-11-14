import { NextResponse } from "next/server";
import type { Site, ScoreWeights, ComparisonSite, Metrics, ScoreBreakdown, BothWindow, HorizonMask, EphemerisPoint } from "@/lib/types";
import { rleEncode, computeMetrics, computeScore, findBestWindows, loadEphemerisBinary, loadHorizonJson, loadManifest, interpolateHorizon } from "@/lib/engine";

const DEFAULT_WEIGHTS: ScoreWeights = {
  sunlit: 0.45,
  darkness: 0.2,
  earth: 0.25,
  both: 0.1,
};

function computeVisibility(
  ephemeris: EphemerisPoint[],
  horizon: number[],
  limbMode: "upper" | "center" = "upper",
) {
  const n = ephemeris.length;
  const sun = new Uint8Array(n);
  const earth = new Uint8Array(n);
  const both = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const eph = ephemeris[i];
    const sunRadius = limbMode === "upper" ? eph.sun_radius : 0;
    const earthRadius = limbMode === "upper" ? eph.earth_radius : 0;

    const sunVisible = eph.sun_el + sunRadius > interpolateHorizon(horizon, eph.sun_az);
    const earthVisible = eph.earth_el + earthRadius > interpolateHorizon(horizon, eph.earth_az);

    sun[i] = sunVisible ? 1 : 0;
    earth[i] = earthVisible ? 1 : 0;
    both[i] = sunVisible && earthVisible ? 1 : 0;
  }

  return { sun, earth, both };
}

const sitesData = [
  { id: "malapert", name: "Malapert Massif", lat: -85.9, lon: 356.2, elevation_m: 5000, color: "#FFB800" },
  { id: "haworth", name: "Haworth", lat: -87.3, lon: 345.8, elevation_m: 2200, color: "#FF8C00" },
  { id: "shackleton", name: "Shackleton Rim", lat: -89.9, lon: 0.0, elevation_m: 3500, color: "#FFD700" },
  { id: "de_gerlache", name: "de Gerlache Rim", lat: -88.5, lon: 78.2, elevation_m: 2800, color: "#FFA500" },
  { id: "nobile", name: "Nobile Rim", lat: -84.8, lon: 317.5, elevation_m: 1900, color: "#FF6B00" },
  { id: "connecting_ridge", name: "Connecting Ridge", lat: -85.2, lon: 352.1, elevation_m: 3200, color: "#FF4500" },
  { id: "amundsen", name: "Amundsen Rim", lat: -84.5, lon: 82.8, elevation_m: 2100, color: "#E67E22" },
  { id: "leibnitz_beta", name: "Leibnitz Beta Plateau", lat: -85.7, lon: 295.4, elevation_m: 4200, color: "#D35400" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { site_ids, start, end, step_hours = 1, limb = "upper", weights } = body as {
      site_ids: string[];
      start: string;
      end: string;
      step_hours?: number;
      limb?: "upper" | "center";
      weights?: Partial<ScoreWeights>;
    };

    if (!site_ids || !Array.isArray(site_ids) || site_ids.length === 0) {
      return NextResponse.json({ error: "site_ids required" }, { status: 400 });
    }

    const finalWeights: ScoreWeights = { ...DEFAULT_WEIGHTS, ...weights };

    // Load manifest
    const manifest = await loadManifest("/data/manifest.json");
    const availableSites = new Set((manifest?.sites || sitesData).map((s: Site) => s.id));
    const invalid = site_ids.filter((id) => !availableSites.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid site IDs: ${invalid.join(", ")}` }, { status: 400 });
    }

    const sitesResults: ComparisonSite[] = [];

    for (const siteId of site_ids) {
      const site = sitesData.find((s) => s.id === siteId) || (manifest?.sites || []).find((s: Site) => s.id === siteId);
      if (!site) continue;

      // Load ephemeris
      const ephUrl = `/data/ephemeris/${siteId}.bin`;
      const ephemeris = await loadEphemerisBinary(ephUrl);

      // Load horizon
      const horizonUrl = `/data/horizon/${siteId}.json`;
      const horizonData = await loadHorizonJson(horizonUrl);
      const horizon = (horizonData as HorizonMask)?.horizon || [];

      if (!ephemeris.length || !horizon.length) {
        console.warn(`Missing data for site ${siteId}`);
        continue;
      }

      // Compute visibility
      const vis = computeVisibility(ephemeris, horizon, limb as "upper" | "center");

      // Metrics
      const metrics = computeMetrics(vis, step_hours);

      // Score
      const totalHours = ephemeris.length * step_hours;
      const score = computeScore(metrics, finalWeights, totalHours);

      // Best windows
      const bestWindows = findBestWindows(vis, step_hours, 5).map((w: BothWindow) => ({
        start_idx: w.start_idx,
        end_idx: w.end_idx,
        duration_h: w.duration_h,
        sun_el_start: 0,
        earth_el_start: 0,
        sun_margin_deg: 0,
        earth_margin_deg: 0,
      }));

      sitesResults.push({
        site: site as Site,
        horizon: horizonData as HorizonMask,
        series: vis,
        rle: {
          sun: rleEncode(vis.sun),
          earth: rleEncode(vis.earth),
          both: rleEncode(vis.both),
        },
        metrics,
        score,
        best_windows: bestWindows,
      });
    }

    return NextResponse.json({
      meta: {
        sites: site_ids,
        start,
        end,
        step_hours,
        limb,
        generated_at: new Date().toISOString(),
      },
      sites: sitesResults,
    });

  } catch (error) {
    console.error("Compare error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST for /compare" });
}