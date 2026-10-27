"""Return, risk and consistency metrics. Pure functions: pandas in, numbers out.

All NAV inputs are pd.Series indexed by DatetimeIndex.
Returns are decimals (0.12 == 12%).
"""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from .config import RISK_FREE_RATE, TRADING_DAYS


# ---------- helpers ----------

def clean_nav(nav: pd.Series) -> pd.Series:
    s = nav.dropna().astype(float)
    return s[s > 0].sort_index()


def last_n_years(nav: pd.Series, years: float) -> pd.Series:
    """Slice the NAV series to the last `years` years (empty if history too short)."""
    nav = clean_nav(nav)
    if nav.empty:
        return nav
    start = nav.index[-1] - pd.DateOffset(days=int(round(365.25 * years)))
    if nav.index[0] > start + pd.Timedelta(days=7):  # not enough history
        return nav.iloc[0:0]
    return nav[nav.index >= start]


def history_years(nav: pd.Series) -> float:
    nav = clean_nav(nav)
    return (nav.index[-1] - nav.index[0]).days / 365.25 if len(nav) > 1 else 0.0


def daily_returns(nav: pd.Series) -> pd.Series:
    return clean_nav(nav).pct_change().dropna()


def _rf_daily(rf: float) -> float:
    return (1 + rf) ** (1 / TRADING_DAYS) - 1


def _align(a: pd.Series, b: pd.Series) -> tuple[pd.Series, pd.Series]:
    df = pd.concat([clean_nav(a), clean_nav(b)], axis=1, join="inner").dropna()
    return df.iloc[:, 0], df.iloc[:, 1]


# ---------- return metrics ----------

def cagr(nav: pd.Series) -> float:
    nav = clean_nav(nav)
    if len(nav) < 2:
        return np.nan
    years = (nav.index[-1] - nav.index[0]).days / 365.25
    if years <= 0:
        return np.nan
    return float((nav.iloc[-1] / nav.iloc[0]) ** (1 / years) - 1)


def rolling_returns(nav: pd.Series, years: float) -> pd.Series:
    """Annualised rolling returns over a `years` window, evaluated daily."""
    s = clean_nav(nav).asfreq("D").ffill()
    days = int(round(365 * years))
    rr = s / s.shift(days) - 1
    if years > 1:
        rr = (1 + rr) ** (1 / years) - 1
    return rr.dropna()


def rolling_summary(nav: pd.Series, years: int) -> dict:
    rr = rolling_returns(nav, years)
    if rr.empty:
        return {}
    return {
        f"rolling_{years}y_median": float(rr.median()),
        f"rolling_{years}y_mean": float(rr.mean()),
        f"rolling_{years}y_min": float(rr.min()),
        f"rolling_{years}y_max": float(rr.max()),
        f"rolling_{years}y_pct_positive": float((rr > 0).mean()),
    }


def rolling_beat_rate(fund: pd.Series, bench: pd.Series, years: int) -> float:
    """% of rolling windows in which the fund beat the benchmark."""
    f, b = _align(fund, bench)
    rf_, rb_ = rolling_returns(f, years), rolling_returns(b, years)
    j = pd.concat([rf_, rb_], axis=1, join="inner").dropna()
    return float((j.iloc[:, 0] > j.iloc[:, 1]).mean()) if len(j) else np.nan


# ---------- risk metrics ----------

def std_dev(nav: pd.Series) -> float:
    r = daily_returns(nav)
    return float(r.std(ddof=1) * np.sqrt(TRADING_DAYS)) if len(r) > 2 else np.nan


def max_drawdown(nav: pd.Series) -> float:
    """Largest peak-to-trough fall, as a negative number (e.g. -0.34)."""
    nav = clean_nav(nav)
    if nav.empty:
        return np.nan
    return float((nav / nav.cummax() - 1).min())


def sharpe(nav: pd.Series, rf: float = RISK_FREE_RATE) -> float:
    ex = daily_returns(nav) - _rf_daily(rf)
    sd = ex.std(ddof=1)
    if len(ex) < 3 or sd == 0 or np.isnan(sd):
        return np.nan
    return float(ex.mean() / sd * np.sqrt(TRADING_DAYS))


def sortino(nav: pd.Series, rf: float = RISK_FREE_RATE) -> float:
    ex = daily_returns(nav) - _rf_daily(rf)
    if len(ex) < 3:
        return np.nan
    downside = np.sqrt(np.mean(np.minimum(ex, 0) ** 2))
    if downside == 0:
        return np.nan
    return float(ex.mean() / downside * np.sqrt(TRADING_DAYS))


# ---------- benchmark-relative metrics ----------

def excess_cagr(fund: pd.Series, bench: pd.Series) -> float:
    f, b = _align(fund, bench)
    return cagr(f) - cagr(b) if len(f) > 1 else np.nan


def information_ratio(fund: pd.Series, bench: pd.Series) -> float:
    f, b = _align(fund, bench)
    active = daily_returns(f) - daily_returns(b)
    te = active.std(ddof=1)
    if len(active) < 3 or te == 0 or np.isnan(te):
        return np.nan
    return float(active.mean() * TRADING_DAYS / (te * np.sqrt(TRADING_DAYS)))


# ---------- investor-level metric ----------

def xirr(cashflows: list[tuple[date, float]]) -> float:
    """Annualised IRR for dated cash flows (investments negative, redemption/value positive).

    Solved by bisection so no SciPy dependency is needed.
    """
    if len(cashflows) < 2:
        return np.nan
    cfs = sorted(cashflows, key=lambda x: x[0])
    amounts = [a for _, a in cfs]
    if not (any(a < 0 for a in amounts) and any(a > 0 for a in amounts)):
        return np.nan
    t0 = cfs[0][0]
    years = [((d - t0).days) / 365.0 for d, _ in cfs]

    def npv(rate: float) -> float:
        return sum(a / (1 + rate) ** t for a, t in zip(amounts, years))

    lo, hi = -0.9999, 100.0
    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo * f_hi > 0:
        return np.nan
    for _ in range(300):
        mid = (lo + hi) / 2
        f_mid = npv(mid)
        if abs(f_mid) < 1e-9:
            return float(mid)
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return float((lo + hi) / 2)


# ---------- orchestration ----------

def compute_fund_metrics(
    nav: pd.Series,
    bench: pd.Series | None = None,
    rf: float = RISK_FREE_RATE,
    expense_ratio: float | None = None,
) -> dict:
    """Compute the full metric set for one fund. Missing values are None."""
    nav = clean_nav(nav)
    out: dict = {
        "history_years": history_years(nav),
        "inception_nav_date": nav.index[0].date().isoformat() if len(nav) else None,
        "latest_nav_date": nav.index[-1].date().isoformat() if len(nav) else None,
        "cagr_1y": cagr(last_n_years(nav, 1)),
        "cagr_3y": cagr(last_n_years(nav, 3)),
        "cagr_5y": cagr(last_n_years(nav, 5)),
        "cagr_since_inception": cagr(nav),
        "std_dev": std_dev(nav),
        "max_drawdown": max_drawdown(nav),
        "sharpe": sharpe(nav, rf),
        "sortino": sortino(nav, rf),
        "expense_ratio": expense_ratio,
    }
    out.update(rolling_summary(nav, 1))
    out.update(rolling_summary(nav, 3))

    if bench is not None and len(clean_nav(bench)) > 2:
        out["excess_cagr"] = excess_cagr(nav, bench)
        out["information_ratio"] = information_ratio(nav, bench)
        out["rolling_1y_beat_rate"] = rolling_beat_rate(nav, bench, 1)
        out["rolling_3y_beat_rate"] = rolling_beat_rate(nav, bench, 3)

    # JSON-safe: NaN -> None
    return {k: (None if isinstance(v, float) and np.isnan(v) else v) for k, v in out.items()}
