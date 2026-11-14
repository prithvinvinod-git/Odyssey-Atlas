"""
LLM provider abstraction layer for narration and chat.
One OpenAI-compatible adapter for Gemini/Groq/OpenRouter.
Deterministic template fallback when no API key configured.
"""

import os
import time
from typing import Optional, Dict, Any, AsyncGenerator
import httpx
from pydantic import BaseModel


class LLMConfig(BaseModel):
    provider: str = "gemini"  # gemini | groq | openrouter | none
    model: str = "gemini-2.5-flash"
    api_key: Optional[str] = None
    base_url: Optional[str] = None


def get_config() -> LLMConfig:
    """Read LLM configuration from environment."""
    provider = os.getenv("LLM_PROVIDER", "none").lower()
    if provider == "none":
        return LLMConfig(provider="none")

    api_key = os.getenv(f"{provider.upper()}_API_KEY") or os.getenv("GEMINI_API_KEY")

    if provider == "gemini":
        base = "https://generativelanguage.googleapis.com/v1beta/openai/"
        model = os.getenv("LLM_MODEL", "gemini-2.5-flash")
    elif provider == "groq":
        base = "https://api.groq.com/openai/v1"
        model = os.getenv("LLM_MODEL", "llama3-70b-8192")
    elif provider == "openrouter":
        base = "https://openrouter.ai/api/v1"
        model = os.getenv("LLM_MODEL", "google/gemini-2.5-flash")
    else:
        provider = "none"
        base = None
        model = None

    return LLMConfig(
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base + "chat/completions" if base else None,
    )


