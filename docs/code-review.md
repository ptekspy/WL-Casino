# Wildwood V1 — Code Review

> **Status: addressed.** Everything below was fixed in the follow-up pass except
> the client-supplied seed, which is kept as a development-only test hook and is
> now disabled when `NODE_ENV === "production"`. Current math and known gaps live
> in [game-design.md](game-design.md) and the README. Kept for the record.

Reviewed at commit `8443295`. App verified running at `localhost:3000`.

Overall: the scaffolding is good. Clean separation of engine / API / UI, deterministic seeded RNG, replay steps, a simulator, CI, and a Docker + ECS path. The **game math is broken** and needs to be redone before anything else on the roadmap matters.

---

## 1. Blocker: RTP is 620%, not 95%

Measured over 20,000 rounds of `resolveWildwoodRound`:

| Metric | Measured | Expected for a slot |
|---|---:|---|
| RTP | **619.8%** | 94–96% |
| House edge | **−519.8%** | +4–6% |
| Hit rate | 99.96% | 20–30% |
| Dead-board rate | 0.04% | 70–80% |
| Bonus trigger rate | 36.7% | 0.5–1.5% |
| Avg cascades | 4.98 / 5 | should decay |
| Max-win cap hits | 0 | rare but non-zero |
| Highest win seen | 44x | should approach 1000x |

The house loses ~5.2x stake per spin. Verified live: a single 1.00 spin paid 9.60x.

Win percentiles: p10 = 2.3x, p50 = 4.1x, p90 = 12.5x. Every spin wins, and wins about the same amount. There is no distribution — no losses, and no tail.

### Root causes

**a) Double-counting in `collectBoard` (`wildwood.ts:285`)**

```ts
if (nearby.length > 0) win += 0.01 * nearby.length;   // flat adder
for (const cell of nearby) {
  cells.push(cell);
  win += cell.value * multiplier;                      // same cells again
}
```

The flat `0.01 × count` fires on the same cells that are then paid at face value. Removing it drops RTP from 623% to 506% — it alone accounts for ~19% of total payout. This looks unintentional.

**b) Collector density is far too high**

~7.5 of 36 cells are collectors (fox/owl/stag/wisp = 20.8% combined weight). Each has 8 neighbours, and `wisp` targets 6 of the 11 symbols (73.8% of weight by draw probability). So essentially every collector pays every cascade. There is no "no win" board state.

**c) Cascades don't terminate**

`for (cascade = 1; cascade <= 5)` with `break` only when zero symbols are collected. That happens 0.1% of the time — 99% of rounds run the full 5 cascades. So it's five guaranteed payouts, not a cascade mechanic. `replaceCells` also refills from the same weight table, so collector density is restored every cascade and the board never depletes.

**d) Bonus triggers on cumulative seeds, not board state**

`spiritSeedsSeen` starts at the initial board count (~0.79 expected) and then accumulates every seed collected across all 5 cascades plus refills. Average is 2.17, so the 3-seed threshold is crossed 36.7% of the time. If the intent is "3 seeds visible," this should be a per-board count, not a running total.

**e) Bonus multiplier compounds with no reset**

`bonusMultiplier` starts at 2.2 and only ever increases (+0.2/+0.12/+0.3 per mutation, 2–5 mutations per breath). It carries across all breaths. Average bonus pays 7.2x when triggered.

**f) The 1000x cap is dead code**

Zero cap hits in 20k rounds; best result ever observed was 44x. The `uncappedWin` / `cappedWin` / `capApplied` machinery is well-built but currently unreachable. The UI advertises "MAX WIN 1000x" — not achievable.

### Recommendation

Rebuild the paytable against a target RTP rather than tuning by feel. Concretely:

1. Delete the `0.01 * nearby.length` adder.
2. Drop collector weight to ~2–4% total; make `wisp` rare and narrow its target list.
3. Make cascades probabilistic — continue only if the collection exceeded a threshold, or apply a decaying continue chance.
4. Compute `spiritSeeds` from the board, not cumulatively.
5. Reset or cap `bonusMultiplier` per breath.
6. Add a CI assertion: `expect(simulateWildwood(100_000).rtp).toBeCloseTo(0.95, 2)`. Right now `wildwood.test.ts` only asserts `rtp >= 0`, which is why this shipped.

