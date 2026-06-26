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
- **Backend** — Node + Express + `ws`. In-memory state (no database), a REST API
  for mutations, and a dispatch simulator that ticks every 350 ms.

## Run it

```bash
npm install        # installs both workspaces (server + web)
npm run dev        # starts the API on :4100 and the UI on :5180
```

Then open **http://localhost:5180**.

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
server/   Express + ws API, in-memory store, dispatch simulator
web/      React + Vite client (external store over WebSocket)
```
