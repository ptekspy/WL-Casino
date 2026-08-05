# Wildwood V1 Game Design

## Core loop

1. Player presses Play in fake-money demo mode.
2. Server generates a fresh 6×6 board from a seed.
3. Collectors gather adjacent target symbols.
4. Collected symbols pay and refill through cascades.
5. If 3+ Spirit Seeds are seen, the evolving Wildwood bonus starts.
6. Bonus breaths mutate the board, collect symbols, and may award extra breaths.
7. Total payout is capped at 1000x stake.
8. Uncapped potential is stored separately for analysis.

## V1 rules

- No real money.
- No persistence between paid plays.
- No player cashout decision.
- No player choice after board reveal.
- Client never decides the result.

## Next tasks

1. Animate replay steps instead of showing the final board instantly.
2. Add a forced-round gallery for dead board, near miss, weak bonus, strong bonus, and 1000x cap.
3. Store demo rounds in Postgres.
4. Add replay-by-round-id.
5. Add fake-money append-only ledger.
6. Add backoffice round search.
