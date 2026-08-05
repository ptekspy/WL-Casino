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
pnpm dev                # local Next.js dev server
pnpm build              # production build
pnpm typecheck          # TypeScript check
pnpm test               # Vitest tests
pnpm sim -- --runs 1000 # simulator smoke run
```

## Current slice

- Latest-package Next.js app using App Router and SSR shell.
- Tailwind CSS v4 with no custom CSS beyond the required Tailwind import.
- TanStack Query provider and mutation-based game play.
- Fresh independent 6×6 board every play.
- Server-resolved Wildwood round through `/api/wildwood/play`.
- 3+ Spirit Seeds trigger an evolving bonus board.
- 1000x max-win cap with uncapped win tracking.
- Local simulator and smoke tests.
- GitHub Actions CI.
- AWS ECS deploy workflow scaffold.

## Important

This is a fake-money prototype only. It is not certified gambling software and must not be used for real-money gambling.
