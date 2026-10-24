"""Portfolio maths on top of transactions. Pure functions (no network, no DB) so they
are easy to test; routers load NAVs / rows and pass them in."""
from __future__ import annotations

from datetime import date, datetime

import pandas as pd

from . import metrics
from .config import DISCLAIMER

BUY_TYPES = {"purchase", "sip"}
INFLOW_TYPES = {"redemption", "dividend"}   # cash coming back to the investor


def _d(x) -> date:
    return x if isinstance(x, date) and not isinstance(x, datetime) else pd.Timestamp(x).date()


def signed_amount(tx: dict) -> float:
    """Investor cash-flow sign: money out (buy) negative, money in positive."""
    return -tx["amount"] if tx["type"] in BUY_TYPES else tx["amount"]


def build_cashflows(txs: list[dict]) -> list[tuple[date, float]]:
    return [(_d(t["date"]), signed_amount(t)) for t in txs]


# ---------- XIRR validation / summary ----------

def validate_cashflows(cashflows: list[tuple[date, float]], today: date | None = None
                       ) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Errors mean XIRR cannot be computed."""
    today = today or date.today()
    errors, warnings = [], []
    if len(cashflows) < 2:
        errors.append("Add at least two cash flows (one investment and one withdrawal / current value).")
        return errors, warnings
    if any(a == 0 for _, a in cashflows):
        errors.append("Cash-flow amounts cannot be zero. Remove or correct empty rows.")
    if not any(a < 0 for _, a in cashflows):
        errors.append("Include at least one investment (negative amount).")
    if not any(a > 0 for _, a in cashflows):
        errors.append("Include a withdrawal or the current portfolio value (positive amount).")
    if any(d > today for d, _ in cashflows):
        errors.append("Dates cannot be in the future.")
    dates = sorted(d for d, _ in cashflows)
    if dates[0] == dates[-1]:
        errors.append("All cash flows are on the same date - XIRR needs a time span.")
    elif (dates[-1] - dates[0]).days < 30:
        warnings.append("Period is under 30 days; annualised XIRR can be extremely large and misleading.")
    # final cash flow should normally be the positive one
    last_date = dates[-1]
    if not errors and not any(a > 0 for d, a in cashflows if d == last_date):
        warnings.append("The latest cash flow is not a withdrawal / current value - check the dates.")
    return errors, warnings


def xirr_summary(cashflows: list[tuple[date, float]], today: date | None = None) -> dict:
    errors, warnings = validate_cashflows(cashflows, today)
    invested = sum(-a for _, a in cashflows if a < 0)
    withdrawals = sum(a for _, a in cashflows if a > 0)
    out = {
        "total_invested": round(invested, 2),
        "total_withdrawals": round(withdrawals, 2),
        "net_gain": round(withdrawals - invested, 2),
        "errors": errors,
        "warnings": warnings,
        "xirr": None,
        "xirr_pct": None,
    }
    if errors:
        return out
    value = metrics.xirr(cashflows)
    if value != value:  # NaN
        out["errors"].append("XIRR could not be solved for these cash flows. Check amounts and dates.")
        return out
    out["xirr"] = value
    out["xirr_pct"] = round(value * 100, 2)
    return out


# ---------- holdings / valuation ----------

def holdings(txs: list[dict], up_to: date | None = None) -> dict:
    """scheme_code -> {units, fund_name, invested, missing_units}.

    Transactions without a scheme_code can't be valued and are tracked under key None.
    """
    out: dict = {}
    for t in txs:
        if up_to and _d(t["date"]) > up_to:
            continue
        key = t.get("scheme_code")
        h = out.setdefault(key, {"units": 0.0, "fund_name": t.get("fund_name"),
                                 "invested": 0.0, "missing_units": False})
        if t.get("fund_name") and not h["fund_name"]:
            h["fund_name"] = t["fund_name"]
        if t["type"] in BUY_TYPES:
            h["invested"] += t["amount"]
        if t["type"] == "dividend":
            continue  # cash payout, units unchanged
        if t.get("units") is None:
            h["missing_units"] = True
            continue
        h["units"] += t["units"] if t["type"] in BUY_TYPES else -t["units"]
    return out


def current_value(hold: dict, latest_nav: dict) -> tuple[float, bool]:
    """(value, complete). complete=False if any holding can't be valued."""
    value, complete = 0.0, True
    for code, h in hold.items():
        if h["units"] <= 1e-9 and not h["missing_units"]:
            continue  # fully redeemed
        if code is None or h["missing_units"] or code not in latest_nav:
            complete = False
            continue
        value += h["units"] * latest_nav[code]
    return value, complete


