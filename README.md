# Since When

Deadpan civic counters for India. "It has been N days since Delhi's AQI
crossed 300", and so on - across a dozen signals that, by rights, should not
be streaks.

This is **not a data scraper**. It's a deterministic event system:

- Every reset is logged, fingerprinted and defensible.
- Every rule runs through the same `processCounter` engine - cron, manual
  entry, and admin-approval all take the same path.
- When the system is unsure, it does nothing. A wrong reset is treated as
  worse than a missed one.

## What's inside

- **Next.js 15** (App Router, standalone) for the UI and public API.
- **SQLite** via `better-sqlite3` - tiny, fast, no ORM.
- **`node-cron`** worker process pinned to `Asia/Kolkata`.
- UI: Solari split-flap digits inside an industrial safety-sign frame. Pure
  CSS, no animation libs.

```
/src
  /app          board, events redirect, admin queue, API routes
  /core         engine, time (IST), fetch, fingerprint, sources, validate,
                events bus, mailer
  /counters     counter modules (fetchData -> normalize -> detectEvent)
  /config       cities, services, exams, thresholds, counter registry
  /db           schema.sql, better-sqlite3 client, queries, seed
  /jobs         node-cron wiring, batch runners, alerts worker
  /manual       shared handler for manual + admin-approve paths
  /ui           SplitFlap, SafetySign, YearlyTile, CounterModal, ...
  worker.ts     cron + alerts entrypoint
```

## Counters

Two counter shapes live on the board:

- **Days-since** - "N days since X happened." Reset to 0 on a confirmed
  event, otherwise ticks up one per IST day.
- **In 2026** - a running tally of qualifying events since 1 Jan 2026. The
  number only goes up.

| Counter                | Shape        | Source(s)                              | Frequency  | Mode     |
|------------------------|--------------|----------------------------------------|------------|----------|
| AQI >= 300             | days-since   | CPCB station feed                      | every 15m  | auto     |
| Fuel price change      | days-since   | IOCL Delhi pricing page                | hourly     | auto     |
| Heatwave               | days-since   | IMD all-India warnings                 | hourly     | auto     |
| Internet outage        | days-since   | Downdetector per-service report feed   | every 15m  | auto     |
| Online price hike      | days-since   | Tracked-service pricing pages          | every 6h   | auto     |
| Train accident         | days-since   | GDELT DOC (India, casualty keywords)   | every 3h   | queue    |
| Urban flooding         | days-since   | GDELT DOC (major city + disruption)    | every 6h   | queue    |
| Exam paper leak        | days-since   | GDELT DOC (exam list + leak keywords)  | every 6h   | queue    |
| Cybercrime cases       | in 2026      | NCRB / I4C (manual entry for now)      | manual     | yearly   |
| Financial fraud cases  | in 2026      | I4C 1930 (manual entry for now)        | manual     | yearly   |
| Internet shutdown orders | in 2026    | SFLC internetshutdowns.in              | every 3h   | yearly   |
| Parliamentary sitting days | in 2026  | PRS Legislative Research (manual)      | manual     | yearly   |

The Job Paradox counter in the bottom-right of the board is a specimen -
it is permanently frozen at 0 and labelled as such. It is not wired to any
real data; the joke is that the "entry-level" role asks for five years.

## Scopes

Counters with `scopeKind` can be viewed for a specific city, service or
exam via the small stencil dropdown in the top-right of each tile:

- `aqi`, `heatwave`, `flooding`, `trainAccident` -> city (from
  [`src/config/cities.ts`](src/config/cities.ts), includes Guwahati,
  Kochi, Ahmedabad, Vadodara, etc.)
- `internetOutage`, `priceHike` -> service
  (from [`src/config/services.ts`](src/config/services.ts))
- `examLeak` -> exam (from [`src/config/exams.ts`](src/config/exams.ts))

Each scope gets its own row in the `counters` table so Delhi's AQI streak
and Mumbai's AQI streak are independent and do not reset each other.

