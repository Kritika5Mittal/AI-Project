"""RollAlpha AI - API entrypoint.   Run:  uvicorn app.main:app --reload
All endpoints live under /api (matches the frontend, e.g. POST /api/chat)."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .routers import chat, dashboard, funds, tools, transactions


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="RollAlpha AI", version="0.2.0", description=config.DISCLAIMER, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "chat_provider": "anthropic" if config.ANTHROPIC_API_KEY else "fallback"}


@api.get("/methodology", tags=["meta"])
def methodology():
    """Published weights and assumptions - core to the 'transparent score' promise."""
    return {
        "weights": config.DEFAULT_WEIGHTS,
        "risk_free_rate": config.RISK_FREE_RATE,
        "min_history_years": config.MIN_HISTORY_YEARS,
        "normalisation": "Percentile rank within the compared peer set (same category).",
        "data_source": config.DATA_SOURCE,
        "disclaimer": config.DISCLAIMER,
    }


for r in (funds.router, tools.router, transactions.router, dashboard.router, chat.router):
    api.include_router(r)
app.include_router(api)


@app.get("/health", include_in_schema=False)
def root_health():
    return {"status": "ok"}
