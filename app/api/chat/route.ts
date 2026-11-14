import { NextResponse } from "next/server";
import type { ChatRequest, ChatResponseChunk, SourceCitation } from "@/lib/types";

// NASA-only guardrail domains
const ALLOWED_DOMAINS = [
  "nasa.gov", "jpl.nasa.gov", "pds.nasa.gov", "naif.jpl.nasa.gov",
  "trek.nasa.gov", "lroc.sese.asu.edu", "solarsystem.nasa.gov",
];

function _isNasaRelated(text: string): boolean {
  const textLower = text.toLowerCase();
  const keywords = [
    "nasa", "moon", "lunar", "artemis", "lola", "spice", "jpl",
    "landing", "sun", "earth", "horizon", "crater", "south pole",
    "visibility", "power", "communication", "site", "candidate", "mission",
    "lunar reconnaissance", "orbiter", "lroc", "pds"
  ];
  return keywords.some(kw => textLower.includes(kw));
}

function _isAllowedUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  return ALLOWED_DOMAINS.some(domain => urlLower.includes(domain));
}

function _getSources(urls: string[], baseTitle: string): SourceCitation[] {
  return urls.filter(_isAllowedUrl).map(url => ({
    url,
    title: baseTitle,
    domain: url.split("//")[1]?.split("/")[0] || "unknown",
  }));
}

async function* _generateChat(request: ChatRequest): AsyncGenerator<ChatResponseChunk> {
  const userMsg = request.messages?.[request.messages.length - 1]?.content || "";

  if (!_isNasaRelated(userMsg)) {
    yield { type: "text", content: "I can only answer questions about NASA lunar missions, landing sites, and the data in Odyssey Atlas. Try asking about Artemis landing sites, LOLA elevation data, or Sun/Earth visibility." };
    yield { type: "done" };
    return;
  }

  const msgLower = userMsg.toLowerCase();

  if (msgLower.includes("why does earth disappear") || msgLower.includes("earth drop")) {
    const response = "Earth drops below the horizon at the lunar south pole because the Moon's rotation and local terrain (crater rims, mountains) block line of sight. At the poles, Earth appears to move in a small circle due to libration. When it dips behind a ridge, direct-to-Earth communication is lost.";
    yield { type: "text", content: response + " " };
    yield { type: "sources", sources: _getSources([
      "https://www.nasa.gov/mission_pages/LRO/science/lro-lola.html",
      "https://trek.nasa.gov/moon/"
    ], "NASA Source") };
  } else if (msgLower.includes("longest sunlight") || msgLower.includes("most sun")) {
    const response = "Sites on high-elevation ridges like Connecting Ridge or Malapert Massif get the longest continuous sunlight because they rise above crater-rim shadows. The exact duration depends on date range and local terrain.";
    yield { type: "text", content: response + " " };
    yield { type: "sources", sources: _getSources([
      "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions"
    ], "NASA Source") };
  } else if (msgLower.includes("what is lola") || msgLower.includes("lola")) {
    const response = "LOLA (Lunar Orbiter Laser Altimeter) is a NASA instrument on the Lunar Reconnaissance Orbiter that maps the Moon's topography by bouncing laser pulses off the surface. It provides the elevation data for calculating true horizon profiles for landing site analysis.";
    yield { type: "text", content: response + " " };
    yield { type: "sources", sources: _getSources([
      "https://lroc.sese.asu.edu/lola/",
      "https://www.nasa.gov/mission_pages/LRO/science/lro-lola.html"
    ], "NASA Source") };
  } else if (msgLower.includes("horizon") || msgLower.includes("visibility")) {
    const response = "The horizon profile at each landing site is computed from LODA elevation data, accounting for lunar curvature. A body (Sun or Earth) is visible when its upper limb rises above the local horizon angle defined by terrain. This determines power availability and communication windows.";
    yield { type: "text", content: response + " " };
    yield { type: "sources", sources: _getSources([
      "https://trek.nasa.gov/moon/",
      "https://www.jpl.nasa.gov/space-times"
    ], "NASA Source") };
  } else {
    const response = "I can help with questions about Artemis landing sites, Sun/Earth visibility windows, LOLA elevation data, SPICE ephemeris, or lunar mission planning near the south pole. What would you like to know?";
    yield { type: "text", content: response + " " };
  }

  yield { type: "done" };
}

async function* chatGenerator() {
  const encoder = new TextEncoder();
  yield* (async function* () {
    // This is a placeholder - actual streaming handled differently
  })();
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const chatRequest: ChatRequest = body;

  const chunks: string[] = [];

  for await (const chunk of _generateChat(chatRequest)) {
    chunks.push(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  return new Response(chunks.join(""), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return NextResponse.json({ message: "Use POST for /chat" });
}