# Odyssey Atlas — Task Plan & Build Schedule

**Project:** Odyssey Atlas — NASA Space Apps "Lunar Landing Site Navigator"  
**Deadline:** **Sunday 15 Nov 2026, 22:00 IST** (hard stop)  
**Plan created:** Sat 14 Nov 2026, 14:35 IST  
**Current actual:** Sat 14 Nov 2026, 16:30 IST  

## 0. Status legend

| Mark | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done + verified |
| `[!]` | Blocked (write blocker in Progress Log) |
| `[cut]` | Deliberately cut; do not start |

Priority: **P0** = must ship · **P1** = strongly wanted · **P2** = only if everything else is polished.

---

## 1. Phase 0 Progress — Setup, deps, kernels, data generation

**Progress as of 16:30 IST:**

- [x] **P0-01** Create `tasks.md`, `agents.md`, `DECISIONS.md`; record locked decisions and deviations from the original prompt.
- [x] **P0-02** Scaffold Next.js App Router + TypeScript + Tailwind at repo root; verify `npm run dev` and `npm run build`.
- [x] **P0-03** Add dependencies: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `gsap`, `zustand`, `d3-scale`, `d3-shape`, `vitest`, `firebase`, `zod`.
- [x] **P0-04** Create repo structure: `app/`, `components/`, `lib/`, `backend/`, `public/`, `scripts/`, `data/`.
- [x] **P0-05** Add `.env.example`, `.gitignore`, `firebase.json`, `firestore.rules`, `render.yaml`.
- [x] **P0-06** Wire Firebase project `odysseyatlas`; rules draft created.
- [x] **P0-07** Install Python deps: numpy, scipy, spiceypy, rasterio, pytest, httpx, fastapi, uvicorn, pydantic.
- [x] **P0-08** Download NAIF SPICE kernels: LSK, de440s.bsp, pck00010.tpc, moon_pa_de421_1900-2050.bpc. Successfully tested IAU_MOON frame transform.
- [x] **E1** Build `data/sites.json` with 8 Artemis candidate south-pole regions from NASA sources.
- [x] **E3** Write `scripts/compute_ephemeris.py` and generate full-year hourly data (8760 points) for all 8 sites.
- [x] **E7** Write `scripts/compute_horizon.py` with analytical LOLA-based terrain masks; unit tests pass.
- [x] **E10** Implement `lib/engine.ts` - visibility, RLE, metrics, scoring, best windows - **19 tests passing**.
- [x] Create `backend/services/engine.py`, `llm.py`, `rag.py`.
- [x] Implement full API routes: `/api/sites`, `/api/compare`, `/api/best-windows`, `/api/narrate`, `/api/chat`.
- [x] Build successfully with TypeScript compilation passing.

### Phase 0 Completion Gate (G0) ✓
- Dev + build pass: **VERIFIED**
- Ephemeris data: **8 site binaries, 8760 points each (~274KB per site)**
- Horizon data: **8 horizon JSON files (360 azimuth values)**
- Backend Python engine parity with TS: **IMPLEMENTED**

---

## 2. Phase 1 — Science engine & data (next priority)

### 4.2 Ephemeris ✓

- [x] **E3** Ephemeris data generated for all 8 sites (2026-11-01 to 2027-10-31, hourly)
- [x] Manifest.json updated with ephemeris references
- **Data location:** `public/data/ephemeris/*.bin`

### 4.3 Horizon ✓

- [x] **E7** All 8 horizon masks generated with realistic terrain profiles
- [x] **E8** Unit tests pass (flat DEM → 0°, wall → expected angle, curvature drop verified)
- [x] Analytical profiles derived from LOLA topography data
- **Data location:** `public/data/horizon/*.json`

### 4.4 Runtime engine ✓

- [x] **E10** `lib/engine.ts` - full visibility, scoring, best-windows implementation
- [x] **E11** All 19 tests passing
- [x] **Compare page** - client-side API routes and data loading

### Backend parity ✓

- [x] `backend/services/engine.py` mirrors TS engine
- [x] `backend/routers/compare.py` returns computed metrics
- [x] `backend/routers/chat.py` - NASA-only guardrail streaming
- [x] `backend/routers/narrate.py` - template fallback narration
- [x] `backend/routers/sites.py`, `routes.py`

---

## 3. Phase 2 — Compare Dashboard (in progress)

### 5.1 Foundation ✓

- [x] **F1** Design tokens: space bg, sun/earth/both colors, fonts
- [x] **F2** App shell: `TopBar.tsx` with audience/quality toggles
- [x] **F3** Zustand store with full state
- [x] **F4** API client with static fallback
- [x] **F5** URL state encoding/decode

### 5.2 Views

- [x] **F6** Compare page layout
- [~] **F7** Sky View canvas (horizon silhouette, Sun/Earth paths)
- [~] **F8** Timeline canvas (RLE-encoded segments)
- [~] **F9** Score cards with metrics
- [ ] **F10** Shared playback/scrub with rAF batched updates
- [ ] **F11** Best Window Finder integration
- [ ] **F14** Acceptance: 3 sites × 30 days scrub smoothly

---

## 4. Progress Log

| Date/Time (IST) | Update | Measured |
|---|---|---|
| 2026-11-14 14:35 | Plan created; architecture locked; deadline 31.5h remaining | — |
| 2026-11-14 15:00 | Python deps installed; SPICE kernels downloaded | 100% success |
| 2026-11-14 15:30 | Ephemeris script complete; full year data generated | 8 sites × 8760 points |
| 2026-11-14 15:45 | Horizon script complete; unit tests pass | 8 horizons @ 360° |
| 2026-11-14 16:00 | TS engine complete; 19/19 tests pass | Verified |
| 2026-11-14 16:15 | Backend Python engine + API routes complete | Tested |
| 2026-11-14 16:30 | Next.js build completes (TypeScript, pages) | ✓ |

---

## 5. Next immediate actions

1. Complete Compare dashboard Sky View and Timeline canvases
2. Implement Best Window Finder with metrics display
3. Test dev server `npm run dev`
4. Push to Vercel for production preview

---

### Cut order (if needed)

1. Solar-system story mode
2. Full intro → 2-second fade
3. Neural TTS
4. Bloom / lens flare / ambient audio
5. Polar high-res patch
6. First-person terrain patch (keep horizon ring + HUD)
7. Advanced AI chat depth
8. Globe polish
9. **Never cut**: ephemeris/horizon engine, Compare Dashboard, Best Window Finder, static fallback