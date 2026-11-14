"use client";

import { useStore } from "@/lib/store";

export function SiteSelector() {
  const { sites, selectedSiteIds, toggleSite } = useStore();

  return (
    <aside className="fixed left-4 top-24 bottom-4 z-30 w-72 glass-panel overflow-y-auto border-space-border">
      <div className="p-4 space-y-3">
        <h3 className="font-display font-medium text-white">Landing Sites</h3>
        <p className="text-xs text-white/50">Select up to 4 sites to compare</p>
        <div className="space-y-2">
          {sites.map((site) => (
            <label
              key={site.id}
              className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedSiteIds.includes(site.id)}
                onChange={() => toggleSite(site.id)}
                disabled={!selectedSiteIds.includes(site.id) && selectedSiteIds.length >= 4}
                className="w-4 h-4 accent-amber-500"
              />
              <div
                className="w-3 h-3 rounded-full border-2 flex-shrink-0"
                style={{ borderColor: site.color, backgroundColor: selectedSiteIds.includes(site.id) ? site.color : "transparent" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{site.name}</p>
                <p className="text-xs text-white/50 truncate">
                  {site.lat.toFixed(1)}°S, {site.lon.toFixed(1)}°E
                </p>
              </div>
            </label>
          ))}
        </div>
        <button className="btn-primary w-full mt-4" disabled={selectedSiteIds.length < 2}>
          Compare Selected ({selectedSiteIds.length}/4)
        </button>
      </div>
    </aside>
  );
}