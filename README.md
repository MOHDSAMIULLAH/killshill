# KillShill — Trading Signal Tracker

A full-stack application for tracking crypto trading signals with live Binance price integration and automated status management.

---

## Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| Backend   | Node.js · Express              |
| Frontend  | React 18 · Vite 5              |
| Database  | Neon (serverless PostgreSQL)   |
| ORM       | Drizzle ORM                    |
| Prices    | Binance Public REST API        |

---

## Prerequisites

- **Node.js** ≥ 18
- A free **Neon** account at [neon.tech](https://neon.tech) (no local Postgres needed)

---

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd killShill
```

### 2. Backend — install & configure

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your Neon connection string:

```
PORT=3001
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

Get your `DATABASE_URL` from the **Neon dashboard → your project → Connection Details**.

### 3. Database setup

Push the Drizzle schema to Neon (creates tables and enum types automatically):

```bash
npm run migrate
```

This runs `drizzle-kit push`, which compares [src/db/schema.js](backend/src/db/schema.js) against your Neon database and applies all missing objects.

### 4. Frontend — install

```bash
cd ../frontend
npm install
```

### 5. Run the application

Open **two terminals**:

```bash
# Terminal 1 — backend (http://localhost:3001)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

Visit **http://localhost:5173** in your browser.

---

## API Documentation

All responses follow the envelope `{ success: boolean, data: ... }`.

### `POST /api/signals`
Create a new trading signal.

**Request body:**
```json
{
  "symbol":       "BTCUSDT",
  "direction":    "BUY",
  "entry_price":  65000,
  "stop_loss":    63000,
  "target_price": 70000,
  "entry_time":   "2026-05-06T10:00:00Z",
  "expiry_time":  "2026-05-07T10:00:00Z"
}
```

**201 Created** — returns the persisted signal record.  
**400 Bad Request** — returns `{ success: false, message, errors: string[] }`.

---

### `GET /api/signals`
List all signals enriched with live Binance prices and evaluated status.

**200 OK** — returns an array of enriched signals (includes `current_price`, `roi`, `time_remaining`).

---

### `GET /api/signals/:id`
Get a single signal by ID with live price evaluation.

**200 OK** — returns the enriched signal.  
**404 Not Found** — signal does not exist.

---

### `GET /api/signals/:id/status`
Lightweight live-status check for a signal.

**200 OK:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "symbol": "BTCUSDT",
    "direction": "BUY",
    "status": "OPEN",
    "current_price": 67423.15,
    "roi": "3.73",
    "time_remaining": "14h 22m"
  }
}
```

---

### `DELETE /api/signals/:id`
Delete a signal permanently.

**200 OK** — returns the deleted record.  
**404 Not Found** — signal does not exist.

---

## Database Schema

Defined in [backend/src/db/schema.js](backend/src/db/schema.js) using Drizzle ORM and pushed to Neon via `drizzle-kit push`.

```js
// Enums
directionEnum: 'BUY' | 'SELL'
statusEnum:    'OPEN' | 'TARGET_HIT' | 'STOPLOSS_HIT' | 'EXPIRED'

// signals table
id           serial         PRIMARY KEY
symbol       varchar(20)    NOT NULL
direction    directionEnum  NOT NULL
entry_price  decimal(20,8)  NOT NULL
stop_loss    decimal(20,8)  NOT NULL
target_price decimal(20,8)  NOT NULL
entry_time   timestamptz    NOT NULL
expiry_time  timestamptz    NOT NULL
created_at   timestamptz    NOT NULL  DEFAULT now()
status       statusEnum     NOT NULL  DEFAULT 'OPEN'
realized_roi decimal(10,4)  NULLABLE  -- set on resolution
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Frontend (React + Vite)           │
│  SignalForm  ──►  POST /api/signals         │
│  SignalDashboard  ◄──  GET /api/signals     │
│  (auto-refresh every 15 s via setInterval)  │
└──────────────────┬──────────────────────────┘
                   │ HTTP / Vite proxy
┌──────────────────▼──────────────────────────┐
│           Backend (Node.js / Express)        │
│                                             │
│  routes/signalRoutes.js                     │
│       └► controllers/signalController.js   │
│               └► services/signalService.js  │
│                   ├── validation logic      │
│                   ├── status evaluation     │
│                   ├── ROI calculation       │
│                   └── services/binanceService.js ──► Binance API
│               └► models/signalModel.js      │
└──────────────────┬──────────────────────────┘
                   │ pg Pool
┌──────────────────▼──────────────────────────┐
│             PostgreSQL                      │
│  Table: signals                             │
└─────────────────────────────────────────────┘
```

### Layers

| Layer | Responsibility |
|-------|----------------|
| **Routes** | Map HTTP verbs + paths to controller methods |
| **Controllers** | Parse/validate request params, delegate to services, format HTTP responses |
| **Services** | All business logic: validation, status transitions, ROI calculation, Binance calls |
| **Models** | Raw parameterised SQL queries against PostgreSQL |
| **BinanceService** | Parallel price fetches via Binance's public ticker endpoint |

### Signal Status Logic

Status transitions are **one-way** — once a signal leaves `OPEN` it is permanently locked:

```
OPEN ──┬── (now ≥ expiry_time)                             → EXPIRED
       ├── BUY  & current_price ≥ target_price             → TARGET_HIT
       ├── BUY  & current_price ≤ stop_loss                → STOPLOSS_HIT
       ├── SELL & current_price ≤ target_price             → TARGET_HIT
       └── SELL & current_price ≥ stop_loss                → STOPLOSS_HIT
```

Expiry is checked **first** (higher priority). Evaluation happens on every read — status changes are immediately persisted so the state is durable across server restarts.

### ROI Calculation

| Direction | Formula |
|-----------|---------|
| BUY  | `(currentPrice − entryPrice) / entryPrice × 100` |
| SELL | `(entryPrice − currentPrice) / entryPrice × 100` |

`realized_roi` is stored (4 d.p.) when a signal resolves. Open-signal ROI is computed on-the-fly from the live price and displayed to 2 d.p.

### Validation Rules

| Rule | Detail |
|------|--------|
| BUY stop loss | Must be **below** entry price |
| BUY target | Must be **above** entry price |
| SELL stop loss | Must be **above** entry price |
| SELL target | Must be **below** entry price |
| Expiry time | Must be **after** entry time |
| Entry time | Cannot be more than **24 hours in the past** |
