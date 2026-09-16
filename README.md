# Inventory Manager

A small warehouse inventory tracker: products, and a log of stock movements
(`in` / `out`) against them. Current stock is always derived from that log,
never stored directly.

**Stack:** React (Vite) + Express + Postgres (Supabase), deployed on Vercel.

## Running it locally

### Prerequisites

- Node.js 18+
- A Postgres database. This project was built against [Supabase](https://supabase.com)'s
  free tier, but any Postgres instance works.

### 1. Install dependencies

```bash
npm run install:all
```

This installs both `api/` and `client/` separately (they're not an npm
workspace — each has its own `package.json` and `package-lock.json`).

### 2. Configure the database connection

Copy the example env file and fill in your own connection string:

```bash
cp api/.env.example api/.env
```

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

**If you're using Supabase specifically**, two gotchas we hit ourselves:

- Use the **connection pooler** string (Project Settings → Database →
  Connection pooling), not the direct `db.<ref>.supabase.co` host — the
  direct host is IPv6-only and fails to resolve on a lot of networks.
- Don't append `?sslmode=require` to the URL. `api/lib/db.js` already sets
  `ssl: { rejectUnauthorized: false }` in code; `sslmode=require` in the
  connection string overrides that and forces strict certificate
  verification, which fails against Supabase's certificate chain.

### 3. Apply the schema

```bash
npm run db:apply-schema --prefix api
```

This runs `api/schema.sql` against `DATABASE_URL`. You can sanity-check it
landed correctly with:

```bash
npm run db:verify-schema --prefix api
```

### 4. Run the dev servers

```bash
npm run dev
```

This runs the API (`http://localhost:3001`) and the Vite dev server
(`http://localhost:5173`, proxying `/api/*` to the API) together via
`concurrently`.

> **If the API keeps crashing on startup with a garbage exit code**, and
> you're running this from VS Code's Debug Console rather than a plain
> terminal: VS Code's Node debugger auto-attaches to both spawned
> processes and they collide on the same default inspector port. Run
> `npm run dev` from a regular Terminal tab instead, or turn off
> "Debug: Auto Attach" in the command palette.

Alternatively, run each half in its own terminal: `npm run dev --prefix api`
and `npm run dev --prefix client`.

## Database schema

```sql
CREATE TABLE products (
  id                SERIAL PRIMARY KEY,
  sku               TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  reorder_threshold INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE movements (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('in', 'out')),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_product_id ON movements(product_id);
```

Design choices:

- **`sku UNIQUE`** is enforced by the database, not just app-level
  validation. A pre-insert `SELECT` check would be racy — two concurrent
  requests could both pass the check before either inserts. The API
  instead just attempts the insert and catches Postgres error `23505`
  (unique violation), which is the only way to make this actually
  race-free.
- **`type` and `quantity` have `CHECK` constraints** (`type IN ('in',
  'out')`, `quantity > 0`) so no write path — not just the API, but any
  future script, migration, or manual fix — can insert a nonsensical
  movement. Application-level validation only protects requests that go
  through that code path; the constraint protects the data itself.
- **`movements.product_id` is indexed** because every read on this table
  (stock calculation, movement history) filters or joins on it, and this
  table grows unboundedly over time, unlike `products`.
- **`ON DELETE CASCADE`** on `movements.product_id` — there's currently no
  product-delete endpoint, but if one's added later, this keeps the
  movement log from being orphaned or blocking deletion.
- **`SERIAL` integer PKs**, not UUIDs — simpler for a project this size,
  with no cross-system ID generation needs.
- **Movements are append-only**: there is no `UPDATE`/`DELETE` endpoint or
  code path for them anywhere in the API. A correction is made by
  recording a new offsetting movement, the same way a ledger works — this
  keeps the log a true, trustworthy history.

## How stock is calculated

**Current stock is never stored in a column.** There is no `stock` field
on `products`. It's calculated on every read by summing the movement log:

```sql
SELECT
  p.id, p.sku, p.name, p.reorder_threshold, p.created_at,
  COALESCE(SUM(
    CASE WHEN m.type = 'in'  THEN m.quantity
         WHEN m.type = 'out' THEN -m.quantity
         ELSE 0 END
  ), 0)::int AS stock
FROM products p
LEFT JOIN movements m ON m.product_id = p.id
GROUP BY p.id
```

- `LEFT JOIN` keeps products with zero movements in the result set (an
  `INNER JOIN` would drop them).
- The `CASE` turns each movement into a signed quantity — `in` adds,
  `out` subtracts.
- `SUM` collapses all of a product's movements into one net number.
- `COALESCE(..., 0)` — `SUM` over no rows is `NULL` in SQL, not `0`; this
  is what makes a movement-less product report `0` instead of `null`.
- `::int` — Postgres's `SUM()` over an `integer` column returns `bigint`,
  which the `pg` driver stringifies to protect precision; casting back to
  `int` keeps the API response a real JSON number.

The same expression (factored out as `STOCK_EXPRESSION` in
`api/routes/products.js`) is reused for the list endpoint, a single
product's detail view, the `/stock` endpoint, and — inside a transaction —
the availability check before recording an `out` movement.

### Concurrency: why the movement insert is transactional

`POST /api/products/:id/movements` wraps the stock check and the insert in
one transaction that takes a row lock on the product first
(`SELECT ... FOR UPDATE`). Without it: two simultaneous `out` requests
could each read the same stock value, both pass the "is there enough
stock" check, and both insert — overdrawing stock below zero. The row
lock forces the second transaction to wait until the first commits, so it
recomputes stock against the *post-commit* state and correctly gets
rejected if there's no longer enough available.

## What I'd improve with more time

- **Automated tests.** Everything here was verified manually (curl against
  a real deployed Postgres instance, plus a couple of deliberate
  concurrent-request races) rather than with a test suite. The
  transaction/locking logic in the movements endpoint is exactly the kind
  of thing that should have an integration test pinning its behavior.
- **Auth.** The deployed API is completely open — anyone with the URL can
  create products and record movements. Even a minimal gate (shared
  password, or Supabase Auth) would matter for anything beyond a demo.
- **Pagination and server-side sorting** on `GET /api/products`. It
  returns the entire table on every request; fine at demo scale, not fine
  once a catalog has thousands of SKUs.
- **Optimistic UI updates.** The product list and movement history both
  wait for the server round-trip before updating — there's no immediate
  UI feedback with rollback-on-error. Simpler to reason about, but feels
  slower than it needs to on a real network.
- **Structured logging / error monitoring.** Server errors currently just
  go to `console.error`; nothing aggregates or alerts on a spike in 500s.
- **CI.** No GitHub Actions pipeline — build/lint/tests only ever ran
  locally before a commit, on trust.

## What I deliberately chose not to implement

Given the scope, I left these out on purpose rather than by oversight:

- **Editing or archiving products.** Only create and read exist for
  products. If a SKU or name is wrong, there's currently no fix but a
  direct database edit.
- **Multi-user awareness.** No websockets or polling — if two people have
  the app open, one won't see the other's changes until they refresh.
  There's no per-user attribution on movements either (no `note`-adjacent
  "recorded by" field).
- **CSV export / reporting.** No way to get data out beyond reading the
  UI or querying Postgres directly.
- **Bulk operations.** Products and movements are created one at a time;
  no bulk import.
- **Rate limiting.** The API has no request throttling.
- **Deep responsive/mobile polish.** The CSS handles reasonable narrow
  viewports (flex-wrap on the toolbar, etc.) but wasn't tested carefully
  below phone width.

## Deployment

Deployed on Vercel — see `vercel.json` for the build config. The Express
API is deployed via Vercel's automatic `/api` serverless function
detection; the React app is a static Vite build, with a rewrite routing
`/api/*` to the Express app and a catch-all SPA fallback for client-side
routes like `/products/:id`.
