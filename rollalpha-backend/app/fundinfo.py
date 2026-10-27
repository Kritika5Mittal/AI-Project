"""Derive plan / option / category from a scheme name.

mfapi.in's search returns only code + name, so these are best-effort ESTIMATES from
the name. Responses flag this (category_source = "name_match").
"""
from __future__ import annotations

# Order matters: more specific phrases first.
CATEGORY_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Large & Mid Cap", ["large & mid", "large and mid"]),
    ("Flexi Cap", ["flexi cap", "flexicap"]),
    ("Multi Cap", ["multi cap", "multicap"]),
    ("Large Cap", ["large cap", "largecap", "bluechip", "blue chip"]),
    ("Mid Cap", ["mid cap", "midcap"]),
    ("Small Cap", ["small cap", "smallcap"]),
    ("ELSS (Tax Saver)", ["elss", "tax saver", "tax saving"]),
    ("Focused", ["focused"]),
    ("Value / Contra", ["value fund", "contra"]),
    ("Index Fund / ETF", ["index", "nifty", "sensex", "etf"]),
    ("Liquid / Overnight", ["liquid", "overnight", "money market"]),
    ("Arbitrage", ["arbitrage"]),
    ("Hybrid", ["hybrid", "balanced", "asset allocat", "equity savings"]),
    ("Debt", ["gilt", "bond", "duration", "credit risk", "banking & psu", "debt"]),
    ("Sectoral / Thematic", ["technology", "pharma", "healthcare", "infra", "consumption",
                             "banking", "financial services", "psu", "manufacturing", "thematic"]),
]

CATEGORIES = [c for c, _ in CATEGORY_KEYWORDS]


def parse_plan(name: str) -> str | None:
    n = name.lower()
    if "direct" in n:
        return "direct"
    if "regular" in n:
        return "regular"
    return None


def parse_option(name: str) -> str | None:
    n = name.lower()
    if any(k in n for k in ("idcw", "dividend", "payout", "reinvest")):
        return "idcw"
    if "growth" in n:
        return "growth"
    return None


def guess_category(name: str) -> str | None:
    n = name.lower()
    for category, keys in CATEGORY_KEYWORDS:
        if any(k in n for k in keys):
            return category
    return None


def enrich(item: dict) -> dict:
    name = item.get("schemeName", "")
    return {
        "scheme_code": item.get("schemeCode"),
        "scheme_name": name,
        "plan": parse_plan(name),
        "option": parse_option(name),
        "category": guess_category(name),
        "category_source": "name_match",
    }
