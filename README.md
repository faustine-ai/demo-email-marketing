# RELAY — dispatch console

A real-time email marketing console. Configure campaigns, sending mailboxes,
audiences and templates, then watch dispatch happen live over WebSockets.

No real email is ever sent — a server-side simulator models what a sending
campaign looks like (deliveries, opens, clicks, bounces) and streams it to the
UI. This is a demo of the configuration + real-time surface, not a mail server.

## Stack

- **Frontend** — React 18 + Vite. A single external store wired to a WebSocket
  feed; every significant change (campaign progress, mailbox health, activity)
  arrives as a push and re-renders the relevant view. Open two tabs to see them
  stay in sync.
- **Backend** — Node + Express + `ws`. A SQLite database (via `better-sqlite3`)
  is the durable store; the server keeps a live in-memory copy and writes through
  on every change. A dispatch simulator ticks every 350 ms.

## Run it with Docker (recommended)

```bash
docker compose up
```

Then open **http://localhost:5180**.

One container runs both the API (`:4100`) and the Vite UI (`:5180`). The SQLite
database is stored on a named volume (`relay-data`), so campaigns, sequences and
dispatch progress **survive restarts**. Source is bind-mounted, so:

- editing **UI files** (`web/src`) hot-reloads the browser **and restarts the
  API server** (via `nodemon`);
- editing **server files** restarts the API server too.

To start from a clean database, drop the volume: `docker compose down -v`.

## Run it without Docker

```bash
npm install        # installs both workspaces (server + web)
npm run dev        # starts the API on :4100 and the UI on :5180
```

The SQLite file is written to `./data/relay.db` (override with `DB_PATH`).
The Vite dev server proxies `/api` and `/ws` to the backend, so everything runs
from one origin.

## What to try

- **Overview** — the live dispatch stream (the signature view), aggregate
  metrics, in-flight campaigns and a streaming activity feed.
- **Campaigns** — open one and hit **Launch now**; watch the funnel and stream
  fill in real time. Pause, resume, schedule, or delete.
- **Mailboxes** — reputation, warmup, SPF/DKIM/DMARC, daily volume; pause a
  sender and the change broadcasts everywhere.
- **Audiences / Templates** — create segments and layouts; new records appear
  instantly in any open session.

## Layout

```
server/   Express + ws API, SQLite store (db.js), dispatch simulator
web/      React + Vite client (external store over WebSocket)
```
