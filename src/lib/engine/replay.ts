import type { EngineBoardCell, EngineCellChange } from "./collection";

/** Rebuilds a board state by applying replay diffs over a prior board. */
export function applyChanges<TSymbol extends string>(
  board: readonly EngineBoardCell<TSymbol>[],
  changes: readonly EngineCellChange<TSymbol>[],
  width: number,
  valueFor: (symbol: TSymbol) => number
): EngineBoardCell<TSymbol>[] {
  const next = board.map((cell) => ({ ...cell }));
  for (const change of changes) {
    const index = change.y * width + change.x;
    next[index] = {
      id: `${change.x}-${change.y}-${change.symbol}-${index}`,
      x: change.x,
      y: change.y,
      symbol: change.symbol,
      value: valueFor(change.symbol)
    };
  }
  return next;
}

/**
 * Steps carry cell diffs rather than full boards, so the board state at each
 * step is rebuilt here by folding the diffs over `initialBoard`. Returns one
 * frame per step, `frames[i]` being the board immediately after `steps[i]`.
 */
export function buildFrames<TSymbol extends string, TStep extends { changes?: readonly EngineCellChange<TSymbol>[] }>(
  initialBoard: readonly EngineBoardCell<TSymbol>[],
  steps: readonly TStep[],
  width: number,
  valueFor: (symbol: TSymbol) => number
): EngineBoardCell<TSymbol>[][] {
  const frames: EngineBoardCell<TSymbol>[][] = [];
  // Never mutated in place — every reassignment below goes through applyChanges,
  // which always returns a fresh array. The cast just satisfies readonly-in/mutable-out.
  let board = initialBoard as EngineBoardCell<TSymbol>[];
  for (const step of steps) {
    if (step.changes?.length) board = applyChanges(board, step.changes, width, valueFor);
    frames.push(board);
  }
  return frames;
}