Also: `page.tsx` hard-codes `RTP target 95%` as a string. Derive it from the engine or a config constant so it can't silently diverge again.

---

## 2. Security: the client picks its own seed

`src/app/api/wildwood/play/route.ts:15`

```ts
const seed = body.seed?.trim() || crypto.randomUUID();
```

The endpoint accepts a caller-supplied seed, and the engine is fully deterministic. A client can grind seeds offline and submit only winners. I found a 32.5x round in 30,000 offline seeds in a few seconds.

Related on the same route:

- **Unbounded stake.** `body.stake > 0` has no ceiling. `POST {"stake": 1e12}` is accepted; the UI select only offers 0.20–5.00.
- **No auth, no rate limiting, no idempotency key.**
- **Balance lives entirely in React state** (`wildwood-game.tsx:22`). Nothing server-side debits or credits.

Acceptable for a fake-money demo — and the README is clear about that — but the seed acceptance should go now, because "server-resolved, client shows the replay" is the property this prototype exists to demonstrate. Server-only seeds, with a commit/reveal scheme if you want provable fairness later.

---

## 3. Architecture notes

**`roundId` consumes an RNG draw** (`wildwood.ts:110`): `Math.floor(rng.next() * 1_000_000)`. Round-ID generation is entangled with game outcome — changing the ID format changes every result for every seed. Move ID generation outside the RNG stream, or derive it from the seed hash.

**Nothing is persisted.** `roundId` is generated and discarded. Roadmap items 3–6 (Postgres, replay-by-id, ledger, backoffice search) all depend on a persistence layer that doesn't exist yet. Worth designing the round record schema before the paytable rewrite, so the rewrite lands with storage in place.

**Replay payloads are heavy.** Every `WildwoodStep` carries a full 36-cell board clone. Largest round JSON I measured was **57 KB**. Send seed + deltas and reconstruct client-side, or the animation work (roadmap item 1) will be fighting payload size.

**Money is floats.** `roundMoney = Number(value.toFixed(4))` throughout. Fine for a demo; use integer minor units before there's a ledger.

**Cell IDs collide across cascades** (`wildwood.ts:306`): `id = ${x}-${y}-${symbol}`. When a cell is replaced by the same symbol at the same position, the React key is unchanged, so the component won't remount. This will cause missed animations once you start animating replay steps.

**Perf** (not urgent at 6×6, but the engine is O(n²)): `neighbours()` scans the full board per collector, and `replaceOne` clones all 36 cells per mutation — up to 5 clones per breath × 12 breaths. Precompute a neighbour adjacency map and mutate a typed array.

---

## 4. Build and CI

**All dependencies are pinned to `"latest"`** — including `next`, `react`, `react-dom`, `tailwindcss`. Combined with `pnpm install --frozen-lockfile=false` in both `ci.yml` and the `Dockerfile`, the lockfile is bypassed and every build can resolve different code. This is the single easiest fix here and it removes a whole class of "works on my machine" failures. Pin real ranges and use `--frozen-lockfile`.

**`noImplicitAny: false`** in `tsconfig.json` while `strict: true` — this specifically disables the check most likely to catch paytable bugs. Turn it on.

**`tsx` is in `devDependencies` but wasn't resolvable** in my sandbox (`node_modules/tsx/dist/cli.mjs` missing), so `pnpm sim` fails. Likely a local install artifact rather than a repo problem, but worth a `pnpm install` to confirm CI's `pnpm sim` step actually runs.

**Deploy workflow** is gated on `vars.AWS_DEPLOY_ENABLED == 'true'` and fires on every push to `main` with no environment protection, no health check, and no rollback. Add a manual approval gate before this points at anything real.

---

## Suggested order

1. Pin dependencies, restore `--frozen-lockfile`, enable `noImplicitAny`.
2. Add the RTP assertion test — make CI fail on the current math.
3. Remove client-supplied seed; bound the stake.
4. Rewrite the paytable to hit 95%.
5. Move `roundId` off the RNG stream; design the round record.
6. Slim replay payloads, then animate.
