import { readFile, writeFile } from "node:fs/promises";

async function patchFile(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: patch made no changes`);
  await writeFile(path, after);
}

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`${label}: source text not found`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`${label}: source text is not unique`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

await patchFile("src/lib/wildwood.ts", (input) => {
  let source = input;

  source = replaceOnce(
    source,
    `/**\n * Server-authored movement for one collector. The client follows \`moves\` in\n * order, then reverses the same trail back to the collector's starting cell.\n */`,
    `/**\n * Server-authored collection movement for one collector. The client follows\n * \`moves\` in order, then restores the collector at its starting cell without\n * visibly retracing already-cleared squares.\n */`,
    "collector route documentation"
  );

  source = replaceOnce(
    source,
    `  /** Unique cells removed after every collector has completed its route. */\n  collected?: Array<{ x: number; y: number }>;\n  /** Deterministic collector movement and ownership for replay animation. */`,
    `  /** Unique normal cells removed after every collector has completed its route. */\n  collected?: Array<{ x: number; y: number }>;\n  /** Persistent Spirit Seeds rewarded during this step. They are never removed. */\n  spiritSeedsRewarded?: Array<{ x: number; y: number }>;\n  /** Deterministic collector movement and ownership for replay animation. */`,
    "step seed reward payload"
  );

  source = replaceOnce(
    source,
    `    const collection = resolveCollection(board, cascadeMultiplier * WILDWOOD_CONFIG.baseScalar);\n    if (collection.indices.length === 0) break;\n\n    cascades += 1;\n    baseWin += collection.win;\n    steps.push({\n      type: "symbolsCollected",\n      message: \`Cascade \${cascade}: collectors gathered \${collection.indices.length} symbols at \${cascadeMultiplier}x for \${formatWin(collection.win)}x.\`,\n      winDelta: collection.win,\n      collected: collection.indices.map((index) => ({ x: board[index].x, y: board[index].y })),\n      collectorRoutes: collection.collectorRoutes\n    });\n\n    // Refill in place and record only what actually changed.\n    const changes = refill(board, collection.indices, context, WILDWOOD_CONFIG.symbolWeights);\n    spiritSeedsSeen += changes.filter((change) => change.symbol === "spiritSeed").length;\n    steps.push({ type: "cascade", message: \`Cascade \${cascade}: the forest refilled.\`, changes });`,
    `    const collection = resolveCollection(board, cascadeMultiplier * WILDWOOD_CONFIG.baseScalar);\n    if (collection.collectorRoutes.length === 0) break;\n\n    const rewardedTargets = collection.indices.length + collection.spiritSeedIndices.length;\n    cascades += 1;\n    baseWin += collection.win;\n    steps.push({\n      type: "symbolsCollected",\n      message: \`Cascade \${cascade}: collectors rewarded \${rewardedTargets} target\${rewardedTargets === 1 ? "" : "s"} at \${cascadeMultiplier}x for \${formatWin(collection.win)}x.\`,\n      winDelta: collection.win,\n      collected: collection.indices.map((index) => ({ x: board[index].x, y: board[index].y })),\n      spiritSeedsRewarded: collection.spiritSeedIndices.map((index) => ({ x: board[index].x, y: board[index].y })),\n      collectorRoutes: collection.collectorRoutes\n    });\n\n    // A persistent seed can pay on a turn, but it cannot create another turn by\n    // itself because the board did not change.\n    if (collection.indices.length === 0) break;\n\n    // Refill only removed normal symbols. Spirit Seeds remain on the board.\n    const changes = refill(board, collection.indices, context, WILDWOOD_CONFIG.symbolWeights);\n    spiritSeedsSeen += changes.filter((change) => change.symbol === "spiritSeed").length;\n    steps.push({ type: "cascade", message: \`Cascade \${cascade}: the forest refilled.\`, changes });`,
    "base collection flow"
  );

  source = replaceOnce(
    source,
    `      collected: collection.indices.map((index) => ({ x: board[index].x, y: board[index].y })),\n      collectorRoutes: collection.collectorRoutes`,
    `      collected: collection.indices.map((index) => ({ x: board[index].x, y: board[index].y })),\n      spiritSeedsRewarded: collection.spiritSeedIndices.map((index) => ({ x: board[index].x, y: board[index].y })),\n      collectorRoutes: collection.collectorRoutes`,
    "bonus seed reward payload"
  );

  source = replaceOnce(
    source,
    `  spiritSeedsCollected: number;\n};`,
    `  spiritSeedsCollected: number;\n  spiritSeedIndices: number[];\n};`,
    "collection result seed indices"
  );

  source = replaceOnce(
    source,
    ` * board order. A normal symbol becomes an empty traversable cell as soon as it\n * is claimed, so later collectors cannot also receive its value. Spirit Seeds\n * remain available to every eligible collector, but are only refilled once\n * after all routes complete.`,
    ` * board order. A normal symbol becomes an empty traversable cell as soon as it\n * is claimed, so later collectors cannot also receive its value. Spirit Seeds\n * remain available to every eligible collector and persist unchanged after the\n * collection phase, allowing them to pay again on a later cascade or breath.`,
    "collection persistence documentation"
  );

  source = replaceOnce(
    source,
    `  const claimedNormal = new Set<number>();\n  const includedForRefill = new Set<number>();\n  const collectedIndices: number[] = [];`,
    `  const claimedNormal = new Set<number>();\n  const collectedIndices: number[] = [];`,
    "collection state"
  );

  source = replaceOnce(
    source,
    `      if (target.symbol === "spiritSeed") {\n        seedsCollectedByThisCollector.add(destination);\n        collectedSeedIndices.add(destination);\n      } else {\n        claimedNormal.add(destination);\n      }\n\n      if (!includedForRefill.has(destination)) {\n        includedForRefill.add(destination);\n        collectedIndices.push(destination);\n      }`,
    `      if (target.symbol === "spiritSeed") {\n        seedsCollectedByThisCollector.add(destination);\n        collectedSeedIndices.add(destination);\n      } else {\n        claimedNormal.add(destination);\n        collectedIndices.push(destination);\n      }`,
    "persistent seed ownership"
  );

  source = replaceOnce(
    source,
    `    collectorRoutes,\n    spiritSeedsCollected: collectedSeedIndices.size\n  };`,
    `    collectorRoutes,\n    spiritSeedsCollected: collectedSeedIndices.size,\n    spiritSeedIndices: [...collectedSeedIndices]\n  };`,
    "collection result"
  );

  source = replaceOnce(
    source,
    `  for (const index of indices) {\n    const previous = board[index];\n    const symbol = pickSymbol(context.rng, weights);`,
    `  for (const index of indices) {\n    const previous = board[index];\n    // Spirit Seeds are permanent once they have landed. Keep this defensive\n    // guard here so no current or future caller can accidentally overwrite one.\n    if (previous.symbol === "spiritSeed") continue;\n    const symbol = pickSymbol(context.rng, weights);`,
    "refill seed guard"
  );

  source = replaceOnce(
    source,
    `/** Rerolls every non-collector cell onto the bonus reel. */\nfunction rerollAll(board: BoardCell[], context: RoundContext): CellChange[] {\n  const indices: number[] = [];\n  for (let index = 0; index < board.length; index += 1) {\n    if (!isCollector(board[index].symbol)) indices.push(index);\n  }`,
    `/** Rerolls every replaceable cell onto the bonus reel. Held collectors and persistent Spirit Seeds stay put. */\nfunction rerollAll(board: BoardCell[], context: RoundContext): CellChange[] {\n  const indices: number[] = [];\n  for (let index = 0; index < board.length; index += 1) {\n    const symbol = board[index].symbol;\n    if (!isCollector(symbol) && symbol !== "spiritSeed") indices.push(index);\n  }`,
    "bonus opening persistence"
  );

  source = replaceOnce(
    source,
    `    if (isCollector(board[index].symbol)) continue; // held collectors are never overwritten`,
    `    if (isCollector(board[index].symbol) || board[index].symbol === "spiritSeed") continue; // held collectors and seeds persist`,
    "bonus mutation persistence"
  );

  return source;
});

