from __future__ import annotations

import httpx
import numpy as np
from fastapi import APIRouter, HTTPException, Query

from .. import data, fundinfo, metrics, scoring
from ..config import DATA_SOURCE, DISCLAIMER, MIN_HISTORY_YEARS, RISK_FREE_RATE
from ..schemas import CompareRequest

router = APIRouter(prefix="/funds", tags=["funds"])


def load(code: int):
    try:
        return data.get_nav_history(code)
    except data.SchemeNotFound as e:
        raise HTTPException(404, str(e))
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Upstream data source error: {e.__class__.__name__}")


@router.get("/categories")
def categories():
    return {"categories": fundinfo.CATEGORIES, "plans": ["direct", "regular"],
            "options": ["growth", "idcw"],
            "note": "Categories are estimated from scheme names."}


@router.get("/search")
def search(q: str = Query(..., min_length=3), category: str | None = None,
           plan: str | None = Query(None, pattern="^(direct|regular)$"),
           option: str | None = Query(None, pattern="^(growth|idcw)$"),
           limit: int = Query(25, ge=1, le=100)):
    try:
        raw = data.search_schemes(q)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Upstream data source error: {e.__class__.__name__}")
    items = [fundinfo.enrich(r) for r in raw]
    if category:
        items = [i for i in items if i["category"] and i["category"].lower() == category.lower()]
    if plan:
        items = [i for i in items if i["plan"] == plan]
    if option:
        items = [i for i in items if i["option"] == option]
    return {"count": len(items), "items": items[:limit], "source": DATA_SOURCE}


@router.get("/{scheme_code}/metrics")
def fund_metrics(scheme_code: int, benchmark_code: int | None = None,
                 risk_free_rate: float = RISK_FREE_RATE, expense_ratio: float | None = None):
    meta, nav = load(scheme_code)
    bench = load(benchmark_code)[1] if benchmark_code else None
    m = metrics.compute_fund_metrics(nav, bench, risk_free_rate, expense_ratio)
    return {"meta": meta, "metrics": m, "data_as_of": m["latest_nav_date"],
            "source": DATA_SOURCE, "disclaimer": DISCLAIMER}


@router.get("/{scheme_code}/nav-history")
def nav_history(scheme_code: int, years: float | None = Query(None, gt=0, le=40),
                rebase: bool = Query(False, description="Rebase to 100 at the start (for comparing charts)"),
                points: int = Query(300, ge=20, le=2000)):
    meta, nav = load(scheme_code)
    s = metrics.last_n_years(nav, years) if years else metrics.clean_nav(nav)
    if s.empty:
        return {"scheme_code": scheme_code, "name": meta.get("scheme_name"),
                "insufficient_history": True, "series": []}
    if len(s) > points:
        s = s.iloc[np.linspace(0, len(s) - 1, points).astype(int)]
    if rebase:
        s = s / s.iloc[0] * 100
    return {
        "scheme_code": scheme_code, "name": meta.get("scheme_name"), "rebased": rebase,
        "insufficient_history": False, "source": DATA_SOURCE,
        "series": [{"date": d.date().isoformat(), "value": round(float(v), 4)} for d, v in s.items()],
    }


@router.post("/compare")
def compare(req: CompareRequest):
    rf = req.risk_free_rate if req.risk_free_rate is not None else RISK_FREE_RATE
    min_years = req.min_history_years if req.min_history_years is not None else MIN_HISTORY_YEARS
    py = req.period_years

    bench_meta, bench_full = (load(req.benchmark_code) if req.benchmark_code else (None, None))
    bench = (metrics.last_n_years(bench_full, py) if py else bench_full) if bench_full is not None else None

    all_metrics, metas, excluded = {}, {}, []
    for code in dict.fromkeys(req.scheme_codes):
        meta, nav = load(code)
        full_years = metrics.history_years(nav)
        if full_years < min_years:
            excluded.append({"scheme_code": code, "reason": f"history {full_years:.1f}y < required {min_years}y"})
            continue
        window = metrics.last_n_years(nav, py) if py else nav
        if window.empty:
            excluded.append({"scheme_code": code, "reason": f"less than {py}y of history"})
            continue
        m = metrics.compute_fund_metrics(window, bench, rf, req.expense_ratios.get(code))
        m["full_history_years"] = full_years
        all_metrics[code], metas[code] = m, meta

    if len(all_metrics) < 2:
        raise HTTPException(422, {"message": "Need at least 2 funds with sufficient history", "excluded": excluded})

    ranked = scoring.score_funds(all_metrics, req.weights)
    for r in ranked:
        meta = metas[r["scheme_code"]]
        name = meta.get("scheme_name", "")
        r.update(name=name, category=meta.get("scheme_category") or fundinfo.guess_category(name),
                 plan=fundinfo.parse_plan(name), metrics=all_metrics[r["scheme_code"]])

    sort_by = req.sort_by or "score"
    if sort_by != "score":
        def key(r):
            v = r["metrics"].get(sort_by)
            return (v is None, -(v or 0) if req.order == "desc" else (v or 0))
        ranked.sort(key=key)

    warnings = ["Scores are relative to the funds you selected - compare funds of the SAME category.",
                "Compare like with like: Direct vs Direct, Growth vs Growth."]
    lengths = [m["history_years"] for m in all_metrics.values()]
    if not py and max(lengths) - min(lengths) > 1:
        warnings.append("Funds have different history lengths, so risk metrics cover different periods. "
                        "Set period_years for a like-for-like window.")
    if any(r["metrics"].get("expense_ratio") is None for r in ranked):
        warnings.append("Expense ratio was not provided for some funds; cost is excluded from their score.")

    as_of = min(m["latest_nav_date"] for m in all_metrics.values())
    benchmark = None
    if bench is not None:
        bm = metrics.compute_fund_metrics(bench, None, rf)
        benchmark = {"scheme_code": req.benchmark_code, "name": bench_meta.get("scheme_name"),
                     "returns": {k: bm[k] for k in ("cagr_1y", "cagr_3y", "cagr_5y", "cagr_since_inception",
                                                    "std_dev", "max_drawdown")}}
    return {
        "ranking": ranked,
        "sorted_by": sort_by,
        "excluded": excluded,
        "benchmark": benchmark,
        "data": {
            "source": DATA_SOURCE,
            "data_as_of": as_of,
            "calculation_period": (f"Last {py}y ending {as_of}" if py else f"Each fund's full history ending {as_of}"),
            "return_note": "1y is absolute; 3y and 5y are annualised (CAGR).",
        },
        "assumptions": {"risk_free_rate": rf, "min_history_years": min_years, "period_years": py,
                        "benchmark_code": req.benchmark_code},
        "warnings": warnings,
        "disclaimer": DISCLAIMER,
    }
