import { NextResponse } from "next/server";
import type { NarrateRequest, NarrateResponse, ComparisonSite, Audience } from "@/lib/types";

function _templateNarration(sites: ComparisonSite[], audience: Audience): NarrateResponse {
  if (!sites || sites.length === 0) {
    return { sentences: [], text: "", source: "template" };
  }

  const top = sites.reduce((best, s) =>
    (s.score?.total || 0) > (best.score?.total || 0) ? s : best,
    sites[0]
  );

  const topName = top.site?.name || "this site";
  const topScore = top.score?.total || 0;
  const sunlitVals = sites.map(s => s.metrics?.sunlit_pct || 0);
  const earthVals = sites.map(s => s.metrics?.earth_visible_h || 0);

  let text: string;
  if (audience === "planner") {
    text = `Comparison complete for ${sites.length} sites. ${topName} leads with score ${topScore}. Sunlit range: ${Math.min(...sunlitVals).toFixed(1)}%-${Math.max(...sunlitVals).toFixed(1)}%. Earth visibility: ${Math.min(...earthVals).toFixed(1)}h-${Math.max(...earthVals).toFixed(1)}h.`;
  } else if (audience === "educator") {
    text = `We analyzed ${sites.length} candidate landing sites near the Moon's south pole. The Sun and Earth rise and set behind crater rims, creating visibility windows. ${topName} offers the best balance with ${topScore} points.`;
  } else {
    const topMetrics = top.metrics || {};
    text = `${topName} looks like the best Moon landing spot — it gets ${(topMetrics.sunlit_pct || 0).toFixed(0)}% sunlight and can see Earth for ${(topMetrics.earth_visible_h || 0).toFixed(0)} hours. Each site has its own quirks from crater shadows.`;
  }

  const sentences = text.split(". ").map(s => s.trim()).filter(s => s.length > 0);

  return { sentences, text: text + ". ", source: "template" };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { context, audience = "public" } = body as {
      context: { sites?: ComparisonSite[]; audience?: Audience };
      audience?: Audience;
    };

    if (!context?.sites || context.sites.length === 0) {
      return NextResponse.json({ sentences: ["No comparison data available."], text: "No comparison data available.", source: "template" });
    }

    const response = _templateNarration(context.sites, audience as Audience);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Narration error:", error);
    return NextResponse.json({ sentences: [], text: "", source: "template" });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST for /narrate" });
}