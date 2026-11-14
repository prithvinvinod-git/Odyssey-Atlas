"use client";

import { useStore } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import { SkyView } from "./SkyView";
import { Timeline } from "./Timeline";

export function CompareDashboard() {
  const { selectedSiteIds, sites, comparisonData, playbackTimeIdx, isPlaying, playbackSpeed } = useStore();
  const selectedSites = sites.filter((s) => selectedSiteIds.includes(s.id));

  // Calculate total points from first site's data
  const totalPoints = comparisonData && comparisonData.length > 0
    ? comparisonData[0].metrics?.sunlit_pct ? 8760 : 0
    : 0;

  // Animation frame handling
  const animationRef = useRef<number>(undefined);
  const lastTimeRef = useRef<number>(undefined);

  useEffect(() => {
    if (!isPlaying || !comparisonData || totalPoints === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      return;
    }

    const animate = (currentTime: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = currentTime;

      const deltaTime = (currentTime - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = currentTime;

      useStore.setState((prev) => ({
        playbackTimeIdx: Math.min(
          prev.playbackTimeIdx + Math.floor(deltaTime * playbackSpeed * 60 / 60), // hours per frame at playback speed
          totalPoints - 1
        ),
        isPlaying: true
      }));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, comparisonData, totalPoints]);

  if (selectedSites.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-white/50 p-8">
        <div className="text-center space-y-4">
          <div className="text-2xl font-display font-light">No Sites Selected</div>
          <p className="max-w-md">Select 2–4 landing sites from the globe view, then press Compare.</p>
        </div>
      </div>
    );
  }

  if (!comparisonData || comparisonData.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-white/50">
        <div className="animate-pulse">Computing comparison...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Controls */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => useStore.getState().setPlaybackTimeIdx(0)}
          >
            ⟲ Reset
          </button>
          <button
            className="btn-secondary"
            onClick={() => useStore.getState().setIsPlaying(!isPlaying)}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
        </div>

        <div className="text-xs text-white/60">
          Time: {Math.floor(playbackTimeIdx / 24)}d {playbackTimeIdx % 24}h / {Math.floor(totalPoints / 24)}d {(totalPoints % 24)}h
        </div>
      </div>

      {/* Columns per site */}
      <div className="flex-1 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[800px]">
          {selectedSites.map((site, siteIdx) => {
            const cd = comparisonData.find(d => d.site.id === site.id);
            if (!cd) return null;

            return (
              <div key={site.id} className="glass-panel p-4 flex flex-col gap-3">
                {/* Site Header */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: site.color }}
                  />
                  <div>
                    <p className="font-medium text-white text-sm truncate">{site.name}</p>
                    <p className="text-xs text-white/50">{site.lat.toFixed(1)}°S, {site.lon.toFixed(1)}°E</p>
                  </div>
                </div>

                {/* Sky View */}
                <div className="relative">
                  <SkyView
                    site={cd}
                    currentTimeIdx={playbackTimeIdx}
                    totalPoints={totalPoints}
                    color={site.color}
                  />
                </div>

                {/* Timeline */}
                <div className="h-20">
                  <Timeline
                    site={cd}
                    currentTimeIdx={playbackTimeIdx}
                    totalPoints={totalPoints}
                    stepHours={1}
                    height={60}
                  />
                </div>

                {/* Metrics */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-amber-400">Sunlit</span>
                    <span className="font-mono">{cd.metrics.sunlit_pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cyan-400">Earth</span>
                    <span className="font-mono">{cd.metrics.earth_visible_h.toFixed(0)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-400">Darkness</span>
                    <span className="font-mono">{cd.metrics.longest_darkness_h.toFixed(0)}h</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-1">
                    <span className="text-green-400 font-medium">Score</span>
                    <span className="font-mono font-bold text-green-300">{cd.score.total.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-xs text-white/60">
          <div className="flex gap-4">
            <button className="btn-secondary">Best Window Finder ⏱</button>
            <button className="btn-secondary">Toggle Limb Mode</button>
            <button className="btn-secondary">Export CSV</button>
          </div>
        </div>
      </div>
    </div>
  );
}