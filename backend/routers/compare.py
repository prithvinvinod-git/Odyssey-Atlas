from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import json
from pathlib import Path

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent / "public" / "data"
from services import engine


class CompareRequest(BaseModel):
    site_ids: List[str]
    start: str
    end: str
    step_hours: int = Field(ge=1, le=6, default=1)
    limb: str = Field(pattern="^(upper|center)$", default="upper")
    weights: Optional[dict] = None


class CompareResponse(BaseModel):
    meta: dict
    sites: List[dict]


@router.post("/compare", response_model=CompareResponse)
async def compare_sites(request: CompareRequest):
    """Compare visibility metrics for selected sites."""
    manifest_path = DATA_DIR / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Manifest not found")

    with open(manifest_path) as f:
        manifest = json.load(f)

    # Validate site IDs
    available_sites = {s["id"] for s in manifest.get("sites", [])}
    invalid = [sid for sid in request.site_ids if sid not in available_sites]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid site IDs: {invalid}")

    # Load sites metadata
    with open(DATA_DIR / "sites.json") as f:
        all_sites = {s["id"]: s for s in json.load(f)}

    # Load horizon masks
    horizons = {}
    for sid in request.site_ids:
        h_path = DATA_DIR / "horizon" / f"{sid}.json"
        if h_path.exists():
            with open(h_path) as f:
                horizons[sid] = json.load(f)

    # Load ephemeris and compute visibility
    sites_results = []
    for site_id in request.site_ids:
        eph_path = DATA_DIR / "ephemeris" / f"{site_id}.bin"
        if not eph_path.exists():
            continue

        ephemeris = engine.load_ephemeris_file(eph_path)
        horizon = horizons.get(site_id, {}).get("horizon", [])
        if not horizon:
            continue

        sun_vis, earth_vis, both_vis = engine.compute_visibility(
            ephemeris, horizon, request.limb
        )
        metrics = engine.compute_metrics(sun_vis, earth_vis, both_vis, request.step_hours)

        # Calculate total hours for scoring
        total_hours = len(ephemeris) * request.step_hours
        weights = request.weights or {"sunlit": 0.45, "darkness": 0.2, "earth": 0.25, "both": 0.1}
        score = engine.compute_score(metrics, weights, total_hours)

        best_windows = engine.find_best_windows(both_vis, request.step_hours, 5)

        sites_results.append({
            "site": all_sites.get(site_id, {}),
            "horizon": horizons.get(site_id, {}),
            "series": {"sun": sun_vis, "earth": earth_vis, "both": both_vis},
            "rle": {
                "sun": engine.rle_encode(sun_vis),
                "earth": engine.rle_encode(earth_vis),
                "both": engine.rle_encode(both_vis),
            },
            "metrics": metrics,
            "score": score,
            "best_windows": best_windows,
        })

    return {
        "meta": {
            "sites": request.site_ids,
            "start": request.start,
            "end": request.end,
            "step_hours": request.step_hours,
            "limb": request.limb,
            "generated_at": "2026-11-14T00:00:00Z",
        },
        "sites": sites_results,
    }


class BestWindowsRequest(BaseModel):
    site_id: str
    start: str
    end: str


@router.post("/best-windows")
async def best_windows(request: BestWindowsRequest):
    """Get top visibility windows for a site."""
    manifest_path = DATA_DIR / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Manifest not found")

    with open(manifest_path) as f:
        manifest = json.load(f)

    # Validate site
    site_ids = {s["id"] for s in manifest.get("sites", [])}
    if request.site_id not in site_ids:
        raise HTTPException(status_code=400, detail=f"Invalid site ID: {request.site_id}")

    # Load ephemeris and horizon
    eph_path = DATA_DIR / "ephemeris" / f"{request.site_id}.bin"
    h_path = DATA_DIR / "horizon" / f"{request.site_id}.json"

    if not eph_path.exists():
        raise HTTPException(status_code=404, detail="Ephemeris not found")

    ephemeris = engine.load_ephemeris_file(eph_path)
    horizon_data = {"horizon": []}
    if h_path.exists():
        with open(h_path) as f:
            horizon_data = json.load(f)

    horizon = horizon_data.get("horizon", [])

    # Compute visibility
    sun_vis, earth_vis, both_vis = engine.compute_visibility(ephemeris, horizon, "upper")

    # Find best windows
    windows = engine.find_best_windows(both_vis, 1.0, 5)  # Top 5

    # Add elevation info
    for w in windows:
        idx = w["start_idx"]
        if idx < len(ephemeris):
            w["sun_el_start"] = ephemeris[idx]["sun_el"]
            w["earth_el_start"] = ephemeris[idx]["earth_el"]
            w["sun_margin_deg"] = ephemeris[idx]["sun_el"] - horizon[int(ephemeris[idx]["sun_az"]) % 360] if horizon else 0
            w["earth_margin_deg"] = ephemeris[idx]["earth_el"] - horizon[int(ephemeris[idx]["earth_az"]) % 360] if horizon else 0

    return {"windows": windows}