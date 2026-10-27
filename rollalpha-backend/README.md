# RollAlpha AI - Backend (FastAPI)

## Run
    pip install -r requirements.txt
    uvicorn app.main:app --reload          # docs: http://127.0.0.1:8000/docs

Windows PowerShell, to enable the real AI chatbot (optional):
    $env:ANTHROPIC_API_KEY="your-key"; uvicorn app.main:app --reload

Without a key, /api/chat answers 5 common questions from a built-in FAQ
(`provider: "fallback"` in the response so the UI can show it).

## Frontend connection (Vite)
Everything is under `/api`. Either set `VITE_API_URL=http://127.0.0.1:8000` and call
`${VITE_API_URL}/api/...`, or add a Vite dev proxy for `/api`. CORS already allows
http://localhost:5173 (change with ROLLALPHA_CORS_ORIGINS).

## Endpoints
| Frontend page | Endpoint |
|---|---|
| Fund comparison | GET /api/funds/categories, GET /api/funds/search?q=&category=&plan=&option= |
| | POST /api/funds/compare  (ranking, benchmark, data date, source, calc period, sorting) |
| | GET /api/funds/{code}/metrics, GET /api/funds/{code}/nav-history?years=&rebase=true |
| XIRR calculator | POST /api/xirr  (422 -> {errors[], warnings[]} to show in the UI) |
| SIP calculator | POST /api/sip/calculate |
| Transactions | GET/POST /api/transactions, GET/PUT/DELETE /api/transactions/{id}, GET /api/transactions/export.csv |
| Dashboard | GET /api/dashboard/summary  (`empty: true` => show labelled demo data) |
| Chatbot | POST /api/chat, GET /api/chat/suggestions |
| Meta | GET /api/health, GET /api/methodology |

## Behaviour worth knowing
- Transactions: `amount` is always positive; direction comes from `type`
  (purchase/sip = money out, redemption/dividend = money in).
- If you send `scheme_code` without `units`, units are derived from that day's NAV and
  flagged `units_source: "derived"` (approximate - show an "estimated" badge in the UI).
- Dashboard hides current value / gain / XIRR (null + warning) when any holding can't be
  valued, instead of showing a wrong number.
- Fund categories are estimated from scheme names (`category_source: "name_match"`).
- Compare: set `period_years` to compare all funds over the same window.
- SIP projections are estimates and separate from real XIRR (stated in every response).

## Test
    pytest -q            # or run tests/ with any runner

## Before going public
- Add authentication + a user_id on transactions (currently single-user).
- Replace SQLite with PostgreSQL if multiple users/servers.
- Move NAV fetching to a nightly ingestion job; add a persistent chat rate limiter.
