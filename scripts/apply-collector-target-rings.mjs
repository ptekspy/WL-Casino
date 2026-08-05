import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Could not find ${label}`);
  return source.replace(before, after);
}

const boardPath = "src/components/wildwood-pixi-board.tsx";
let board = readFileSync(boardPath, "utf8");

const drawGlowBefore = `  function drawGlow(cell: CellView) {
    cell.glow.clear();
    if (!cell.symbol) return;
    if (isCollectorSymbol(cell.symbol)) {
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.47).stroke({ width: 3, color: SYMBOL_COLORS[cell.symbol], alpha: 0.6 });
    } else if (cell.symbol === "spiritSeed") {
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.47).stroke({ width: 2.5, color: SYMBOL_COLORS.spiritSeed, alpha: 0.5 });
    }
  }
`;

const drawGlowAfter = `  function drawGlow(cell: CellView) {
    cell.glow.clear();
    if (!cell.symbol) return;
    if (isCollectorSymbol(cell.symbol)) {
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.47).stroke({ width: 3, color: SYMBOL_COLORS[cell.symbol], alpha: 0.6 });
    } else if (cell.symbol === "spiritSeed") {
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.47).stroke({ width: 2.5, color: SYMBOL_COLORS.spiritSeed, alpha: 0.5 });
    }
  }

  /**
   * Preview server-authored ownership before collection begins. Normal targets
   * get one full ring in their owning collector's colour. Spirit Seeds are the
   * only shared target, so they can show multiple concentric collector rings.
   */
  function setCollectorTargetPreview(step: WildwoodStep | undefined) {
    for (const cell of cells) drawGlow(cell);

    const collectorsByTarget = new Map<string, CollectorType[]>();
    for (const route of step?.collectorRoutes ?? []) {
      for (const move of route.moves) {
        if (!move.collect) continue;
        const key = coordKey(move.x, move.y);
        const collectors = collectorsByTarget.get(key) ?? [];
        if (!collectors.includes(route.symbol)) collectors.push(route.symbol);
        collectorsByTarget.set(key, collectors);
      }
    }

    for (const [key, collectors] of collectorsByTarget) {
      const [x, y] = key.split(":").map(Number);
      const cell = cellAt(x, y);
      cell.glow.clear();
      collectors.slice(0, 4).forEach((collector, index) => {
        const radius = CELL * (0.47 - index * 0.045);
        cell.glow.circle(CELL / 2, CELL / 2, radius).stroke({
          width: 3,
          color: SYMBOL_COLORS[collector],
          alpha: 0.88
        });
      });
    }
  }

  function clearCollectorTargetPreview() {
    for (const cell of cells) drawGlow(cell);
  }
`;

board = replaceOnce(board, drawGlowBefore, drawGlowAfter, "drawGlow block");

board = replaceOnce(
  board,
  `        case "boardGenerated":
          await playIntro(prev, myGeneration);
          if (myGeneration !== currentGeneration) return;
          potBadge.setAmount(0);`,
  `        case "boardGenerated":
          await playIntro(prev, myGeneration);
          if (myGeneration !== currentGeneration) return;
          setCollectorTargetPreview(round.steps[i + 1]);
          potBadge.setAmount(0);`,
  "board-generated preview"
);

board = replaceOnce(
  board,
  `        case "symbolsCollected":
          await playCollect(step, prev, myGeneration, comboStreak, stake);
          comboStreak += 1;
          cascadeCount += 1;
          if (myGeneration !== currentGeneration) return;`,
  `        case "symbolsCollected":
          await playCollect(step, prev, myGeneration, comboStreak, stake);
          if (myGeneration !== currentGeneration) return;
          clearCollectorTargetPreview();
          comboStreak += 1;
          cascadeCount += 1;`,
  "base collection preview cleanup"
);

board = replaceOnce(
  board,
  `        case "cascade":
          await playRefill(step, myGeneration);
          break;`,
  `        case "cascade":
          await playRefill(step, myGeneration);
          if (myGeneration !== currentGeneration) return;
          setCollectorTargetPreview(round.steps[i + 1]);
          break;`,
  "cascade preview"
);

board = replaceOnce(
  board,
  `        case "bonusBreath": {
          if (step.collectorRoutes?.length || step.collected?.length) {
            const seedsRewarded = step.spiritSeedsRewarded?.length ?? 0;
            await playCollect(step, prev, myGeneration, comboStreak, stake);
            comboStreak += 1;
            if (myGeneration !== currentGeneration) return;`,
  `        case "bonusBreath": {
          if (step.collectorRoutes?.length || step.collected?.length) {
            const seedsRewarded = step.spiritSeedsRewarded?.length ?? 0;
            setCollectorTargetPreview(step);
            await runner.wait(220);
            if (myGeneration !== currentGeneration) return;
            await playCollect(step, prev, myGeneration, comboStreak, stake);
            if (myGeneration !== currentGeneration) return;
            clearCollectorTargetPreview();
            comboStreak += 1;`,
  "bonus collection preview"
);

writeFileSync(boardPath, board);

const testPath = "src/lib/wildwood.test.ts";
let tests = readFileSync(testPath, "utf8");
const testAnchor = `  it("only routes through the origin, already-cleared cells, or collectable targets", () => {`;
const ownershipTest = `  it("allows only Spirit Seeds to be claimed by multiple collectors", () => {
    const collectableSymbols: SymbolType[] = ["leaf", "acorn", "mushroom", "bloom", "root", "spiritSeed"];
    const collectorPositions = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 2 }
    ];
    const collectorTypes = ["fox", "owl", "stag", "wisp"] as const;

    for (const symbol of collectableSymbols) {
      const applicableCollectors = collectorTypes.filter((collector) =>
        (WILDWOOD_CONFIG.collectorTargets[collector] as readonly SymbolType[]).includes(symbol)
      );
      const board = buildTestBoard([
        { x: 2, y: 2, symbol },
        ...applicableCollectors.map((collector, index) => ({ ...collectorPositions[index], symbol: collector }))
      ]);

      const collection = resolveCollection(board);
      const claimers = collection.collectorRoutes
        .filter((route) => route.moves.some((move) => move.collect && move.x === 2 && move.y === 2))
        .map((route) => route.symbol);

      if (symbol === "spiritSeed") {
        expect(new Set(claimers).size).toBe(applicableCollectors.length);
        expect(collection.indices).not.toContain(2 * WILDWOOD_CONFIG.width + 2);
      } else {
        expect(claimers).toHaveLength(1);
        expect(collection.indices).toContain(2 * WILDWOOD_CONFIG.width + 2);
      }
    }
  });

`;

tests = replaceOnce(tests, testAnchor, ownershipTest + testAnchor, "shared ownership regression test anchor");
writeFileSync(testPath, tests);

console.log("Applied collector ownership preview rings and ownership regression coverage.");
