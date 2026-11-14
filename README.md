# Odyssey Atlas — Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 — "Lunar Landing Site Navigator"

A cinematic, data-driven web app for comparing Artemis candidate landing sites at the lunar south pole. Visualizes real Sun and Earth visibility over true terrain horizons from NASA LOLA elevation data.

## Features

- **Compare Dashboard**: Side-by-side sky views, timeline bars, and score cards for 2–4 sites
- **Best Window Finder**: One-click ranking of optimal Sun+Earth visibility windows
- **3D Moon Globe**: Real-time Sun lighting, site selection, polar fly-to
- **First-Person View**: Immersive site-level view with true horizon occlusion
- **AI Narrator**: Audience-aware (Planner/Educator/Public) TTS narration with synced captions
- **NASA-Only RAG Chat**: Cited answers from NASA sources, refuses off-topic queries

## Architecture

```
Vercel (Next.js Frontend) ←→ Render (FastAPI Backend) ←→ Firestore Spark (Data)
       ↓                                                      ↑
   Vercel CDN (Precomputed Data & Textures) ──────────────────┘
```

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind + Three.js/R3F
- **Backend**: FastAPI on Render free tier with keep-alive
- **Database**: Firestore Spark (sites, NASA corpus, embeddings)
- **Assets**: Vercel CDN (ephemeris binaries, horizon masks, NASA textures)
- **Compute**: Build-time Python pipeline (SPICE ephemeris, LOLA horizon masks)

## Quick Start

```bash
# Frontend
npm install
npm run dev

# Backend (separate terminal)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Build-time data pipeline
pip install -r scripts/requirements.txt
python scripts/compute_ephemeris.py --start 2026-11-01 --end 2027-11-01 --step-hours 1
python scripts/compute_horizon.py --dem data/lola_south_pole.tif --out public/data/horizon
python scripts/build_static_data.py
```

## Deployment

1. Push to GitHub
2. Connect repo to Vercel (frontend) and Render (backend)
3. Set environment variables (see `.env.example`)
4. Run `firebase login` and `node scripts/seed_firestore.mjs` to seed data
5. Deploy Firestore rules: `firebase deploy --only firestore:rules`
6. Add keep-alive ping for Render (cron-job.org / UptimeRobot)

## Data Sources (NASA Only)

- NAIF SPICE kernels (JPL)
- LOLA DEM via Moon Trek / PDS
- Artemis candidate regions (NASA/LPI)
- LRO mission pages, Moon Trek docs, SPICE docs

## Performance

- 60 fps desktop / 30 fps mobile target
- < 300 ms API response (cached)
- Static fallback works without backend
- Quality tiers: Auto/High/Medium/Low

## License

Apache-2.0 — NASA data is public domain; code is Apache-2.0