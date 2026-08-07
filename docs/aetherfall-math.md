# Aetherfall math model

Aetherfall is a JRPG-style casino battle prototype. A wager resolves to one server-authored payout multiplier first; enemy selection, attack names, damage numbers, critical hits, party HP and Limit-meter animation are generated only after that payout has been fixed.

That separation matters: combat presentation cannot change the monetary result.

## Target

- Theoretical RTP: **95.00%**
- House edge: **5.00%**
- Required design band: **94–96%**
- Maximum win: **1000x**
- Weight total per profile: **1,000,000**

Every lead has the same expected return. Choosing a lead changes volatility only.

## Paytables

### Vanguard, low volatility

| Multiplier | Weight |
|---:|---:|
| 0x | 44,000 |
| 0.25x | 100,000 |
| 0.5x | 100,000 |
| 0.75x | 100,000 |
| 1x | 456,000 |
| 1.25x | 100,000 |
| 1.5x | 50,000 |
| 2x | 30,000 |
| 3x | 15,000 |
| 5x | 4,000 |
| 10x | 800 |
| 50x | 180 |
| 100x | 20 |

Expected multiplier = **0.950000x**.

### Spellblade, balanced

| Multiplier | Weight |
|---:|---:|
| 0x | 225,289 |
| 0.25x | 150,000 |
| 0.5x | 120,000 |
| 1x | 406,500 |
| 2x | 60,000 |
| 5x | 25,000 |
| 10x | 10,000 |
| 25x | 3,000 |
| 100x | 200 |
| 500x | 10 |
| 1000x | 1 |

Expected multiplier = **0.950000x**.

### Shadow, high volatility

| Multiplier | Weight |
|---:|---:|
| 0x | 616,978 |
| 0.25x | 40,000 |
| 0.5x | 30,000 |
| 1x | 243,000 |
| 2x | 25,000 |
| 5x | 20,000 |
| 10x | 12,000 |
| 25x | 12,000 |
| 100x | 1,000 |
| 500x | 20 |
| 1000x | 2 |

Expected multiplier = **0.950000x**.

## Deterministic validation

The engine exposes `getAetherfallTheoreticalRtp()` and `simulateAetherfall()`. Vitest guards assert the exact theoretical return is 95% for every lead and that deterministic 250,000-round samples remain inside 94–96%.

A separate one-million-round cross-check using the same xmur3/sfc32 RNG and the same `rtp-<lead>-<index>` seed sequence produced:

| Lead | 1,000,000-round RTP |
|---|---:|
| Vanguard | 95.0765% |
| Spellblade | 95.2111% |
| Shadow | 94.8988% |

Re-run locally with:

```bash
pnpm sim:aetherfall
pnpm sim:aetherfall -- --runs=2000000
```

## Change control

Any change to multiplier values or weights changes the gambling math and must be accompanied by:

1. Recalculation of the exact weighted expected return.
2. `pnpm test`.
3. A large `pnpm sim:aetherfall` run.
4. Updated documentation if the return or volatility profile changes.

This is prototype math, not a certified gambling math sheet or regulatory approval.
