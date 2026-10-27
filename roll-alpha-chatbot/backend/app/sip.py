"""SIP projection - an ESTIMATE from an assumed return, not an actual result.

Assumptions (returned to the client so the UI can display them):
 * The expected annual return is treated as an *effective annual* rate and converted
   to a per-instalment rate:  (1 + r) ** (1 / periods_per_year) - 1
 * Instalments are made at the START of each period.
 * Optional annual step-up increases the instalment at the start of each new year.
"""
from __future__ import annotations

PERIODS_PER_YEAR = {"monthly": 12, "quarterly": 4, "half_yearly": 2, "yearly": 1}


def project_sip(amount: float, years: int, annual_return_pct: float,
                frequency: str = "monthly", annual_step_up_pct: float = 0.0) -> dict:
    if frequency not in PERIODS_PER_YEAR:
        raise ValueError(f"frequency must be one of {list(PERIODS_PER_YEAR)}")
    ppy = PERIODS_PER_YEAR[frequency]
    rate = (1 + annual_return_pct / 100) ** (1 / ppy) - 1
    step = 1 + annual_step_up_pct / 100

    value = invested = 0.0
    instalment = amount
    yearly = []
    for year in range(1, years + 1):
        for _ in range(ppy):
            invested += instalment
            value = (value + instalment) * (1 + rate)
        yearly.append({
            "year": year,
            "instalment_amount": round(instalment, 2),
            "invested": round(invested, 2),
            "estimated_value": round(value, 2),
            "estimated_gain": round(value - invested, 2),
        })
        instalment *= step

    return {
        "total_invested": round(invested, 2),
        "estimated_future_value": round(value, 2),
        "estimated_gain": round(value - invested, 2),
        "yearly_breakdown": yearly,
        "assumptions": {
            "annual_return_pct": annual_return_pct,
            "frequency": frequency,
            "annual_step_up_pct": annual_step_up_pct,
            "rate_convention": "effective annual rate converted per instalment",
            "instalment_timing": "start of period",
        },
        "disclaimer": ("Projected values are estimates based on an assumed constant return. "
                       "Actual returns vary and are not guaranteed. This is not the same as "
                       "your portfolio's actual XIRR."),
    }
