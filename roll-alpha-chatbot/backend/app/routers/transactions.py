from __future__ import annotations

import csv
import datetime as dt
import io

import httpx
import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Response

from .. import data, db
from ..schemas import TransactionIn, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _derive(rec: dict) -> dict:
    """Fill fund name, NAV and units from NAV history when possible. Derived units are
    approximate (real allotment NAV may differ) so they are flagged units_source='derived'."""
    code = rec.get("scheme_code")
    if not code:
        return rec
    try:
        meta, nav = data.get_nav_history(code)
    except (data.SchemeNotFound, httpx.HTTPError):
        return rec
    rec.setdefault("fund_name", None)
    if not rec["fund_name"]:
        rec["fund_name"] = meta.get("scheme_name")
    if rec.get("units") is not None:
        if rec.get("nav") is None:
            rec["nav"] = round(rec["amount"] / rec["units"], 4)
    elif rec["type"] != "dividend":
        nav_on = nav.asof(pd.Timestamp(rec["date"]))
        if pd.notna(nav_on) and nav_on > 0:
            rec["nav"] = round(float(nav_on), 4)
            rec["units"] = round(rec["amount"] / float(nav_on), 4)
            rec["units_source"] = "derived"
    return rec


@router.get("")
def list_transactions(scheme_code: int | None = None,
                      type: str | None = Query(None, pattern="^(purchase|sip|redemption|dividend)$"),
                      date_from: dt.date | None = None, date_to: dt.date | None = None,
                      sort: str = "date", order: str = Query("desc", pattern="^(asc|desc)$"),
                      limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    with db.connection() as conn:
        items, total = db.list_tx(
            conn, scheme_code=scheme_code, type=type,
            date_from=date_from.isoformat() if date_from else None,
            date_to=date_to.isoformat() if date_to else None,
            sort=sort, order=order, limit=limit, offset=offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/export.csv")
def export_csv():
    with db.connection() as conn:
        rows = db.all_tx(conn)
    buf = io.StringIO()
    cols = ["id", "date", "type", "amount", "scheme_code", "fund_name", "units", "nav", "units_source", "notes"]
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=transactions.csv"})


@router.post("", status_code=201)
def create_transaction(tx: TransactionIn):
    rec = tx.model_dump()
    rec["date"] = rec["date"].isoformat()
    rec["units_source"] = "user" if rec.get("units") is not None else None
    rec = _derive(rec)
    with db.connection() as conn:
        return db.insert_tx(conn, rec)


@router.get("/{tx_id}")
def get_transaction(tx_id: int):
    with db.connection() as conn:
        row = db.get_tx(conn, tx_id)
    if not row:
        raise HTTPException(404, "Transaction not found")
    return row


@router.put("/{tx_id}")
def update_transaction(tx_id: int, patch: TransactionUpdate):
    changes = patch.model_dump(exclude_unset=True)
    if "date" in changes and changes["date"] is not None:
        changes["date"] = changes["date"].isoformat()
    with db.connection() as conn:
        current = db.get_tx(conn, tx_id)
        if not current:
            raise HTTPException(404, "Transaction not found")
        merged = {**current, **{k: v for k, v in changes.items() if v is not None or k in ("fund_name", "notes")}}
        # re-derive only when units were derived before and inputs that affect them changed
        if current.get("units_source") == "derived" and "units" not in changes \
                and any(k in changes for k in ("date", "amount", "scheme_code", "type")):
            merged["units"], merged["nav"] = None, None
            merged = _derive(merged)
        if changes.get("units") is not None:      # user typed units by hand
            merged["units_source"] = "user"
            merged["nav"] = round(merged["amount"] / merged["units"], 4)
        db_fields = {k: merged[k] for k in
                     ("date", "type", "amount", "scheme_code", "fund_name", "units", "nav", "units_source", "notes")}
        return db.update_tx(conn, tx_id, db_fields)


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: int):
    with db.connection() as conn:
        if not db.delete_tx(conn, tx_id):
            raise HTTPException(404, "Transaction not found")
    return Response(status_code=204)
