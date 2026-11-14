"use client";

import { useStore } from "@/lib/store";

export function FirstPersonView() {
  const { selectedSiteIds, sites } = useStore();
  const site = sites.find((s) => selectedSiteIds.includes(s.id));

  if (!site) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-white/50 p-8">
        <div className="text-center space-y-4">
          <div className="text-2xl font-display font-light">No Site Selected</div>
          <p className="max-w-md">Select a site from the globe view to enter first-person mode.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8">
      <div className="glass-panel p-8 max-w-2xl w-full space-y-6 border-l-4" style={{ borderColor: site.color }}>
        <div className="text-center">
          <p className="text-xs text-white/50 uppercase tracking-wider">First Person View</p>
          <h2 className="text-3xl font-display font-light text-white mt-1">{site.name}</h2>
          <p className="text-sm text-white/60 mt-1">{site.lat.toFixed(1)}°S, {site.lon.toFixed(1)}°E • {site.elevation_m}m elevation</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 text-center">
            <p className="text-xs text-white/50 uppercase tracking-wider">Sun Azimuth</p>
            <p className="text-2xl font-mono text-amber-400 mt-1">—°</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-xs text-white/50 uppercase tracking-wider">Sun Elevation</p>
            <p className="text-2xl font-mono text-amber-400 mt-1">—°</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-xs text-white/50 uppercase tracking-wider">Earth Azimuth</p>
            <p className="text-2xl font-mono text-cyan-400 mt-1">—°</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-xs text-white/50 uppercase tracking-wider">Earth Elevation</p>
            <p className="text-2xl font-mono text-cyan-400 mt-1">—°</p>
          </div>
        </div>

        <div className="glass-panel p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-white/70">Sun Visibility</span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/50">UNKNOWN</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/70">Earth Visibility</span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/50">UNKNOWN</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary flex-1">← Previous Event</button>
          <button className="btn-primary flex-1">Next Event →</button>
        </div>

        <p className="text-xs text-white/40 text-center">
          Time scrubber and immersive 3D view coming in Phase 3
        </p>
      </div>
    </div>
  );
}