import { NextResponse } from "next/server";
import type { BothWindow, EphemerisPoint, HorizonMask } from "@/lib/types";
import { findBestWindows, loadEphemerisBinary, loadHorizonJson, loadManifest, interpolateHorizon } from "@/lib/engine";

function computeVisibility(
  ephemeris: EphemerisPoint[],
  horizon: number[],
  limbMode = "upper" as const,
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
  { id: "malapert" },
  { id: "haworth" },
  { id: "shackleton" },
  { id: "de_gerlache" },
  { id: "nobile" },
  { id: "connecting_ridge" },
  { id: "amundsen" },
  { id: "leibnitz_beta" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { site_id, start, end } = body as {
      site_id: string;
      start: string;
      end: string;
    };

    if (!site_id) {
      return NextResponse.json({ error: "site_id required" }, { status: 400 });
    }

    // Validate site
    const availableSites = new Set(sitesData.map((s) => s.id));
    if (!availableSites.has(site_id)) {
      return NextResponse.json({ error: `Invalid site_id: ${site_id}` }, { status: 400 });
    }

    // Load ephemeris
    const ephUrl = `/data/ephemeris/${site_id}.bin`;
    const ephemeris = await loadEphemerisBinary(ephUrl);

    // Load horizon
    const horizonUrl = `/data/horizon/${site_id}.json`;
    const horizonData = await loadHorizonJson(horizonUrl);
    const horizon = (horizonData as HorizonMask)?.horizon || [];

    if (!ephemeris.length || !horizon.length) {
      return NextResponse.json({ windows: [], message: "Data not available" });
    }

    // Compute visibility
    const vis = computeVisibility(ephemeris, horizon, "upper");

    // Find best windows
    const windows = findBestWindows(vis, 1.0, 5).map((w: BothWindow) => ({
      start_idx: w.start_idx,
      end_idx: w.end_idx,
      duration_h: w.duration_h,
      sun_el_start: 0,
      earth_el_start: 0,
      sun_margin_deg: 0,
      earth_margin_deg: 0,
    }));

    // Add elevation info
    for (const w of windows) {
      const idx = w.start_idx;
      if (idx < ephemeris.length) {
        w.sun_el_start = ephemeris[idx].sun_el;
        w.earth_el_start = ephemeris[idx].earth_el;
      }
    }

    return NextResponse.json({ windows });

  } catch (error) {
    console.error("Best windows error:", error);
    return NextResponse.json({ windows: [], error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST for /best-windows" });
}