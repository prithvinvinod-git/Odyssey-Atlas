import { NextResponse } from "next/server";
import type { Site } from "@/lib/types";

export async function GET() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/sites`, {
      next: { revalidate: 3600 }
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ sites: data.sites || [], source: "api" });
    }
  } catch (e) {
    console.log("API fetch failed, using static fallback");
  }

  // Static fallback
  const staticSites: Site[] = [
    { id: "malapert", name: "Malapert Massif", lat: -85.9, lon: 356.2, elevation_m: 5000, description: "Highland massif near the south pole with extended illumination.", nasa_source_url: "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", color: "#FFB800" },
    { id: "haworth", name: "Haworth", lat: -87.3, lon: 345.8, elevation_m: 2200, description: "Crater rim region with favorable lighting conditions.", nasa_source_url: "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", color: "#FF8C00" },
    { id: "shackleton", name: "Shackleton Rim", lat: -89.9, lon: 0.0, elevation_m: 3500, description: "Rim of Shackleton crater, near-permanent illumination on peaks.", nasa_source_url: "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", color: "#FFD700" },
    { id: "de_gerlache", name: "de Gerlache Rim", lat: -88.5, lon: 78.2, elevation_m: 2800, description: "Rim of de Gerlache crater with extended sunlit periods.", nasa_source_url: "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", color: "#FFA500" },
    { id: "nobile", name: "Nobile Rim", lat: -84.8, lon: 317.5, elevation_m: 1900, description: "Rim of Nobile crater with good Earth visibility.", nasa_source_url: "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", color: "#FF6B00" },
    { id: "connecting_ridge", name: "Connecting Ridge", lat: -85.2, lon: 352.1, elevation_m: 3200, description: "High ridge connecting massifs with near-continuous illumination.", nasa_source_url: "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", color: "#FF4500" },
    { id: "amundsen", name: "Amundsen Rim", lat: -84.5, lon: 82.8, elevation_m: 2100, description: "Rim of Amundsen crater with favorable lighting and Earth view.", nasa_source_url: "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", color: "#E67E22" },
    { id: "leibnitz_beta", name: "Leibnitz Beta Plateau", lat: -85.7, lon: 295.4, elevation_m: 4200, description: "Elevated plateau region with extended sunlit periods.", nasa_source_url: "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", color: "#D35400" }
  ];

  return NextResponse.json({ sites: staticSites, source: "static" });
}

export async function GET_HORIZON(request: Request) {
  const url = new URL(request.url);
  const siteId = url.pathname.split("/").pop() || "";

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/sites/${siteId}/horizon`);
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch (e) {
    console.log("API fetch failed, using static fallback");
  }

  // Static fallback
  try {
    const res = await fetch(`/data/horizon/${siteId}.json`);
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch (e) {
    // Continue to 404
  }

  return NextResponse.json({ error: "Horizon not found" }, { status: 404 });
}