# Allo Inventory — Stock Reservation Platform

A concurrency-safe inventory reservation system built for multi-warehouse retail and D2C brands. When a customer proceeds to checkout, units are temporarily held for 10 minutes. If payment succeeds, the reservation is confirmed. If it fails or times out, units are released back to available stock.

**Live Demo:** [https://allo-health-0e3n.onrender.com/](https://allo-health-0e3n.onrender.com/)

---

## Table of Contents

- [Architecture](#architecture)
- [Running Locally](#running-locally)
- [Concurrency Model](#concurrency-model)
- [Reservation Expiry](#reservation-expiry)
- [Idempotency (Bonus)](#idempotency-bonus)
- [API Reference](#api-reference)
- [Trade-offs & Future Work](#trade-offs--future-work)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Next.js App                     │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐ │
│  │ Products  │  │  Checkout  │  │  API Routes │ │
│  │  Page     │  │   Page     │  │  /api/*     │ │
│  └──────────┘  └────────────┘  └──────┬──────┘ │
│                                        │        │
│  ┌────────────────────────────────────┐│        │
│  │     Vercel Cron (every 1 min)     ││        │
│  │  /api/cron/expire-reservations    ││        │
│  └────────────────────────────────────┘│        │
└────────────────────────────────────────┼────────┘
                                         │
                    ┌────────────────────┼───────────┐
                    │                    │           │
              ┌─────▼─────┐      ┌──────▼─────┐     │
              │  Supabase  │      │  Upstash   │     │
              │  Postgres  │      │   Redis    │     │
              │            │      │(idempotency│     │
              │ • Products │      │  cache)    │     │
              │ • Inventory│      └────────────┘     │
              │ • Reserves │                         │
              └────────────┘                         │
```

**Stack:**
- **Frontend/Backend:** Next.js 16 (App Router), TypeScript
- **Database:** PostgreSQL via Supabase (managed, free tier)
- **ORM:** Prisma
- **Cache:** Upstash Redis (for idempotency)
- **Validation:** Zod
- **Styling:** Tailwind CSS v4

---

## Running Locally

### Prerequisites
- Node.js ≥ 20
- npm
- A Supabase project (or Neon/Railway Postgres)
- Upstash Redis account (optional, for idempotency)

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/allo-inventory.git
cd allo-inventory
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Postgres connection string (pooled/pgBouncer) |
| `DIRECT_URL` | ✅ | Postgres direct connection (for migrations) |
| `UPSTASH_REDIS_REST_URL` | ❌ | Upstash Redis URL (for idempotency) |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | Upstash Redis token |
| `CRON_SECRET` | ❌ | Secret for cron endpoint auth |
| `RESERVATION_TTL_MINUTES` | ❌ | Reservation hold time (default: 10) |

**Getting Supabase URLs:**
1. Go to [supabase.com](https://supabase.com) → create a project
2. Settings → Database → Connection String
3. Copy **URI** for `DATABASE_URL` (use Transaction/Session pooler mode)
4. Copy **Direct URL** for `DIRECT_URL`

### 3. Run Migrations and Seed

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the product catalog.

### 5. Run Concurrency Test (Optional)

With the dev server running:

```bash
npx tsx scripts/test-concurrency.ts
```

This fires multiple simultaneous reservation requests and verifies that exactly the right number succeed.

---

## Concurrency Model

> **This is the core of the exercise.** The reservation endpoint must be race-condition-free under concurrent access.

### The Problem

If two customers try to reserve the last unit of a product at the same time, a naive read-check-write pattern creates a race condition:

```
Thread A: SELECT stock → sees 1 available
Thread B: SELECT stock → sees 1 available
Thread A: UPDATE reserved += 1 → success (stock now 0)
Thread B: UPDATE reserved += 1 → success (stock now -1!) ← BUG
```

### The Solution: Atomic Conditional UPDATE

Instead of reading stock, checking in application code, and then writing, we perform a **single atomic SQL statement** that only updates if the condition is met:

```sql
UPDATE "InventoryItem"
SET "reservedStock" = "reservedStock" + $quantity,
    "updatedAt" = NOW()
WHERE "productId" = $productId
  AND "warehouseId" = $warehouseId
  AND ("totalStock" - "reservedStock") >= $quantity
```

**Why this is race-condition-free:**

1. PostgreSQL acquires a **row-level lock** on the matching row during the UPDATE statement.
2. If two concurrent transactions try to update the same row, one must wait for the other to complete.
3. When the second transaction executes, it re-evaluates the WHERE clause against the **already-updated** row.
4. If stock is now insufficient, the WHERE clause fails → 0 rows affected → we return HTTP 409.

This approach is wrapped in a Prisma `$transaction` along with the Reservation record creation, ensuring atomicity.

### Why Not Other Approaches?

| Approach | Trade-off |
|----------|-----------|
| `SELECT FOR UPDATE` | Extra round trip; same result, more complex |
| Serializable isolation | Requires retry logic for P2034 errors |
| Redis distributed lock | Adds latency + Redis becomes SPOF for core logic |
| Application-level check | Classic TOCTOU vulnerability |

The atomic UPDATE is the simplest, most performant, and most correct approach for this use case.

---

## Reservation Expiry

Reservations that aren't confirmed within `RESERVATION_TTL_MINUTES` (default: 10) must be released so units return to available stock.

### Approach: Dual Strategy

#### 1. Vercel Cron Job (Production)

A cron job runs **every minute** via Vercel's cron scheduler:

```
GET /api/cron/expire-reservations
Authorization: Bearer $CRON_SECRET
```

It finds all `PENDING` reservations where `expiresAt < NOW()`, marks them as `EXPIRED`, and decrements `reservedStock` on the corresponding inventory item.

Configuration in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/expire-reservations",
    "schedule": "* * * * *"
  }]
}
```

#### 2. Lazy Cleanup on Read (Fallback)

When the `GET /api/products` or `GET /api/reservations/:id` endpoints are called, they also check for expired reservations and clean them up. This ensures:

- No stale data is ever shown to users, even if the cron job is delayed.
- The system works correctly in development (where Vercel cron doesn't run).

### Why Both?

The cron job handles the common case efficiently. Lazy cleanup is a safety net that ensures eventual consistency even if the cron misses a cycle. Together, they guarantee that expired reservations are always cleaned up within seconds.

---

## Idempotency (Bonus)

### Problem

Network failures, timeouts, and retries can cause duplicate requests. Without idempotency, a retry of a successful reservation request would reserve units twice.

### Implementation

Clients can include an `Idempotency-Key` header with any `POST` request:

```bash
curl -X POST /api/reservations \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"productId":"...","warehouseId":"...","quantity":1}'
```

**How it works:**

1. **Check cache:** Before processing, we check Upstash Redis for a cached response keyed by the idempotency key.
2. **Cache hit:** Return the cached response immediately without re-executing the side effect.
3. **Cache miss:** Process the request normally, then cache the response in Redis with a TTL matching the reservation duration.

**Implementation details:**
- Cache key: `idempotency:{key}`
- TTL: Same as reservation TTL (10 minutes for reserves, 24 hours for confirms)
- The idempotency key is also stored as a unique field on the Reservation record as a database-level safeguard
- If Redis is unavailable, the system degrades gracefully — requests proceed without idempotency protection

---

## API Reference

### `GET /api/products`

List all products with per-warehouse availability.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "MacBook Pro 14″ M3",
    "sku": "ELEC-MBP14-M3",
    "description": "...",
    "imageUrl": "https://...",
    "price": 169900,
    "warehouses": [
      {
        "warehouseId": "uuid",
        "warehouseName": "Mumbai Central",
        "warehouseLocation": "Mumbai, Maharashtra",
        "totalStock": 5,
        "reservedStock": 1,
        "availableStock": 4
      }
    ]
  }
]
```

### `GET /api/warehouses`

List all warehouses.

### `POST /api/reservations`

Reserve units for a product at a warehouse.

**Request:**
```json
{
  "productId": "uuid",
  "warehouseId": "uuid",
  "quantity": 1
}
```

**Headers:** `Idempotency-Key: <uuid>` (optional)

**Responses:**
- `201` — Reservation created successfully
- `409` — Insufficient stock available
- `400` — Validation error

### `POST /api/reservations/:id/confirm`

Confirm the reservation (payment succeeded). Permanently decrements stock.

**Responses:**
- `200` — Confirmed successfully
- `410` — Reservation has expired
- `404` — Reservation not found

### `POST /api/reservations/:id/release`

Release the reservation early (payment failed or user cancelled).

**Responses:**
- `200` — Released successfully
- `400` — Cannot release a confirmed reservation
- `404` — Reservation not found

---

## Trade-offs & Future Work

### What I built
- ✅ Full CRUD API with all specified endpoints
- ✅ Concurrency-safe reservation using atomic conditional UPDATE
- ✅ Live countdown timer on checkout page
- ✅ 409/410 error handling visible in the UI
- ✅ Dual expiry mechanism (cron + lazy cleanup)
- ✅ Idempotency via Redis (bonus)
- ✅ Zod validation shared between API and frontend
- ✅ Seed script with realistic data
- ✅ Concurrency test script

### Trade-offs Made
- **No authentication:** The exercise focuses on inventory/reservation logic, not user management. In production, reservations would be tied to user sessions.
- **No WebSocket/SSE:** Stock updates use 15-second polling. For real-time updates at scale, I'd use WebSockets or Server-Sent Events.
- **Single-product reservations:** Each reservation is for one product at one warehouse. A production system would support cart-level reservations spanning multiple products.
- **No rate limiting:** In production, I'd add rate limiting to prevent abuse of the reservation endpoint.

### With More Time
- **WebSocket stock updates** — Push real-time stock changes instead of polling
- **Multi-product cart reservations** — Reserve multiple items atomically
- **Reservation queue** — Instead of immediate 409, offer a waitlist
- **Distributed tracing** — Add OpenTelemetry for observability
- **Load testing** — k6 or Artillery scripts for stress testing the concurrency model
- **E2E tests** — Playwright tests for the full user flow
- **Optimistic UI** — Update stock counts immediately before server confirmation
- **Audit log** — Track all reservation state transitions for ops visibility