await patchFile("src/components/wildwood-pixi-board.tsx", (input) => {
  let source = input;

  source = replaceOnce(
    source,
    `          await moveTo(move.x, move.y, 150);`,
    `          await moveTo(move.x, move.y, 180);`,
    "slower collector movement"
  );

  source = replaceOnce(
    source,
    `          await runner.animate(130, (p) => {`,
    `          await runner.animate(150, (p) => {`,
    "slower collection impact"
  );

  source = replaceOnce(
    source,
    `        const returnTrail = route.moves.slice(0, -1).reverse();\n        for (const move of returnTrail) {\n          await moveTo(move.x, move.y, 95);\n          if (gen !== currentGeneration) return;\n        }\n        await moveTo(route.x, route.y, 120);`,
    `        // Do not visibly retrace the cleared route. Fade the travelling\n        // collector at its final target, then restore the authoritative origin.\n        await runner.animate(170, (p) => {\n          mover.alpha = 1 - Easing.inQuad(p);\n          mover.scale.set(1 - p * 0.14);\n        });`,
    "remove return retrace"
  );

  source = replaceOnce(
    source,
    `        if (mover.parent) mover.destroy({ children: true });\n        if (gen === currentGeneration && !runner.isDestroyed) applyCellSymbol(origin, route.symbol);`,
    `        if (mover.parent) mover.destroy({ children: true });\n        if (gen === currentGeneration && !runner.isDestroyed) {\n          applyCellSymbol(origin, route.symbol);\n          spawnRingPulse(route.x, route.y, SYMBOL_COLORS[route.symbol], { size: CELL * 0.9, duration: 260, alpha: 0.35 });\n        }`,
    "collector origin restoration"
  );

  source = replaceOnce(
    source,
    `          if (step.collected?.length) {\n            const seedsTaken = step.collected.filter(({ x, y }) => prev[y * COLS + x].symbol === "spiritSeed").length;\n            await playCollect(step, prev, myGeneration, comboStreak, stake);`,
    `          if (step.collectorRoutes?.length || step.collected?.length) {\n            const seedsRewarded = step.spiritSeedsRewarded?.length ?? 0;\n            await playCollect(step, prev, myGeneration, comboStreak, stake);`,
    "bonus playback persistent seeds"
  );

  source = replaceOnce(
    source,
    `            if (seedsTaken > 0) {\n              multiplier += seedsTaken;`,
    `            if (seedsRewarded > 0) {\n              multiplier += seedsRewarded;`,
    "bonus multiplier playback"
  );

  source = replaceOnce(
    source,
    `        if (step.collected?.length) {\n          const prev = i === 0 ? activeRound.initialBoard : frames[i - 1];\n          const seedsTaken = step.collected.filter(({ x, y }) => prev[y * COLS + x].symbol === "spiritSeed").length;\n          multiplier += seedsTaken;\n          potCash += (step.winDelta ?? 0) * stake;\n        }`,
    `        if (step.collectorRoutes?.length || step.collected?.length) {\n          multiplier += step.spiritSeedsRewarded?.length ?? 0;\n          potCash += (step.winDelta ?? 0) * stake;\n        }`,
    "seek persistent seed multiplier"
  );

  return source;
});

await patchFile("src/lib/wildwood.test.ts", (input) => {
  let source = input;

  source = replaceOnce(
    source,
    ` * The authoritative figure comes from the tuner: over 3.2M rounds the engine\n * returns 95.19% (95% CI 94.50–95.88%), split 58.2% base / 37.3% bonus.\n * Re-run \`pnpm sim:tune\` after touching any weight or symbol value.`,
    ` * Persistent Spirit Seeds materially affect both cascade and bonus tails.\n * Re-run \`pnpm sim:tune\` after changing their lifecycle, any weight, or any\n * symbol value, then validate the resolved scalars over a larger sample.`,
    "math test documentation"
  );

  source = replaceOnce(
    source,
    `    expect(collection.indices).toEqual([1]);\n    expect(collection.spiritSeedsCollected).toBe(1);`,
    `    expect(collection.indices).toEqual([]);\n    expect(collection.spiritSeedsCollected).toBe(1);\n    expect(collection.spiritSeedIndices).toEqual([1]);\n    expect(board[1].symbol).toBe("spiritSeed");`,
    "seed persistence test"
  );

  return source;
});

console.log("Applied non-retracing collector movement and fully persistent Spirit Seeds.");
