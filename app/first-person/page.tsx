"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const FirstPersonView = dynamic(
  () => import("@/components/firstperson/FirstPersonView").then((m) => m.FirstPersonView),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center text-white/50">Loading first-person view…</div> }
);

const TopBar = dynamic(
  () => import("@/components/ui/TopBar").then((m) => m.TopBar),
  { ssr: false }
);

export default function FirstPersonPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-space">
        <div className="text-center space-y-4">
          <div className="text-4xl font-display font-light tracking-tight">FIRST PERSON</div>
          <div className="text-white/50 text-sm">Loading immersive view…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <FirstPersonView />
      </main>
    </div>
  );
}