## Alerts (email + local watchlist)

Click a tile -> a modal pops with the current value and the last 5 events.
Two ways to be notified of future resets:

- **Subscribe by email** - enter your email; we send a confirm link; once
  confirmed, every reset for that scoped counter fires one email with
  source and a one-click unsubscribe. Provided by
  [Resend](https://resend.com) (API key in `RESEND_API_KEY`). With no key
  set, subscribe/confirm still works and emails are logged instead of
  sent - useful for local dev.
- **Watch in browser** - a localStorage-backed watchlist per device, no
  server state, nothing to unsubscribe.

## Admin-pinned hero

By default the board hero is the counter with the smallest `daysSince` -
the most damning streak. An administrator can override this:

```
curl -X POST http://localhost:3000/api/admin/hero \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"counterId": "flooding", "scope": "Guwahati"}'
```

Send `{"counterId": null}` to clear the pin and return to auto-selection.

## Local run

```bash
npm install

cp .env.example .env
# edit .env: set ADMIN_TOKEN; optionally set RESEND_API_KEY and
# NEXT_PUBLIC_DONATE_URL.

npm run dev
```

On first boot:

- SQLite file `data/sincewhen.db` is created.
- `schema.sql` is applied.
- Idempotent `ALTER TABLE` migrations run for older DBs (adds `scope`
  columns + the `admin_settings` and `alert_subscriptions` tables).
- `seed.ts` inserts one plausible "first event" per (counter, scope) so
  the board lights up immediately.
- Yearly counters seed a plausible YTD count (editable in
  [`src/config/counters.ts`](src/config/counters.ts)).

Open `http://localhost:3000` for the board,
`http://localhost:3000/admin/queue` for the approval queue,
`http://localhost:3000/api/health` for recent fetch health.

Deep-link any counter's modal with `?open=<defId>&scope=<scope>`:

- `/?open=aqi&scope=Delhi`
- `/?open=internetShutdownOrders`

## Manual entry

```bash
curl -X POST http://localhost:3000/api/manual-event \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "counter_id": "flooding",
    "scope": "Guwahati",
    "event_time": "2026-04-20T02:10:00+05:30",
    "label": "Guwahati: overnight inundation, commutes halted",
    "source_url": "https://www.thehindu.com/"
  }'
```

Manual entries go through the same `processCounter` rules - no bypass.
The source URL must be on the Tier-1 / Tier-2 whitelist in
[`src/core/sources.ts`](src/core/sources.ts).

For yearly-kind counters (e.g. `cybercrimeCases`), the same endpoint is
used; each accepted call increments the 2026 tally by one.

## Deploy

Since this needs a persistent process for cron, deploy to a host that
keeps a node server alive:

### Railway / Render / Fly

Two processes, one shared volume:

- `web`    -> `npm run start:web`  (serves Next.js + hosts the alerts worker)
- `worker` -> `npm run start:worker`  (runs node-cron)
- volume   -> mount `./data` so both processes see the same SQLite file
- env      -> `ADMIN_TOKEN`, `DB_PATH=/data/sincewhen.db`, `SITE_URL`,
  `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `NEXT_PUBLIC_DONATE_URL`

### Single VPS

```
pm2 start "npm run start:web" --name sincewhen-web
pm2 start "npm run start:worker" --name sincewhen-worker
```

## Design rules

- IST everywhere. Store UTC, render Asia/Kolkata.
- Use the first public-report time, never the time we noticed.
- Fingerprints are deterministic. Duplicate reports -> single reset.
- 24-hour cooldown between resets on the same scoped counter.
- Three consecutive fetch failures -> `status = frozen`. The UI shows
  "SENSOR OFFLINE"; the engine refuses to reset while frozen.
- Tier 1 source (government) alone is sufficient. Tier 2 (major media)
  needs two distinct registrable domains.
- If unsure, do not reset.
