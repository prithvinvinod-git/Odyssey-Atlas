from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from pathlib import Path

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent / "public" / "data"
from services import engine


class Site(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    elevation_m: float
    description: str
    nasa_source_url: str
    color: str


@router.get("/sites")
async def get_sites():
    """Get all landing site metadata."""
    sites_path = DATA_DIR / "sites.json"
    if not sites_path.exists():
        raise HTTPException(status_code=404, detail="Sites data not found")
    with open(sites_path) as f:
        data = json.load(f)
    return {"sites": data, "source": "static"}


@router.get("/sites/{site_id}/horizon")
async def get_horizon(site_id: str):
    """Get horizon mask for a site (360 azimuth values)."""
    horizon_path = DATA_DIR / "horizon" / f"{site_id}.json"
    if not horizon_path.exists():
        raise HTTPException(status_code=404, detail=f"Horizon for {site_id} not found")
    with open(horizon_path) as f:
        data = json.load(f)
    return data