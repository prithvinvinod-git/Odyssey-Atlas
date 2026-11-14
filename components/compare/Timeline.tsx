"use client";

import { useRef, useEffect } from "react";
import type { ComparisonSite, RLESeries } from "@/lib/types";

interface TimelineProps {
  site: ComparisonSite;
  currentTimeIdx: number;
  totalPoints: number;
  stepHours: number;
  height?: number;
}

const SUN_COLOR = "rgba(255, 184, 0, 0.8)";
const EARTH_COLOR = "rgba(0, 212, 255, 0.8)";
const BOTH_COLOR = "rgba(34, 255, 136, 0.9)";

export function Timeline({ site, currentTimeIdx, totalPoints, stepHours = 1, height = 80 }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { series, rle } = site;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const dpi = window.devicePixelRatio || 1;
    canvas.width = 400 * dpi;
    canvas.height = Math.max(height, 80) * dpi;
    ctx.scale(dpi, dpi);

    const w = canvas.width / dpi;
    const h = canvas.height / dpi;

    const rowHeight = h / 3;

    // Clear
    ctx.fillStyle = "rgba(5, 7, 13, 0.85)";
    ctx.fillRect(0, 0, w, h);

    if (!series) return;

    const totalTime = totalPoints * stepHours;

    // Helper to draw RLE segments
    function drawRLESegment(c: CanvasRenderingContext2D, rowIdx: number, rleData: RLESeries, color: string) {
      if (!rleData?.segments) return;

      for (const seg of rleData.segments) {
        if (seg.visible) {
          const x1 = (seg.start / totalPoints) * w;
          const x2 = (seg.end / totalPoints) * w;
          c.fillStyle = color;
          c.fillRect(x1, rowIdx, x2 - x1, rowHeight - 2);
        }
      }
    }

    // Draw Sun row
    drawRLESegment(ctx, 0, rle.sun, SUN_COLOR);

    // Draw Earth row
    drawRLESegment(ctx, rowHeight, rle.earth, EARTH_COLOR);

    // Draw Both row
    drawRLESegment(ctx, rowHeight * 2, rle.both, BOTH_COLOR);

    // Highlight current time with vertical line
    const currentX = (currentTimeIdx / totalPoints) * w;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, h);
    ctx.stroke();

    // Label rows
    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Sun", 5, rowHeight / 2 + 4);
    ctx.fillText("Earth", 5, rowHeight + rowHeight / 2 + 4);
    ctx.fillText("Both", 5, rowHeight * 2 + rowHeight / 2 + 4);

    // Time label
    const timeLabel = `${Math.floor(totalTime / 24)}d`;
    ctx.textAlign = "right";
    ctx.fillText(timeLabel, w - 5, h - 4);
  }, [site, currentTimeIdx, totalPoints, stepHours, height]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={height}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}