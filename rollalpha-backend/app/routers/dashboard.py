import httpx
from fastapi import APIRouter

from .. import data, db, portfolio

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary():
    """Everything the dashboard needs, computed from the user's saved transactions.
    When there are no transactions, `empty: true` is returned so the UI can show
    clearly-labelled illustrative demo data instead."""
    with db.connection() as conn:
        txs = db.all_tx(conn)

    codes = sorted({t["scheme_code"] for t in txs if t.get("scheme_code")})
    nav_by_code, meta_by_code, warnings = {}, {}, []
    for code in codes:
        try:
            meta, nav = data.get_nav_history(code)
            nav_by_code[code], meta_by_code[code] = nav, meta
        except (data.SchemeNotFound, httpx.HTTPError) as e:
            warnings.append(f"Could not load NAV data for scheme {code} ({e.__class__.__name__}).")

    result = portfolio.build_dashboard(txs, nav_by_code, meta_by_code)
    if warnings and not result.get("empty"):
        result["warnings"] = warnings + result.get("warnings", [])
    return result
