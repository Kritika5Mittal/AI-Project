"""Central configuration for RollAlpha AI."""

# Annual risk-free rate used for Sharpe / Sortino (document this publicly!).
# Example: approx. 91-day T-bill yield. Update periodically.
RISK_FREE_RATE = 0.065

TRADING_DAYS = 252

# Funds with less history than this (in years) are not ranked.
MIN_HISTORY_YEARS = 3.0

# Metric -> (weight, higher_is_better). Weights are re-normalised if some
# metrics are missing for a fund, and can be overridden per request.
METRIC_CONFIG = {
    "cagr_3y":             (0.15, True),
    "cagr_5y":             (0.10, True),
    "rolling_1y_median":   (0.10, True),
    "rolling_3y_median":   (0.10, True),
    "rolling_3y_pct_positive": (0.05, True),
    "excess_cagr":         (0.10, True),
    "sharpe":              (0.10, True),
    "sortino":             (0.05, True),
    "information_ratio":   (0.05, True),
    "std_dev":             (0.05, False),
    "max_drawdown":        (0.10, True),   # stored negative, so higher = shallower
    "expense_ratio":       (0.05, False),
}

DEFAULT_WEIGHTS = {k: v[0] for k, v in METRIC_CONFIG.items()}

MFAPI_BASE = "https://api.mfapi.in/mf"
CACHE_TTL_SECONDS = 6 * 60 * 60

# ---------- runtime settings (override with environment variables) ----------
import os

DB_PATH = os.getenv("ROLLALPHA_DB", "rollalpha.db")
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "ROLLALPHA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if o.strip()]

# Chatbot: the key lives ONLY on the server. Never put it in frontend code.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
CHAT_RATE_LIMIT_PER_MIN = int(os.getenv("CHAT_RATE_LIMIT_PER_MIN", "20"))

DATA_SOURCE = "AMFI (via mfapi.in)"
DISCLAIMER = (
    "RollAlpha AI evaluates historical performance and risk only. Past performance "
    "does not guarantee future returns. This is not investment advice."
)
