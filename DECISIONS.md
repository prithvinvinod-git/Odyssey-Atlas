# DECISIONS.md — Architecture & Implementation Decisions

**Project**: Odyssey Atlas — NASA Space Apps "Lunar Landing Site Navigator"  
**Date**: 2026-11-14  
**Updated**: Each decision recorded at time of choice.

---

## 001 — Runtime Architecture: Vercel + Render + Firestore

**Date**: 2026-11-14  
**Status**: Accepted

### Context
The original build prompt specifies FastAPI + local ChromaDB. User constraints: free tier only, everything online, nothing running locally at demo time.

### Decision
- **Frontend**: Next.js 15 on Vercel Hobby
- **Backend**: FastAPI on Render free tier (750 h/mo) with 10-min keep-alive ping
- **Database**: Firestore Spark (sites, NASA corpus, embeddings) — read-only public rules
- **Assets**: Vercel CDN (`/public/data`, `/public/textures`) — immutable cache headers
- **Compute**: Build-time Python pipeline (SPICE, LOLA) → static files committed to repo

### Rationale
- Firebase Spark cannot run backend code (Cloud Functions/Cloud Run require Blaze)
- Firebase Hosting Spark is static-only (no Next.js SSR)
- Render free provides persistent Python process for RAG caching
- Vercel CDN avoids Firestore 1 MiB/doc limit for ephemeris/horizon data
- Dashboard computes locally (`lib/engine.ts`) for 60 fps scrubbing + static fallback

### Trade-offs
- Two deployments (Vercel + Render) instead of one
- Render cold starts (mitigated by keep-alive + static fallback)
- CORS configuration required
- Extra ~2–3 h setup time (timeboxed to 90 min)

---

## 002 — Dashboard Computes Locally; API is Authoritative but Optional

**Date**: 2026-11-14  
**Status**: Accepted

### Context
Compare Dashboard needs 60 fps scrubbing. Network latency to Render would break this.

### Decision
- `lib/engine.ts` implements full visibility/metrics/scoring in TypeScript
- Precomputed `.bin`/`.json` served from Vercel CDN
- Dashboard reads static data directly for instant scrubbing
- Render API (`/compare`, `/best-windows`) used for parity/narration/chat context
- `NEXT_PUBLIC_USE_STATIC_DATA=true` disables all API calls

### Rationale
- User experience: scrubbing must be instant and smooth
- Resilience: demo works even if Render is down/cold
- Performance: no network in the hot path

---

## 003 — NASA-Only Data & RAG Guardrails

**Date**: 2026-11-14  
**Status**: Accepted

### Context
Challenge requires NASA-only sources. LLM must not hallucinate or cite non-NASA URLs.

### Decision
- Corpus: 12–20 NASA pages only (Artemis, LOLA, Moon Trek, SPICE, LRO)
- Allowed domains: `nasa.gov`, `jpl.nasa.gov`, `pds.nasa.gov`, `naif.jpl.nasa.gov`, `trek.nasa.gov`, `lroc.sese.asu.edu`
- Retrieval: top-k cosine (embeddings) + keyword fallback; relevance threshold
- Response: only from retrieved chunks + live computed context
- Refuse: empty retrieval, off-topic, non-NASA URLs, speculation
- Prompt injection defense: treat retrieved text as data only

---

## 004 — Python Engine Parity with TypeScript

**Date**: 2026-11-14  
**Status**: Accepted

### Context
Render FastAPI must return identical results to client-side engine for consistency.

### Decision
- `backend/services/engine.py` mirrors `lib/engine.ts` formulas exactly
- Both load same `.bin`/`.json` assets from `public/data`
- Parity test: identical metrics for fixed request (tolerance 1e-6)
- Shared test cases in Vitest + pytest

---

## 005 — LLM Provider Abstraction with Fallbacks

**Date**: 2026-11-14  
**Status**: Accepted

### Context
User will provide Gemini/Groq/OpenRouter keys. Demo must work without keys.

### Decision
- Single OpenAI-compatible adapter (`backend/services/llm.py`)
- Env-driven: `LLM_PROVIDER` (gemini|groq|openrouter|none), `LLM_MODEL`
- No key → deterministic template narration + keyword RAG fallback
- Keys stored in Render env vars only, never in repo

---

## 006 — TTS: Browser Web Speech API Only

**Date**: 2026-11-14  
**Status**: Accepted

### Context
No budget for paid TTS. Must work offline after page load.

### Decision
- Use `speechSynthesis` (Web Speech API)
- Word-level highlighting via `onboundary` events
- Voice selection: best available English voice
- Captions always on (accessibility)
- No neural TTS (ElevenLabs) — would require pre-generated audio files

---

## 007 — Data Fallback: Lower-Res Real LOLA, Labeled Synthetic Last Resort

**Date**: 2026-11-14  
**Status**: Accepted

### Context
Full-resolution LOLA DEM may be too large/slow to download and process in time.

### Decision
1. Primary: Real LOLA south polar product (60–120 m/px target)
2. Fallback: Lower-resolution real LOLA product (label resolution in UI)
3. Last resort: Synthetic terrain masks, clearly labeled "sample" in UI and code
4. Never present synthetic as real

---

## 008 — Firestore Seeding via CLI, No Service Account at Runtime

**Date**: 2026-11-14  
**Status**: Accepted

### Context
Runtime only needs public reads. Seeding needs admin write once.

### Decision
- User runs `firebase login` once
- `node scripts/seed_firestore.mjs` uses web config + REST
- Deploy read-only rules via `firebase deploy --only firestore:rules`
- No service-account JSON in repo or client bundle
- Runtime uses public Firestore REST (or bundled JSON fallback)

---

## 009 — Quality Tiers & Performance Budget

**Date**: 2026-11-14  
**Status**: Accepted

### Context
Must hit 60 fps desktop / 30 fps mobile on integrated graphics.

### Decision
| Tier | Postprocessing | DPR | Features |
|------|----------------|-----|----------|
| High | Bloom + vignette | 2 | Polar patch, flares |
| Medium | Bloom | 1.5 | — |
| Low | None | 1 | Simplified materials, fade intro |
| Auto | Adaptive | 1–2 | `PerformanceMonitor` + `AdaptiveDpr` |

- `frameloop="demand"` for static scenes
- No per-frame allocations in `useFrame`
- Draw calls < 100; meshes < 200k triangles
- Textures: KTX2/Basis, max 4K Moon, 2K displacement, 1K Earth

---

## 010 — Cut Order (Enforced)

**Date**: 2026-11-14  
**Status**: Accepted

If behind schedule, cut in this order:
1. Solar-system story mode
2. Full intro → 2-second fade
3. Neural TTS
4. Bloom / lens flare / ambient audio
5. Polar high-res patch
6. First-person terrain patch (keep horizon ring + HUD)
7. Advanced AI chat depth (keep extractive fallback + template narration)
8. Globe polish (keep basic globe + site selection)
9. **Never cut**: ephemeris/horizon engine, Compare Dashboard, Best Window Finder, static fallback, credits

---

## 011 — Demo Date Range

**Date**: 2026-11-14  
**Status**: Tentative

Precompute: 2026-11-01 → 2027-11-01 (1 lunar year), hourly.  
Default demo window: a 30-day range with compelling Earthrise/Sunrise events (TBD after inspecting real data).

---

*End of decisions. Add new decisions above this line with incrementing numbers.*