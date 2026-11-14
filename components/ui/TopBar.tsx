"use client";

import { useStore } from "@/lib/store";

export function TopBar() {
  const { audience, quality, setAudience, setQuality, chatOpen, narratorOpen, setChatOpen, setNarratorOpen } = useStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 glass-panel border-b border-space-border">
      <div className="flex items-center gap-4">
        <span className="text-xl font-display font-light tracking-tight text-white">ODYSSEY ATLAS</span>
        <span className="hidden md:inline-block w-px h-6 bg-space-border" />
        <span className="text-xs text-white/50">Lunar Landing Site Navigator</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as "planner" | "educator" | "public")}
          className="input-field py-1 px-3 text-sm min-w-[120px]"
        >
          <option value="planner">Planner</option>
          <option value="educator">Educator</option>
          <option value="public">Public</option>
        </select>

        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value as "auto" | "high" | "medium" | "low")}
          className="input-field py-1 px-3 text-sm min-w-[100px]"
        >
          <option value="auto">Auto</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`btn-secondary ${chatOpen ? "bg-amber-500/30 border-amber-500/50" : ""}`}
          aria-label="Toggle chat"
        >
          💬 Chat
        </button>

        <button
          onClick={() => setNarratorOpen(!narratorOpen)}
          className={`btn-secondary ${narratorOpen ? "bg-amber-500/30 border-amber-500/50" : ""}`}
          aria-label="Toggle narrator"
        >
          🔊 Narrator
        </button>

        <button className="btn-secondary" aria-label="Credits">
          📋 Credits
        </button>

        <button className="btn-secondary" aria-label="Mute">
          🔇
        </button>
      </div>
    </header>
  );
}