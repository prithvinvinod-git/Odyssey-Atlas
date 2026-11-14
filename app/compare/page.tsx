"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { Site } from "@/lib/types";

const TopBar = dynamic(
  () => import("@/components/ui/TopBar").then((m) => m.TopBar),
  { ssr: false }
);

const CompareDashboard = dynamic(
  () => import("@/components/compare/CompareDashboard").then((m) => m.CompareDashboard),
  { ssr: false }
);

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-space">
      <div className="text-center space-y-4">
        <div className="text-4xl font-display font-light tracking-tight">ODYSSEY ATLAS</div>
        <div className="text-white/50 text-sm">Loading comparison data…</div>
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-sun to-transparent mx-auto mt-4" />
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const { sites, selectedSiteIds, limbMode, weights, setComparisonData } = useStore();

  const isInitialMount = useRef(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(async () => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    setLoading(true);
    try {
      // Load sites from static fallback
      const fetchResult = await fetch("/data/sites.json").then(r => r.json());
      const allSites: Site[] = fetchResult.sites || fetchResult;
      useStore.getState().setSites(allSites);

      const selected = allSites.filter((s: Site) => selectedSiteIds.includes(s.id));

      if (selected.length < 2) {
        setLoading(false);
        return;
      }

      // Import engine functions
      const {
        loadEphemerisBinary,
        loadHorizonJson,
        computeVisibility,
        computeMetrics,
        computeScore,
        findBestWindows,
        rleEncode
      } = await import("@/lib/engine");

      // Load ephemeris and horizon data for all selected sites
      const promises = selected.map(async (site: Site) => {
        try {
          const [ephRes, horizonRes] = await Promise.allSettled([
            fetch(`/data/ephemeris/${site.id}.bin`),
            fetch(`/data/horizon/${site.id}.json`)
          ]);

          let ephemeris: any[] = [];
          let horizon: number[] = [];

          if (ephRes.status === "fulfilled" && ephRes.value.ok) {
            const buf = await ephRes.value.arrayBuffer();
            const view = new DataView(buf);
            const n = view.byteLength / 28;
            for (let i = 0; i < n; i++) {
              const off = i * 28;
              ephemeris.push({
                t: view.getFloat64(off, true),
                sun_az: view.getFloat32(off + 8, true),
                sun_el: view.getFloat32(off + 12, true),
                earth_az: view.getFloat32(off + 16, true),
                earth_el: view.getFloat32(off + 20, true),
                sun_radius: view.getFloat32(off + 24, true),
                earth_radius: view.getFloat32(off + 28, true),
              });
            }
          }

          if (horizonRes.status === "fulfilled" && horizonRes.value.ok) {
            const h = await horizonRes.value.json();
            horizon = h.horizon || [];
          }

          return { site, ephemeris, horizon };
        } catch (e) {
          return { site, ephemeris: [], horizon: [] };
        }
      });

      const siteData = await Promise.all(promises);
      const validSites = siteData.filter((d: any) => d.ephemeris.length > 0 && d.horizon.length > 0);

      // Compute comparison results
      const siteResults: any[] = [];
      const stepHours = 1;

      for (const d of validSites) {
        const { site, ephemeris, horizon } = d as { site: Site; ephemeris: any[]; horizon: number[] };

        const horizonMask = {
          site_id: site.id,
          resolution_deg: 1,
          horizon,
          metadata: {
            dem_source: "LOLA",
            dem_resolution_m: 60,
            max_distance_km: 150,
            curvature_radius_km: 1737.4,
            generated_at: new Date().toISOString(),
            sample: false
          }
        };

        const vis = computeVisibility(ephemeris, horizon, limbMode);
        const metrics = computeMetrics(vis, stepHours);
        const totalHours = ephemeris.length * stepHours;
        const score = computeScore(metrics, weights, totalHours);
        const bestWindows = findBestWindows(vis, stepHours, 5).map((w: any) => ({
          start_idx: w.start_idx,
          end_idx: w.end_idx,
          duration_h: w.duration_h,
          sun_el_start: 0,
          earth_el_start: 0,
          sun_margin_deg: 0,
          earth_margin_deg: 0,
        }));

        siteResults.push({
          site,
          horizon: horizonMask,
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

      setComparisonData(siteResults);

    } catch (e) {
      console.error("Failed to load comparison data:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedSiteIds, limbMode, weights, setComparisonData]);

  useEffect(() => {
    if (mounted && isInitialMount.current) {
      loadData();
    }
  }, [mounted, loadData]);

  if (!mounted || loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <CompareDashboard />
      </main>
    </div>
  );
}