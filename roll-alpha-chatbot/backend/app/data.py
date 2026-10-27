"""NAV data access (free community API: mfapi.in, sourced from AMFI)."""
from __future__ import annotations

import time
from typing import Any

import httpx
import pandas as pd

from .config import CACHE_TTL_SECONDS, MFAPI_BASE


class SchemeNotFound(Exception):
    pass


_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_SECONDS:
        return hit[1]
    return None


def search_schemes(query: str) -> list[dict]:
    key = f"search:{query.lower()}"
    if (v := _cached(key)) is not None:
        return v
    r = httpx.get(f"{MFAPI_BASE}/search", params={"q": query}, timeout=20)
    r.raise_for_status()
    result = r.json()
    _cache[key] = (time.time(), result)
    return result


def get_nav_history(scheme_code: int | str) -> tuple[dict, pd.Series]:
    """Return (meta, NAV series indexed by date, ascending)."""
    key = f"nav:{scheme_code}"
    if (v := _cached(key)) is not None:
        return v

    r = httpx.get(f"{MFAPI_BASE}/{scheme_code}", timeout=30)
    r.raise_for_status()
    payload = r.json()
    if not payload.get("data"):
        raise SchemeNotFound(f"No NAV data for scheme {scheme_code}")

    df = pd.DataFrame(payload["data"])
    df["date"] = pd.to_datetime(df["date"], format="%d-%m-%Y")
    df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
    nav = df.dropna().set_index("date")["nav"].sort_index()
    nav = nav[~nav.index.duplicated(keep="last")]
    nav.name = str(scheme_code)

    result = (payload.get("meta", {}), nav)
    _cache[key] = (time.time(), result)
    return result
