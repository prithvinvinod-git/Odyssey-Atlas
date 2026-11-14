import type { ComparisonResult, Site, HorizonMask, BothWindow, NarrateRequest, NarrateResponse, ChatMessage, ChatResponseChunk, Metrics, ScoreBreakdown } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const USE_STATIC = process.env.NEXT_PUBLIC_USE_STATIC_DATA === "true";

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchManifest(): Promise<any> {
  if (USE_STATIC || !API_BASE) {
    const res = await fetch("/data/manifest.json");
    if (!res.ok) throw new Error("Failed to load static manifest");
    return res.json();
  }
  const res = await fetchWithTimeout(`${API_BASE}/manifest`);
  if (!res.ok) throw new Error(`Manifest request failed: ${res.status}`);
  return res.json();
}

export async function fetchSites(): Promise<Site[]> {
  if (USE_STATIC || !API_BASE) {
    const res = await fetch("/data/sites.json");
    if (!res.ok) throw new Error("Failed to load static sites");
    return res.json();
  }
  const res = await fetchWithTimeout(`${API_BASE}/sites`);
  if (!res.ok) throw new Error(`Sites request failed: ${res.status}`);
  return res.json();
}

export async function fetchHorizon(siteId: string): Promise<HorizonMask> {
  if (USE_STATIC || !API_BASE) {
    const res = await fetch(`/data/horizon/${siteId}.json`);
    if (!res.ok) throw new Error(`Failed to load static horizon for ${siteId}`);
    return res.json();
  }
  const res = await fetchWithTimeout(`${API_BASE}/sites/${siteId}/horizon`);
  if (!res.ok) throw new Error(`Horizon request failed: ${res.status}`);
  return res.json();
}

export async function fetchComparison(params: {
  site_ids: string[];
  start: string;
  end: string;
  step_hours: number;
  limb: "upper" | "center";
  weights?: Record<string, number>;
}): Promise<ComparisonResult> {
  if (USE_STATIC || !API_BASE) {
    throw new Error("Static fallback: comparison must be computed client-side");
  }
  const res = await fetchWithTimeout(`${API_BASE}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }, 15000);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Comparison failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchBestWindows(siteId: string, start: string, end: string): Promise<BothWindow[]> {
  if (USE_STATIC || !API_BASE) {
    throw new Error("Static fallback: best windows must be computed client-side");
  }
  const res = await fetchWithTimeout(`${API_BASE}/best-windows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site_id: siteId, start, end }),
  }, 10000);
  if (!res.ok) throw new Error(`Best windows failed: ${res.status}`);
  return res.json();
}

export async function fetchNarration(request: NarrateRequest): Promise<NarrateResponse> {
  if (USE_STATIC || !API_BASE) {
    return { sentences: [], text: "Narration unavailable in static mode.", source: "template" };
  }
  const res = await fetchWithTimeout(`${API_BASE}/narrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  }, 30000);
  if (!res.ok) throw new Error(`Narration failed: ${res.status}`);
  return res.json();
}

export async function* streamChat(
  messages: ChatMessage[],
  context?: { sites?: any[]; current_time_idx?: number }
): AsyncGenerator<ChatResponseChunk> {
  if (USE_STATIC || !API_BASE) {
    yield { type: "text", content: "Chat unavailable in static mode." };
    yield { type: "done" };
    return;
  }
  const res = await fetchWithTimeout(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
  }, 60000);

  if (!res.ok) {
    yield { type: "error", error: `Chat failed: ${res.status}` };
    yield { type: "done" };
    return;
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) {
    yield { type: "error", error: "No response stream" };
    yield { type: "done" };
    return;
  }

  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const chunk = JSON.parse(line.slice(6));
            yield chunk;
            if (chunk.type === "done") return;
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  yield { type: "done" };
}

export function buildShareUrl(params: {
  site_ids: string[];
  start: string;
  end: string;
  step_hours: number;
  audience: string;
  limb: string;
  weights?: Record<string, number>;
}): string {
  const search = new URLSearchParams();
  search.set("sites", params.site_ids.join(","));
  search.set("start", params.start);
  search.set("end", params.end);
  search.set("step", params.step_hours.toString());
  search.set("audience", params.audience);
  search.set("limb", params.limb);
  if (params.weights) search.set("weights", JSON.stringify(params.weights));
  return `${window.location.origin}/compare?${search.toString()}`;
}

export function parseShareUrl(search: string): Partial<{
  site_ids: string[];
  start: string;
  end: string;
  step_hours: number;
  audience: string;
  limb: "upper" | "center";
  weights: Record<string, number>;
}> {
  const params = new URLSearchParams(search);
  return {
    site_ids: params.get("sites")?.split(",") || [],
    start: params.get("start") || "",
    end: params.get("end") || "",
    step_hours: parseInt(params.get("step") || "1", 10),
    audience: params.get("audience") || "public",
    limb: (params.get("limb") as "upper" | "center") || "upper",
    weights: params.get("weights") ? JSON.parse(params.get("weights")!) : undefined,
  };
}