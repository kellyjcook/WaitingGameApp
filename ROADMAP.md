# The Waiting Game — Roadmap

Planned 2026-07-18. Full details live in the [GitHub milestones](https://github.com/kellyjcook/WaitingGameApp/milestones) and their issues.

## Where we're going

The web app pairs with a **physical board game** (10–15k units expected over the next year, up to ~1,000 simultaneous players) and gains a **paid host tier**: a monthly subscription to create custom question sets and distribute them to your own audience via QR code — e.g. a wedding where guests scan a code and play with questions about the couple.

**Target stack:** Next.js on Vercel (full rewrite) · Supabase (Postgres/Auth/RLS, later Realtime) · Stripe (Checkout + Billing).

This vanilla JS app stays live and untouched until the rewrite reaches parity. To guarantee that, all schema changes follow a **v1 compatibility contract** — versioned, additive-only migrations against the shared Supabase project (see [#2](https://github.com/kellyjcook/WaitingGameApp/issues/2)).

## Phases

| Phase | Milestone | Theme |
|---|---|---|
| 0 | [Foundation](https://github.com/kellyjcook/WaitingGameApp/milestone/1) | Next.js scaffold, versioned DB migrations, password rotation, game engine port |
| 1 | [Parity + Cutover](https://github.com/kellyjcook/WaitingGameApp/milestone/2) | Feature parity, DNS cutover, v1 feature freeze |
| 2 | [Commerce](https://github.com/kellyjcook/WaitingGameApp/milestone/3) | Stripe host subscriptions, webhooks, entitlement gating |
| 3 | [Events + QR](https://github.com/kellyjcook/WaitingGameApp/milestone/4) | Hosted events, anonymous QR join, printable QR codes |
| 4 | [Board Game Launch](https://github.com/kellyjcook/WaitingGameApp/milestone/5) | Print-run code batches, rate-limited redemption, load testing |
| 5 | [Synchronized Play](https://github.com/kellyjcook/WaitingGameApp/milestone/6) | Host console, live rounds via Realtime, shared leaderboard |

## Hard constraints

- **Print deadline:** unlock-code format ([#16](https://github.com/kellyjcook/WaitingGameApp/issues/16)) must be final before the printer runs — printed codes can never change.
- **v1 stays working:** no schema change may break the live vanilla app until post-cutover cleanup.
- **Events outlive subscriptions:** an event created while subscribed stays playable through its date even if the host's payment lapses.