async def stream_chat(
    messages: list,
    config: Optional[LLMConfig] = None,
    max_tokens: int = 1000,
    timeout: float = 30.0,
) -> AsyncGenerator[Dict[str, Any], None]:
    """Stream chat response from configured LLM or return template fallback."""
    if config is None:
        config = get_config()

    if config.provider == "none" or not config.api_key:
        # Template fallback
        user_msg = messages[-1]["content"] if messages else ""
        for chunk in _template_response(user_msg):
            yield chunk
        return

    headers = {"Authorization": f"Bearer {config.api_key}"}
    payload = {
        "model": config.model,
        "messages": messages,
        "stream": True,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", config.base_url, json=payload, headers=headers) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            yield {"type": "done"}
                            return
                        # Forward the chunk
                        yield {"type": "text", "content": data}
    except Exception as e:
        yield {"type": "error", "error": str(e)}
        yield {"type": "done"}


def _template_response(user_msg: str) -> AsyncGenerator[Dict[str, Any], None]:
    """Simple keyword-based template response for offline/fallback mode."""
    msg_lower = user_msg.lower()

    nasa_keywords = [
        "nasa", "moon", "lunar", "artemis", "lola", "spice", "jpl",
        "landing", "sun", "earth", "horizon", "crater", "south pole"
    ]
    is_nasa = any(kw in msg_lower for kw in nasa_keywords)

    if not is_nasa:
        yield {"type": "text", "content": "I can only answer questions about NASA lunar missions, landing sites, and the data in Odyssey Atlas."}
        yield {"type": "done"}
        return

    # Handle common questions
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
    else:
        response = "I can help with questions about Artemis landing sites, Sun/Earth visibility, LOLA elevation data, SPICE ephemeris, or lunar mission planning. What would you like to know?"
        sources = []

    # Stream word by word
    for word in response.split():
        yield {"type": "text", "content": word + " "}
        time.sleep(0.03)

    if sources:
        yield {"type": "sources", "sources": sources}

    yield {"type": "done"}


async def generate_narration(
    context: dict,
    audience: str = "public",
    config: Optional[LLMConfig] = None,
    max_tokens: int = 200,
) -> dict:
    """Generate audience-aware narration from comparison context."""
    if config is None:
        config = get_config()

    sites = context.get("sites", [])
    if not sites:
        return {"sentences": [], "text": "", "source": "template"}

    if config.provider == "none" or not config.api_key:
        return _template_narration(sites, audience)

    # Build prompt
    prompt = _build_narration_prompt(context, audience)
    messages = [{"role": "user", "content": prompt}]

    chunks = []
    async for chunk in stream_chat(messages, config, max_tokens):
        if chunk["type"] == "text":
            chunks.append(chunk.get("content", ""))
        elif chunk["type"] == "done":
            break

    text = "".join(chunks)
    sentences = [s.strip() for s in text.split(". ") if s.strip()]

    return {
        "sentences": sentences,
        "text": text + ". " if text else "",
        "source": "llm",
    }


def _build_narration_prompt(context: dict, audience: str) -> str:
    sites = context.get("sites", [])
    metrics_list = [(s["site"]["name"], s["metrics"]) for s in sites]
    top_score = max(metrics_list, key=lambda x: x[1]["total"]) if metrics_list else (None, None)

    if audience == "planner":
        return f"""Generate a concise technical briefing for mission planners covering {len(sites)} lunar landing sites.

Key data:
- Sites: {', '.join([s['site']['name'] for s in sites])}
- Top site: {top_score[0]} with score {top_score[1]['total'] if top_score[1] else 'N/A'}
- Sunlit percentages: {', '.join([f"{s['site']['name']}: {s['metrics']['sunlit_pct']}%" for s in sites])}
- Earth-visible hours: {', '.join([f"{s['site']['name']}: {s['metrics']['earth_visible_h']}h" for s in sites])}
- Longest Earth windows: {', '.join([f"{s['site']['name']}: {s['metrics']['longest_earth_window_h']}h" for s in sites])}

Provide 1-2 sentences per site with key metrics. Use only the numbers provided. No speculation."""
    elif audience == "educator":
        return f"""Generate an explanatory briefing for educators covering {len(sites)} lunar south-pole landing sites.

Key data:
- Sites: {', '.join([s['site']['name'] for s in sites])}
- Top site: {top_score[0]} ({top_score[1]['total'] if top_score[1] else 'N/A'} score)
- Sunlit: {', '.join([f"{s['site']['name']}: {s['metrics']['sunlit_pct']}%" for s in sites])}
- Earth visibility: {', '.join([f"{s['site']['name']}: {s['metrics']['earth_visible_h']}h" for s in sites])}

Explain why terrain blocks Sun/Earth visibility at the poles. Use analogies. 60-120 words total."""
    else:
        return f"""Generate a short vivid explanation for the public about {len(sites)} possible Moon landing spots.

Top site: {top_score[0]} (score {top_score[1]['total'] if top_score[1] else 'N/A'})
Sunlit: {', '.join([f"{s['site']['name']}: {s['metrics']['sunlit_pct']}%" for s in sites])}
Earth view: {', '.join([f"{s['site']['name']}: {s['metrics']['earth_visible_h']}h sighting" for s in sites])}

Use simple language, wonder, and one key insight. 40-80 words."""


def _template_narration(sites: list, audience: str) -> dict:
    """Template-based narration fallback."""
    if not sites:
        return {"sentences": [], "text": "", "source": "template"}

    top = max(sites, key=lambda s: s["metrics"]["total"])
    top_name = top["site"]["name"]
    top_score = top["metrics"]["total"]

    if audience == "planner":
        text = f"Comparison complete for {len(sites)} sites. {top_name} leads with score {top_score}. Sunlit range: {min(s['metrics']['sunlit_pct'] for s in sites):.1f}%-{max(s['metrics']['sunlit_pct'] for s in sites):.1f}%. Earth visibility varies from {min(s['metrics']['earth_visible_h'] for s in sites):.1f}h to {max(s['metrics']['earth_visible_h'] for s in sites):.1f}h."
    elif audience == "educator":
        text = f"We analyzed {len(sites)} candidate landing sites near the Moon's south pole. The Sun and Earth rise and set behind crater rims, creating windows of visibility. {top_name} offers the best balance with {top_score} points."
    else:
        text = f"{top_name} looks like the best Moon landing spot — it gets {top['metrics']['sunlit_pct']:.0f}% sunlight and can see Earth for {top['metrics']['earth_visible_h']:.0f} hours. Each site has its own quirks from crater shadows."

    sentences = [s.strip() for s in text.split(". ") if s.strip()]
    return {"sentences": sentences, "text": text + ". " if text else "", "source": "template"}