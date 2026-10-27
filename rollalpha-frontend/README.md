# RollAlpha AI - Frontend (React + Vite + Tailwind)

## Run
Start the backend first (port 8000), then:

    npm install
    npm run dev          # http://localhost:5173

In development Vite forwards `/api/*` to http://127.0.0.1:8000 (see vite.config.js), so no CORS setup is needed.
For a deployed build, copy `.env.example` to `.env` and set `VITE_API_URL` to your backend URL, then `npm run build`.

## Pages
| Route | Page | Backend |
|---|---|---|
| `/` | Landing | none (chart is illustrative sample data) |
| `/dashboard` | Dashboard | GET /api/dashboard/summary |
| `/compare` | Fund comparison | /api/funds/search, /compare, /{code}/nav-history, /categories |
| `/xirr` | XIRR calculator | POST /api/xirr |
| `/sip` | SIP calculator | POST /api/sip/calculate |
| `/transactions` | Transactions | /api/transactions (CRUD + export.csv) |
| `/chat` | AI assistant | POST /api/chat, GET /api/chat/suggestions |

## Structure
    src/lib/api.js         fetch wrapper + ApiError (readable messages from FastAPI errors)
    src/lib/useApi.js      GET-on-mount hook with loading / error / reload
    src/lib/format.js      INR, percent, date helpers (local-time dates, safe for IST)
    src/lib/demo.js        ILLUSTRATIVE sample data, always shown with a visible label
    src/components/        AppShell (sidebar / mobile menu), FundSearch, ui.jsx (Card, Button, Notice...)
    src/pages/             one file per page

## Things to know
- Demo data appears only on the dashboard when you have no transactions, inside a labelled notice.
- Fund categories are estimated from scheme names by the backend; the UI says so.
- XIRR and SIP maths happen on the backend. The frontend only validates and displays.
- The AI key never touches the frontend. The chat calls your backend, which holds the key.
- Replace `contact@rollalpha.example` in Landing.jsx with your real contact address.
