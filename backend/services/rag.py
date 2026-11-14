"""
NASA-only RAG retrieval module.
Retrieves top-k chunks from NASA corpus, validates sources against allowlist.
"""

import os
import math
from typing import List, Dict, Any, Optional

# Allowed NASA domains for citation
ALLOWED_DOMAINS = [
    "nasa.gov",
    "jpl.nasa.gov",
    "pds.nasa.gov",
    "naif.jpl.nasa.gov",
    "trek.nasa.gov",
    "lroc.sese.asu.edu",
    "solarsystem.nasa.gov",
]


def is_nasa_url(url: str) -> bool:
    """Check if URL is from an allowed NASA domain."""
    url_lower = url.lower()
    for domain in ALLOWED_DOMAINS:
        if domain in url_lower:
            return True
    return False


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def retrieve_chunks(
    query: str,
    corpus_chunks: List[Dict[str, Any]],
    embeddings: List[List[float]],
    query_embedding: Optional[List[float]] = None,
    k: int = 5,
    min_score: float = 0.3,
) -> List[Dict[str, Any]]:
    """
    Retrieve top-k relevant chunks from corpus.

    If embeddings exist, uses cosine similarity. Otherwise falls back to keyword matching.
    All returned sources are validated against NASA allowlist.
    """
    results = []

    if embeddings and query_embedding and len(embeddings) == len(corpus_chunks):
        # Vector similarity search
        scored = []
        for i, (chunk, emb) in enumerate(zip(corpus_chunks, embeddings)):
            if query_embedding and emb:
                sim = cosine_similarity(query_embedding, emb)
            else:
                sim = 0.0
            scored.append((sim, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_k = scored[:k]

        for sim, chunk in top_k:
            if sim >= min_score:
                src_url = chunk.get("source_url", "")
                if is_nasa_url(src_url):
                    results.append({
                        "text": chunk.get("text", ""),
                        "source_url": src_url,
                        "title": chunk.get("title", ""),
                        "score": sim,
                    })

    if not results:
        # Keyword fallback
        query_lower = query.lower()
        for chunk in corpus_chunks:
            text = chunk.get("text", "").lower()
            if any(word in text for word in query_lower.split()):
                src_url = chunk.get("source_url", "")
                if is_nasa_url(src_url):
                    results.append({
                        "text": chunk.get("text", ""),
                        "source_url": src_url,
                        "title": chunk.get("title", ""),
                        "score": 1.0,
                    })
                if len(results) >= k:
                    break

    return results


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
    """Split text into overlapping chunks for RAG indexing."""
    words = text.split()
    chunks = []

    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        if chunk_words:
            chunks.append(" ".join(chunk_words))
        i += chunk_size - overlap

    return chunks


def sanitize_cited_text(text: str) -> str:
    """
    Sanitize retrieved text to prevent prompt injection.
    Remove any embedded instructions or markdown.
    """
    # Remove code blocks and markdown
    import re
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    text = re.sub(r'`(.*?)`', r'\1', text)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # Remove any "ignore previous instructions" etc
    dangerous_patterns = [
        "ignore previous",
        "disregard instructions",
        "system prompt",
        "jailbreak",
        "role:",
        "instruction:",
    ]
    for pat in dangerous_patterns:
        text = re.sub(pat, '[REDACTED]', text, flags=re.IGNORECASE)

    return text.strip()