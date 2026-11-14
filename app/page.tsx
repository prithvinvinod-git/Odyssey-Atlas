"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center text-white/50">Loading globe…</div> }
);

const SiteSelector = dynamic(
  () => import("@/components/globe/SiteSelector").then((m) => m.SiteSelector),
  { ssr: false }
);

const TopBar = dynamic(
  () => import("@/components/ui/TopBar").then((m) => m.TopBar),
  { ssr: false }
);

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-space">
        <div className="text-center space-y-4">
          <div className="text-4xl font-display font-light tracking-tight">ODYSSEY ATLAS</div>
          <div className="text-white/50 text-sm">Lunar Landing Site Navigator</div>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-sun to-transparent mx-auto mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <GlobeScene />
      <TopBar />
      <SiteSelector />
    </div>
  );
}