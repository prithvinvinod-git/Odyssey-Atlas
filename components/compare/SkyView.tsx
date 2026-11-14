"use client";

import { useRef, useEffect } from "react";
import type { ComparisonSite } from "@/lib/types";

interface SkyViewProps {
  site: ComparisonSite;
  currentTimeIdx: number;
  totalPoints: number;
  color: string;
}

export function SkyView({ site, currentTimeIdx, totalPoints, color }: SkyViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { horizon, series } = site;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const dpi = window.devicePixelRatio || 1;
    canvas.width = 280 * dpi;
    canvas.height = 280 * dpi;
    ctx.scale(dpi, dpi);

    const width = canvas.width / dpi;
    const height = canvas.height / dpi;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Clear
    ctx.fillStyle = "rgba(5, 7, 13, 0.85)";
    ctx.fillRect(0, 0, width, height);

    // Draw horizon silhouette from 360° mask
    const horizonValues = horizon?.horizon || [];
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const azRad = (i / 360) * 2 * Math.PI;
      const h = horizonValues[i] || 0;
      const r = radius + h * (radius / 5);
      const x = centerX + r * Math.cos(azRad + Math.PI);
      const y = centerY + r * Math.sin(azRad + Math.PI);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(50, 50, 50, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 100, 100, 0.5)";
    ctx.stroke();

    // Draw Sun position
    if (series && series.sun && series.sun.length > currentTimeIdx) {
      const sunVisible = series.sun[currentTimeIdx] === 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = sunVisible ? "rgba(255, 184, 0, 0.9)" : "rgba(100, 50, 0, 0.5)";
      ctx.fill();
    }

    // Draw N/S/E/W labels
    ctx.fillStyle = "rgba(200, 200, 200, 0.6)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("N", centerX, centerY - radius - 8);
    ctx.fillText("S", centerX, centerY + radius + 8);

    ctx.save();
    ctx.translate(centerX - radius - 12, centerY);
    ctx.rotate(-90 * Math.PI / 180);
    ctx.fillText("E", 0, 0);
    ctx.restore();

    ctx.translate(centerX + radius + 12, centerY);
    ctx.fillText("W", 0, 0);

    // Elevation rings
    ctx.strokeStyle = "rgba(100, 100, 100, 0.2)";
    ctx.setLineDash([2, 2]);
    for (let r = 30; r < radius; r += 30) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.setLineDash([]);

  }, [site, currentTimeIdx, totalPoints]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={280}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}