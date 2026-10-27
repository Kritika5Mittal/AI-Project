from fastapi import APIRouter, HTTPException

from .. import portfolio, sip
from ..config import DISCLAIMER
from ..schemas import SipRequest, XirrRequest

router = APIRouter(tags=["calculators"])


@router.post("/xirr")
def xirr_endpoint(req: XirrRequest):
    """Investments negative, withdrawals / current value positive.
    Invalid input -> 422 with {errors: [...], warnings: [...]} ready to show in the UI."""
    result = portfolio.xirr_summary([(c.date, c.amount) for c in req.cashflows])
    if result["errors"]:
        raise HTTPException(422, {"errors": result["errors"], "warnings": result["warnings"]})
    result["disclaimer"] = DISCLAIMER
    return result


@router.post("/sip/calculate")
def sip_calculate(req: SipRequest):
    return sip.project_sip(req.amount, req.years, req.annual_return_pct,
                           req.frequency, req.annual_step_up_pct)
