"""Tests for pure logic (no network, no FastAPI needed)."""
import os, tempfile
from datetime import date

import numpy as np
import pandas as pd

from app import chat, config, db, fundinfo, portfolio, sip


# ---------- SIP ----------
def test_sip_zero_return_equals_invested():
    r = sip.project_sip(5000, 10, 0)
    assert r["total_invested"] == 5000 * 12 * 10
    assert r["estimated_future_value"] == r["total_invested"]
    assert len(r["yearly_breakdown"]) == 10


def test_sip_known_value():
    # 10,000/month, 12% effective annual, 10y, start-of-period
    r = sip.project_sip(10000, 10, 12)
    i = 1.12 ** (1 / 12) - 1
    expected = 10000 * ((1 + i) ** 120 - 1) / i * (1 + i)
    assert abs(r["estimated_future_value"] - round(expected, 2)) < 1


def test_sip_step_up_increases_value():
    assert sip.project_sip(5000, 10, 10, annual_step_up_pct=10)["estimated_future_value"] > \
           sip.project_sip(5000, 10, 10)["estimated_future_value"]


# ---------- XIRR validation ----------
def test_xirr_validation_messages():
    s = portfolio.xirr_summary([(date(2024, 1, 1), -1000)], today=date(2025, 1, 1))
    assert s["errors"] and s["xirr"] is None
    s = portfolio.xirr_summary([(date(2024, 1, 1), -1000), (date(2024, 1, 1), 1100)], today=date(2025, 1, 1))
    assert any("same date" in e for e in s["errors"])
    s = portfolio.xirr_summary([(date(2024, 1, 1), -1000), (date(2030, 1, 1), 1100)], today=date(2025, 1, 1))
    assert any("future" in e for e in s["errors"])


def test_xirr_summary_values():
    s = portfolio.xirr_summary([(date(2024, 1, 1), -1000), (date(2025, 1, 1), 1100)], today=date(2025, 6, 1))
    assert not s["errors"]
    assert abs(s["xirr_pct"] - 10.0) < 0.2
    assert s["total_invested"] == 1000 and s["total_withdrawals"] == 1100 and s["net_gain"] == 100


# ---------- DB + dashboard ----------
def _tmp_db():
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False); f.close()
    config.DB_PATH = f.name
    db.init_db()
    return f.name


def test_db_crud_filter_sort():
    path = _tmp_db()
    try:
        with db.connection() as c:
            a = db.insert_tx(c, {"date": "2024-01-10", "type": "sip", "amount": 5000, "scheme_code": 1})
            db.insert_tx(c, {"date": "2024-03-10", "type": "redemption", "amount": 100, "scheme_code": 2})
            rows, total = db.list_tx(c, sort="date", order="asc")
            assert total == 2 and rows[0]["id"] == a["id"]
            rows, total = db.list_tx(c, type="sip")
            assert total == 1
            assert db.update_tx(c, a["id"], {"amount": 6000})["amount"] == 6000
            assert db.delete_tx(c, a["id"]) and not db.delete_tx(c, a["id"])
        # constraint: amount must be positive
        try:
            with db.connection() as c:
                db.insert_tx(c, {"date": "2024-01-01", "type": "sip", "amount": -5})
            assert False, "should have failed"
        except Exception as e:
            assert "CHECK" in str(e) or "constraint" in str(e).lower()
    finally:
        os.unlink(path)


def _nav(start, end, v0, v1):
    idx = pd.bdate_range(start, end)
    return pd.Series(np.linspace(v0, v1, len(idx)), index=idx)


def test_dashboard_with_valuation():
    nav = _nav("2023-01-01", "2025-06-30", 100, 150)
    txs = [
        {"id": 1, "date": "2023-02-01", "type": "sip", "amount": 10000, "scheme_code": 1, "fund_name": "Fund A", "units": 10000 / float(nav.asof(pd.Timestamp("2023-02-01")))},
        {"id": 2, "date": "2023-08-01", "type": "sip", "amount": 10000, "scheme_code": 1, "fund_name": "Fund A", "units": 10000 / float(nav.asof(pd.Timestamp("2023-08-01")))},
    ]
    d = portfolio.build_dashboard(txs, {1: nav}, {1: {"scheme_category": "Equity: Flexi Cap"}}, today=date(2025, 6, 30))
    t = d["totals"]
    assert d["valuation_complete"] and t["total_invested"] == 20000
    assert t["current_value"] > 20000 and t["absolute_gain"] > 0 and t["xirr_pct"] > 0
    assert d["allocation"]["by_category"][0]["name"] == "Equity: Flexi Cap"
    assert d["performance"][-1]["value"] == t["current_value"]


def test_dashboard_missing_units_hides_value():
    nav = _nav("2023-01-01", "2025-06-30", 100, 150)
    txs = [{"id": 1, "date": "2023-02-01", "type": "sip", "amount": 10000, "scheme_code": 1, "units": None}]
    d = portfolio.build_dashboard(txs, {1: nav}, {}, today=date(2025, 6, 30))
    assert not d["valuation_complete"] and d["totals"]["current_value"] is None
    assert d["totals"]["total_invested"] == 10000 and d["warnings"]


def test_dashboard_empty():
    assert portfolio.build_dashboard([], {}, {})["empty"] is True


# ---------- chat ----------
def test_chat_sanitize():
    msgs = [{"role": "assistant", "content": "hi"}, {"role": "user", "content": "a"},
            {"role": "user", "content": "b"}, {"role": "system", "content": "x"}, {"role": "user", "content": " "}]
    out = chat.sanitize(msgs)
    assert out == [{"role": "user", "content": "a\nb"}]


def test_chat_fallback():
    config.ANTHROPIC_API_KEY = ""
    reply, provider = chat.get_reply([{"role": "user", "content": "What is the difference between CAGR and XIRR?"}])
    assert provider == "fallback" and "CAGR vs XIRR" in reply
    assert "SIP" in chat.get_reply([{"role": "user", "content": "How does a SIP work?"}])[0]
    assert "isn't connected" in chat.get_reply([{"role": "user", "content": "best stock tip?"}])[0]


# ---------- fund info ----------
def test_fundinfo():
    n = "Parag Parikh Flexi Cap Fund - Direct Plan - Growth"
    assert fundinfo.parse_plan(n) == "direct" and fundinfo.parse_option(n) == "growth"
    assert fundinfo.guess_category(n) == "Flexi Cap"
    assert fundinfo.parse_option("X Fund - Regular Plan - Monthly IDCW Payout") == "idcw"
    assert fundinfo.guess_category("HDFC Large and Mid Cap Fund") == "Large & Mid Cap"
