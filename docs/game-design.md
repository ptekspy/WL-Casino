# Wildwood V1 Game Design

## Core loop

1. Player presses Play in fake-money demo mode.
2. Server generates a fresh 6×6 board from a seed.
3. Collectors gather adjacent target symbols. Overlapping collectors both pay.
4. Collected symbols pay and refill through cascades, with a rising cascade multiplier.
5. Cascades end as soon as no collector has an adjacent target — most boards never cascade.
6. If 3+ Spirit Seeds are seen, the hold-and-win Wildwood bonus starts.
7. Total payout is capped at 1000x stake.
8. Uncapped potential is stored separately for analysis.

## Bonus — hold and win

- Entry rerolls every non-collector cell onto the richer bonus reel.
- Collectors that land are **held** for the rest of the feature and collect on every subsequent breath.
- A new collector resets the breath counter to 3. Otherwise breaths tick down.
- The global multiplier starts at 1x and rises by 1 for every Spirit Seed collected.
- Held collectors × rising multiplier is the only path to the 1000x cap.
- Hard stop at 40 breaths so a round always terminates.

## Math targets

| Metric | Target | Measured (3.2M rounds) |
|---|---:|---:|
| RTP | 94–96% | **95.19%** (95% CI 94.50–95.88) |
| — base game | ~58% | 58.15% |
| — bonus | ~37% | 37.33% |
| Hit rate | ~25% | 25.7% |
| Dead-board rate | ~75% | 74.3% |
| Bonus rate | ~1 in 125 | 1 in 123 |
| Median win | 0x | 0x |
| p99 win | — | 14.6x |
| 1000x cap hits | rare, non-zero | 1 in 139,000 |
| Highest uncapped | — | 3,496x |

Volatility is deliberately high: three quarters of boards pay nothing, and the
bonus carries 39% of the return.

### Tuning

`baseScalar` and `bonusScalar` in `WILDWOOD_CONFIG` are resolved numerically, not
by hand. After changing any weight or symbol value, run:

```bash
pnpm sim:tune
```

and paste the resolved scalars back into the config. `pnpm test` then guards the
result — the base-game RTP band is tight because the base game is low-variance;
the total-RTP band is wider because the bonus is heavy-tailed and 200k rounds
carries roughly ±1.4pp of sampling spread.

## V1 rules

- No real money.
- No persistence between paid plays.
- No player cashout decision.
- No player choice after board reveal.
- Client never decides the result.
- Stakes are validated server-side against `WILDWOOD_CONFIG.allowedStakes`.
- Caller-supplied seeds are a **development-only** test hook. The engine is
  deterministic, so a client that can choose its seed can grind offline and
  submit only winners. Disabled when `NODE_ENV === "production"`.

## Next tasks

1. Animate replay steps — the API already returns per-step cell diffs and the UI has a scrubber.
2. Add a forced-round gallery for dead board, near miss, weak bonus, strong bonus, and 1000x cap.
3. Store demo rounds in Postgres.
4. Add replay-by-round-id.
5. Add fake-money append-only ledger.
6. Add backoffice round search.
7. Replace float money with integer minor units before there is a ledger.
8. Server-side balance and a commit/reveal seed scheme before any real-money path.
