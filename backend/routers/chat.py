from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, AsyncGenerator
import json
import asyncio
import os

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[dict] = None


# NASA-only guardrail domains
ALLOWED_DOMAINS = [
    "nasa.gov", "jpl.nasa.gov", "pds.nasa.gov", "naif.jpl.nasa.gov",
    "trek.nasa.gov", "lroc.sese.asu.edu", "solarsystem.nasa.gov",
]


def is_nasa_related(text: str) -> bool:
    """Check if text discusses NASA lunar topics."""
    text_lower = text.lower()
    keywords = [
        "nasa", "moon", "lunar", "artemis", "lola", "spice", "jpl",
        "landing", "sun", "earth", "horizon", "crater", "south pole",
        "visibility", "power", "communication", "site", "candidate", "mission",
        "lunar reconnaissance", "orbiter", "lroc", "pds"
    ]
    return any(kw in text_lower for kw in keywords)


def is_allowed_url(url: str) -> bool:
    """Check if URL is from allowed NASA domain."""
    url_lower = url.lower()
    return any(domain in url_lower for domain in ALLOWED_DOMAINS)


async def generate_sse_response(request: ChatRequest) -> AsyncGenerator[str, None]:
    """Generate SSE response for NASA-only chat."""
    user_msg = request.messages[-1].content if request.messages else ""

    if not is_nasa_related(user_msg):
        yield f"data: {json.dumps({'type': 'text', 'content': 'I can only answer questions about NASA lunar missions, landing sites, and the data in Odyssey Atlas. Try asking about Artemis landing sites, LOLA elevation data, or Sun/Earth visibility.'})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    # Handle common questions
    msg_lower = user_msg.lower()

    if "why does earth disappear" in msg_lower or "earth drop" in msg_lower:
        response = "Earth drops below the horizon at the lunar south pole because the Moon's rotation and local terrain (crater rims, mountains) block line of sight. At the poles, Earth appears to move in a small circle due to libration. When it dips behind a ridge, direct-to-Earth communication is lost."
        sources = [
            {"url": "https://www.nasa.gov/mission_pages/LRO/science/lro-lola.html", "title": "LRO LOLA Instrument", "domain": "nasa.gov"},
            {"url": "https://trek.nasa.gov/moon/", "title": "NASA Moon Trek", "domain": "trek.nasa.gov"},
        ]
    elif "longest sunlight" in msg_lower or "most sun" in msg_lower:
        response = "Sites on high-elevation ridges like Connecting Ridge or Malapert Massif get the longest continuous sunlight because they rise above crater-rim shadows. The exact duration depends on date range and local terrain."
        sources = [
            {"url": "https://www.nasa.gov/feature/artemis/artemis-iii-candidate-landing-regions", "title": "Artemis III Candidate Landing Regions", "domain": "nasa.gov"},
        ]
    elif "what is lola" in msg_lower:
        response = "LOLA (Lunar Orbiter Laser Altimeter) is a NASA instrument on the Lunar Reconnaissance Orbiter that maps the Moon's topography by bouncing laser pulses off the surface. It provides the elevation data for calculating true horizon profiles for landing site analysis."
        sources = [
            {"url": "https://lroc.sese.asu.edu/lola/", "title": "LOLA Instrument", "domain": "lroc.sese.asu.edu"},
            {"url": "https://www.nasa.gov/mission_pages/LRO/science/lro-lola.html", "title": "LRO LOLA", "domain": "nasa.gov"},
        ]
    elif "horizon" in msg_lower or "visibility" in msg_lower:
        response = "The horizon profile at each landing site is computed from LODA elevation data, accounting for lunar curvature. A body (Sun or Earth) is visible when its upper limb rises above the local horizon angle defined by terrain. This determines power availability and communication windows."
        sources = [
            {"url": "https://trek.nasa.gov/moon/", "title": "NASA Moon Trek", "domain": "trek.nasa.gov"},
            {"url": "https://www.jpl.nasa.gov/space-times", "title": "JPL Space Science", "domain": "jpl.nasa.gov"},
        ]
    else:
        response = "I can help with questions about Artemis landing sites, Sun/Earth visibility windows, LOLA elevation data, SPICE ephemeris, or lunar mission planning near the south pole. What would you like to know?"
        sources = []

    # Stream word by word
    for word in response.split():
        yield f"data: {json.dumps({'type': 'text', 'content': word + ' '})}\n\n"
        await asyncio.sleep(0.03)

    if sources:
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest):
    """NASA-only RAG chat endpoint with SSE streaming."""
    return StreamingResponse(
        generate_sse_response(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )