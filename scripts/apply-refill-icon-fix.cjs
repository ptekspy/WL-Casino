const fs = require("node:fs");

const path = "src/components/wildwood-pixi-board.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(label, before, after) {
  const index = source.indexOf(before);
  if (index === -1) throw new Error(`Could not find ${label}`);
  if (source.indexOf(before, index + before.length) !== -1) {
    throw new Error(`Found more than one ${label}`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceOnce(
  "applyCellSymbol block",
  `  function applyCellSymbol(cell: CellView, symbol: SymbolType) {
    const texture = getSymbolTexture(symbol);
    cell.symbol = symbol;
    cell.symbolSprite.texture = texture;
    cell.symbolSprite.width = CELL * 0.8;
    cell.symbolSprite.height = CELL * 0.8;
    cell.shadowSprite.texture = texture;
    cell.shadowSprite.width = CELL * 0.8;
    cell.shadowSprite.height = CELL * 0.8;
    drawGlow(cell);
    drawValueLabel(cell);
    drawCollectorTargets(cell);
  }`,
  `  function restoreCellSymbolVisualState(cell: CellView) {
    cell.symbolSprite.mask = null;
    cell.symbolSprite.visible = true;
    cell.symbolSprite.renderable = true;
    cell.symbolSprite.alpha = 1;
    cell.symbolSprite.tint = 0xffffff;
    cell.shadowSprite.visible = true;
    cell.shadowSprite.renderable = true;
    cell.shadowSprite.alpha = 0.32;
  }

  function applyCellSymbol(cell: CellView, symbol: SymbolType) {
    const texture = getSymbolTexture(symbol);
    restoreCellSymbolVisualState(cell);
    cell.symbol = symbol;
    cell.symbolSprite.texture = texture;
    cell.symbolSprite.width = CELL * 0.8;
    cell.symbolSprite.height = CELL * 0.8;
    cell.shadowSprite.texture = texture;
    cell.shadowSprite.width = CELL * 0.8;
    cell.shadowSprite.height = CELL * 0.8;
    drawGlow(cell);
    drawValueLabel(cell);
    drawCollectorTargets(cell);
  }`
);

replaceOnce(
  "forced unit sprite scales",
  `      cell.symbolSprite.scale.x = 1;
      cell.symbolSprite.scale.y = 1;
      cell.shadowSprite.scale.x = 1;
      cell.shadowSprite.scale.y = 1;
`,
  ""
);

replaceOnce(
  "materializeCell block",
  `  async function materializeCell(cell: CellView, symbol: SymbolType, gen: number) {
    await runner.animate(120, (p) => {
      const scale = 1 - Easing.inQuad(p);
      cell.symbolSprite.scale.set(scale);
      cell.shadowSprite.scale.set(scale);
    });
    if (gen !== currentGeneration) return;

    applyCellSymbol(cell, symbol);
    cell.symbolSprite.scale.set(0);
    cell.shadowSprite.scale.set(0);
    cell.symbolSprite.tint = 0xfff6d8;

    spawnBurstParticles([{ x: cell.x, y: cell.y, symbol }]);
    spawnRingPulse(cell.x, cell.y, SYMBOL_COLORS[symbol], { size: CELL * 1.15, duration: 380, alpha: 0.55 });

    const shine = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.shineSweep));
    shine.anchor.set(0.5);
    shine.width = CELL * 1.6;
    shine.height = CELL * 1.6;
    shine.blendMode = "add";
    shine.mask = cell.symbolSprite;
    shine.position.set(CELL / 2 - CELL, CELL / 2);
    cell.container.addChild(shine);

    await Promise.all([
      runner.animate(240, (p) => {
        const scale = Easing.outBack(p);
        cell.symbolSprite.scale.set(scale);
        cell.shadowSprite.scale.set(scale);
        cell.symbolSprite.tint = lerpColor(0xfff6d8, 0xffffff, p * 1.6);
      }),
      runner.animate(320, (p) => {
        shine.position.x = CELL / 2 - CELL + CELL * 2 * Easing.outCubic(p);
        shine.alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      })
    ]);
    cell.symbolSprite.tint = 0xffffff;
    shine.mask = null;
    shine.destroy();
  }`,
  `  async function materializeCell(cell: CellView, symbol: SymbolType, gen: number) {
    restoreCellSymbolVisualState(cell);
    const previousSymbolScaleX = cell.symbolSprite.scale.x;
    const previousSymbolScaleY = cell.symbolSprite.scale.y;
    const previousShadowScaleX = cell.shadowSprite.scale.x;
    const previousShadowScaleY = cell.shadowSprite.scale.y;

    await runner.animate(120, (p) => {
      const scale = 1 - Easing.inQuad(p);
      cell.symbolSprite.scale.set(previousSymbolScaleX * scale, previousSymbolScaleY * scale);
      cell.shadowSprite.scale.set(previousShadowScaleX * scale, previousShadowScaleY * scale);
    });
    if (gen !== currentGeneration || runner.isDestroyed) return;

    applyCellSymbol(cell, symbol);
    const targetSymbolScaleX = cell.symbolSprite.scale.x;
    const targetSymbolScaleY = cell.symbolSprite.scale.y;
    const targetShadowScaleX = cell.shadowSprite.scale.x;
    const targetShadowScaleY = cell.shadowSprite.scale.y;
    cell.symbolSprite.scale.set(0);
    cell.shadowSprite.scale.set(0);
    cell.symbolSprite.tint = 0xfff6d8;

    spawnBurstParticles([{ x: cell.x, y: cell.y, symbol }]);
    spawnRingPulse(cell.x, cell.y, SYMBOL_COLORS[symbol], { size: CELL * 1.15, duration: 380, alpha: 0.55 });

    // Do not use the symbol sprite itself as a Pixi mask. A display object
    // used as a mask can be removed from normal rendering, which left
    // refilled cells showing their value chip but no icon.
    const shine = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.shineSweep));
    shine.anchor.set(0.5);
    shine.width = CELL * 0.72;
    shine.height = CELL * 0.92;
    shine.blendMode = "add";
    shine.alpha = 0;
    shine.position.set(8, CELL / 2);
    cell.container.addChild(shine);

    try {
      await Promise.all([
        runner.animate(240, (p) => {
          const scale = Easing.outBack(p);
          cell.symbolSprite.scale.set(targetSymbolScaleX * scale, targetSymbolScaleY * scale);
          cell.shadowSprite.scale.set(targetShadowScaleX * scale, targetShadowScaleY * scale);
          cell.symbolSprite.tint = lerpColor(0xfff6d8, 0xffffff, p * 1.6);
        }),
        runner.animate(320, (p) => {
          shine.position.x = 8 + (CELL - 16) * Easing.outCubic(p);
          const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
          shine.alpha = alpha * 0.65;
        })
      ]);
    } finally {
      if (shine.parent) shine.destroy();
      if (gen === currentGeneration && !runner.isDestroyed) {
        restoreCellSymbolVisualState(cell);
        cell.symbolSprite.scale.set(targetSymbolScaleX, targetSymbolScaleY);
        cell.shadowSprite.scale.set(targetShadowScaleX, targetShadowScaleY);
      }
    }
  }`
);

fs.writeFileSync(path, source);
