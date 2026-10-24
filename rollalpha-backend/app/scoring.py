"""Transparent, category-relative scoring.

Each metric is converted to a percentile (0-1) *within the peer set*, then combined
using published weights into a 0-100 score. Per-metric contributions are returned
so users can see exactly why a fund ranked where it did.
"""
from __future__ import annotations

import pandas as pd

from .config import DEFAULT_WEIGHTS, METRIC_CONFIG


def score_funds(metrics: dict[str, dict], weights: dict[str, float] | None = None) -> list[dict]:
    """
    metrics: {scheme_code: metric_dict from compute_fund_metrics}
    Returns a list sorted by rank with score and per-metric breakdown.
    """
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    w = {k: v for k, v in w.items() if k in METRIC_CONFIG and v > 0}

    df = pd.DataFrame.from_dict(metrics, orient="index")
    for m in w:
        if m not in df.columns:
            df[m] = float("nan")
    df[list(w)] = df[list(w)].apply(pd.to_numeric, errors="coerce")

    # Percentile rank within the peer set. ascending=True => larger value = higher pct.
    pct = pd.DataFrame(index=df.index)
    for m in w:
        higher_better = METRIC_CONFIG[m][1]
        pct[m] = df[m].rank(pct=True, ascending=higher_better, method="average")

    results = []
    for code in df.index:
        avail = [m for m in w if pd.notna(pct.at[code, m])]
        total_w = sum(w[m] for m in avail)
        if total_w == 0:
            results.append({"scheme_code": code, "score": None, "breakdown": {}, "coverage": 0.0})
            continue
        breakdown = {
            m: round(100 * w[m] / total_w * pct.at[code, m], 2) for m in avail
        }
        results.append({
            "scheme_code": code,
            "score": round(sum(breakdown.values()), 2),
            "breakdown": breakdown,
            # share of the total weight that had data; low coverage => treat with caution
            "coverage": round(total_w / sum(w.values()), 2),
        })

    results.sort(key=lambda r: (r["score"] is None, -(r["score"] or 0)))
    for i, r in enumerate(results, 1):
        r["rank"] = i if r["score"] is not None else None
    return results
