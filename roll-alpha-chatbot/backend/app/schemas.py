from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------- funds ----------

class CompareRequest(BaseModel):
    scheme_codes: list[int] = Field(..., min_length=2, max_length=20)
    benchmark_code: int | None = Field(
        None, description="Scheme code of an index fund/ETF used as benchmark proxy (prefer one tracking a TRI).")
    risk_free_rate: float | None = Field(None, ge=0, le=0.5)
    expense_ratios: dict[int, float] = Field(
        default_factory=dict, description="scheme_code -> expense ratio as decimal (0.0075 = 0.75%)")
    weights: dict[str, float] | None = None
    min_history_years: float | None = Field(None, ge=0)
    period_years: float | None = Field(
        None, gt=0, le=40,
        description="Common window for ALL metrics (fairer when funds have different histories). "
                    "Omit to use each fund's full history.")
    sort_by: str | None = Field(None, description="'score' (default) or any metric key, e.g. 'sharpe'")
    order: Literal["asc", "desc"] = "desc"


# ---------- calculators ----------

class CashFlow(BaseModel):
    date: dt.date
    amount: float = Field(..., description="Negative = investment, positive = withdrawal / current value")


class XirrRequest(BaseModel):
    cashflows: list[CashFlow] = Field(..., min_length=1, max_length=2000)


class SipRequest(BaseModel):
    amount: float = Field(..., gt=0, le=100_000_000, description="Amount per instalment")
    years: int = Field(..., ge=1, le=50)
    annual_return_pct: float = Field(..., ge=0, le=50, description="ASSUMED annual return, not a prediction")
    frequency: Literal["monthly", "quarterly", "half_yearly", "yearly"] = "monthly"
    annual_step_up_pct: float = Field(0, ge=0, le=50)


# ---------- transactions ----------

TxType = Literal["purchase", "sip", "redemption", "dividend"]


class TransactionIn(BaseModel):
    date: dt.date
    type: TxType
    amount: float = Field(..., gt=0, description="Always positive; direction comes from `type`")
    scheme_code: int | None = None
    fund_name: str | None = Field(None, max_length=200)
    units: float | None = Field(None, gt=0)
    nav: float | None = Field(None, gt=0)
    notes: str | None = Field(None, max_length=500)

    @field_validator("date")
    @classmethod
    def not_future(cls, v: dt.date) -> dt.date:
        if v > dt.date.today():
            raise ValueError("date cannot be in the future")
        return v


class TransactionUpdate(BaseModel):
    date: dt.date | None = None
    type: TxType | None = None
    amount: float | None = Field(None, gt=0)
    scheme_code: int | None = None
    fund_name: str | None = Field(None, max_length=200)
    units: float | None = Field(None, gt=0)
    nav: float | None = Field(None, gt=0)
    notes: str | None = Field(None, max_length=500)

    @field_validator("date")
    @classmethod
    def not_future(cls, v):
        if v is not None and v > dt.date.today():
            raise ValueError("date cannot be in the future")
        return v


# ---------- chat ----------

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=50)
