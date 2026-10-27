import numpy as np
import pandas as pd
from datetime import date

from app import metrics, scoring


def make_nav(annual_ret=0.12, vol=0.15, years=6, seed=1):
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range(end="2026-10-23", periods=int(years * 252))
    daily = rng.normal(annual_ret / 252, vol / np.sqrt(252), len(idx))
    return pd.Series(100 * np.cumprod(1 + daily), index=idx)


def test_cagr_exact():
    idx = pd.to_datetime(["2020-01-01", "2023-01-01"])
    nav = pd.Series([100.0, 200.0], index=idx)
    years = (idx[1] - idx[0]).days / 365.25
    assert abs(metrics.cagr(nav) - (2 ** (1 / years) - 1)) < 1e-9


def test_max_drawdown():
    nav = pd.Series([100, 120, 60, 90], index=pd.date_range("2024-01-01", periods=4))
    assert abs(metrics.max_drawdown(nav) - (-0.5)) < 1e-9


def test_xirr_known():
    # invest 1000, get 1100 exactly one year later -> 10%
    v = metrics.xirr([(date(2024, 1, 1), -1000), (date(2025, 1, 1), 1100)])
    assert abs(v - 0.10) < 0.002


def test_full_metrics_and_scoring():
    good, bad, bench = make_nav(0.18, 0.12, seed=1), make_nav(0.06, 0.20, seed=2), make_nav(0.11, 0.14, seed=3)
    m = {1: metrics.compute_fund_metrics(good, bench, expense_ratio=0.006),
         2: metrics.compute_fund_metrics(bad, bench, expense_ratio=0.02)}
    ranked = scoring.score_funds(m)
    assert ranked[0]["scheme_code"] == 1 and ranked[0]["rank"] == 1
    assert 0 <= ranked[1]["score"] <= ranked[0]["score"] <= 100
