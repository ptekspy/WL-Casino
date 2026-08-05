# WL Casino — Wildwood Prototype

Fake-money Wildwood prototype built with Next.js App Router, Tailwind CSS v4, TanStack Query, and a deterministic TypeScript game engine.

## Run locally

```bash
git clone https://github.com/ptekspy/WL-Casino.git
cd WL-Casino
pnpm install
pnpm dev
```

Open `http://localhost:3000` and press **Play Wildwood**.

## Commands

```bash
pnpm dev                     # local Next.js dev server
pnpm build                   # production build
pnpm typecheck               # TypeScript check
pnpm test                    # Vitest tests, including the RTP guards
pnpm sim -- --runs 200000    # simulation report
pnpm sim:tune                # re-resolve the payout scalars after a paytable change
```

## Math

95.19% RTP measured over 3.2M rounds (95% CI 94.50–95.88%), split 58% base game
/ 37% bonus. High volatility: ~25% hit rate, bonus at ~1 in 125, median win 0x,
1000x cap hit roughly 1 in 139,000 rounds.

`baseScalar` and `bonusScalar` in `WILDWOOD_CONFIG` are resolved numerically by
`pnpm sim:tune` — change any weight or symbol value and re-run it, then paste the
resolved scalars back. `pnpm test` guards the result. See
[docs/game-design.md](docs/game-design.md) for the full table.

## Current slice

- Next.js App Router with an SSR shell, on pinned dependency versions.
- Tailwind CSS v4 with no custom CSS beyond the required Tailwind import.
- TanStack Query provider and mutation-based game play.
- Fresh independent 6×6 board every play.
- Server-resolved Wildwood round through `/api/wildwood/play`, with stakes validated against an allowlist.
- 3+ Spirit Seeds trigger a hold-and-win bonus: collectors are held, the multiplier climbs.
- 1000x max-win cap with uncapped win tracking.
- Replay steps carry cell diffs rather than full boards; the UI has a step scrubber.
- Local simulator, tuner, and math regression tests.
- GitHub Actions CI.
- AWS ECS deploy workflow scaffold.

## Known gaps

- The demo balance lives in client state; nothing server-side debits or credits.
- `/api/wildwood/play` accepts a caller-supplied seed **in development only** as a
  test hook. It is disabled in production builds because the engine is
  deterministic and a chosen seed can be ground offline.
- No auth, rate limiting, or idempotency on the play route.
- Rounds are not persisted, so `roundId` cannot yet be replayed.
- Money is handled as floats; switch to integer minor units before a ledger exists.

## Important

This is a fake-money prototype only. It is not certified gambling software and must not be used for real-money gambling.
