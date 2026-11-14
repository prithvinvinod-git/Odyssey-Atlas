from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import json

router = APIRouter()


class NarrateRequest(BaseModel):
    context: dict
    audience: str = Field(pattern="^(planner|educator|public)$")


class NarrateResponse(BaseModel):
    sentences: List[str]
    text: str
    source: str = "template"


def _template_narration(sites: list, audience: str) -> dict:
    """Generate template narration based on comparison data."""
    if not sites:
        return {"sentences": [], "text": "", "source": "template"}

    top = max(sites, key=lambda s: s.get("score", {}).get("total", 0))
    top_name = top.get("site", {}).get("name", "this site")
    top_score = top.get("score", {}).get("total", 0)

    sunlit_vals = [s.get("metrics", {}).get("sunlit_pct", 0) for s in sites]
    earth_vals = [s.get("metrics", {}).get("earth_visible_h", 0) for s in sites]

    if audience == "planner":
        text = f"Comparison complete for {len(sites)} sites. {top_name} leads with score {top_score}. Sunlit range: {min(sunlit_vals):.1f}%-{max(sunlit_vals):.1f}%. Earth visibility: {min(earth_vals):.1f}h-{max(earth_vals):.1f}h."
    elif audience == "educator":
        text = f"We analyzed {len(sites)} candidate landing sites near the Moon's south pole. The Sun and Earth rise and set behind crater rims, creating visibility windows. {top_name} offers the best balance with {top_score} points."
    else:
        text = f"{top_name} looks like the best Moon landing spot — it gets {top['metrics']['sunlit_pct']:.0f}% sunlight and can see Earth for {top['metrics']['earth_visible_h']:.0f} hours. Each site has its own quirks from crater shadows."

    sentences = [s.strip() for s in text.split(". ") if s.strip()]
    return {"sentences": sentences, "text": text + ". " if text else "", "source": "template"}


@router.post("/narrate", response_model=NarrateResponse)
async def narrate(request: NarrateRequest):
    """Generate audience-aware narration from comparison context."""
    ctx = request.context
    audience = request.audience

    if not ctx or not ctx.get("sites"):
        return {"sentences": ["No comparison data available."], "text": "No comparison data available.", "source": "template"}

    return _template_narration(ctx["sites"], audience)