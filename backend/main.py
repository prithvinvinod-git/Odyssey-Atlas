from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from contextlib import asynccontextmanager

from routers import sites, compare, narrate, chat
from services import engine, llm, rag


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Odyssey Atlas API starting up...")
    yield
    # Shutdown
    print("Odyssey Atlas API shutting down...")


app = FastAPI(
    title="Odyssey Atlas API",
    description="Lunar Landing Site Navigator — Sun/Earth visibility over true lunar horizons",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for Vercel frontend
VERCEL_ORIGIN = os.getenv("VERCEL_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        VERCEL_ORIGIN,
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "odyssey-atlas-api"}


@app.get("/manifest")
async def manifest():
    # Redirect to static manifest on Vercel CDN
    return JSONResponse(
        content={"message": "Manifest served from Vercel CDN at /data/manifest.json"},
        headers={"X-Redirect": "/data/manifest.json"},
    )


app.include_router(sites.router, prefix="", tags=["sites"])
app.include_router(compare.router, prefix="", tags=["compare"])
app.include_router(narrate.router, prefix="", tags=["narrate"])
app.include_router(chat.router, prefix="", tags=["chat"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))