def performance_series(txs: list[dict], nav_by_code: dict[int, pd.Series], today: date,
                       valuation_ok: bool) -> list[dict]:
    if not txs:
        return []
    start = min(_d(t["date"]) for t in txs)
    months = (today.year - start.year) * 12 + (today.month - start.month)
    step = 1 if months <= 120 else 3
    points = list(pd.date_range(start=start, end=today, freq=pd.offsets.MonthEnd(step)).date)
    points = sorted(set(points + [start, today]))

    series = []
    for d in points:
        invested = sum(t["amount"] for t in txs if t["type"] in BUY_TYPES and _d(t["date"]) <= d)
        point = {"date": d.isoformat(), "invested": round(invested, 2), "value": None}
        if valuation_ok:
            val = 0.0
            for code, h in holdings(txs, up_to=d).items():
                if h["units"] > 1e-9 and code in nav_by_code:
                    nav = nav_by_code[code].asof(pd.Timestamp(d))
                    if pd.notna(nav):
                        val += h["units"] * float(nav)
            point["value"] = round(val, 2)
        series.append(point)
    return series


def _allocation(items: dict[str, float]) -> list[dict]:
    total = sum(items.values())
    rows = [{"name": k, "value": round(v, 2), "pct": round(100 * v / total, 2) if total else 0.0}
            for k, v in items.items() if v > 0]
    return sorted(rows, key=lambda r: -r["value"])


def build_dashboard(txs: list[dict], nav_by_code: dict[int, pd.Series],
                    meta_by_code: dict[int, dict], today: date | None = None) -> dict:
    today = today or date.today()
    if not txs:
        return {"empty": True, "message": "No transactions yet. Add transactions to see your dashboard.",
                "disclaimer": DISCLAIMER}

    warnings: list[str] = []
    invested = sum(t["amount"] for t in txs if t["type"] in BUY_TYPES)
    withdrawn = sum(t["amount"] for t in txs if t["type"] in INFLOW_TYPES)

    hold = holdings(txs)
    latest_nav = {c: float(s.iloc[-1]) for c, s in nav_by_code.items() if len(s)}
    value, complete = current_value(hold, latest_nav)
    if not complete:
        warnings.append("Some holdings could not be valued (missing units, scheme code or NAV data). "
                        "Current value, gain and XIRR are hidden until this is fixed.")

    totals = {"total_invested": round(invested, 2), "total_withdrawn": round(withdrawn, 2),
              "current_value": None, "absolute_gain": None, "absolute_gain_pct": None,
              "xirr": None, "xirr_pct": None}
    if complete:
        gain = value + withdrawn - invested
        totals.update(current_value=round(value, 2), absolute_gain=round(gain, 2),
                      absolute_gain_pct=round(100 * gain / invested, 2) if invested else None)
        cfs = build_cashflows(txs) + ([(today, value)] if value > 0 else [])
        s = xirr_summary(cfs, today)
        if s["xirr"] is not None:
            totals.update(xirr=s["xirr"], xirr_pct=s["xirr_pct"])
        else:
            warnings.extend(s["errors"])
        warnings.extend(s["warnings"])

    # allocation
    if complete and value > 0:
        by_fund, by_cat = {}, {}
        for code, h in hold.items():
            if code is None or h["units"] <= 1e-9:
                continue
            v = h["units"] * latest_nav[code]
            name = h["fund_name"] or (meta_by_code.get(code) or {}).get("scheme_name") or str(code)
            cat = (meta_by_code.get(code) or {}).get("scheme_category") or "Unclassified"
            by_fund[name] = by_fund.get(name, 0) + v
            by_cat[cat] = by_cat.get(cat, 0) + v
        allocation = {"basis": "current_value", "by_fund": _allocation(by_fund), "by_category": _allocation(by_cat)}
    else:
        by_fund = {}
        for code, h in hold.items():
            name = h["fund_name"] or (str(code) if code else "Unassigned")
            by_fund[name] = by_fund.get(name, 0) + h["invested"]
        allocation = {"basis": "invested_amount", "by_fund": _allocation(by_fund), "by_category": []}

    recent = sorted(txs, key=lambda t: (t["date"], t.get("id", 0)), reverse=True)[:5]
    return {
        "empty": False,
        "currency": "INR",
        "as_of": today.isoformat(),
        "totals": totals,
        "valuation_complete": complete,
        "performance": performance_series(txs, nav_by_code, today, complete),
        "allocation": allocation,
        "recent_transactions": recent,
        "warnings": warnings,
        "disclaimer": DISCLAIMER,
    }
