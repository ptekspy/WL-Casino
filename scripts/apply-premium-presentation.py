from pathlib import Path

path = Path("src/components/wildwood-pixi-board.tsx")
source = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    source = source.replace(old, new, 1)


replace_once(
    'import { wildwoodSound } from "@/lib/pixi/sound";\n',
    'import { wildwoodSound } from "@/lib/pixi/sound";\nimport { getWinPresentation, type WinPresentationTier } from "@/lib/pixi/presentation";\n',
    "presentation import",
)

replace_once(
'''export type WildwoodBoardHandle = {
  /** Instantly jumps to a step, cancelling any in-flight autoplay. */
  seek: (stepIndex: number) => void;
  /** Instantly jumps to the final step of the current round. */
  skipToEnd: () => void;
};''',
'''export type WildwoodBoardHandle = {
  /** Instantly jumps to a step, cancelling any in-flight autoplay. */
  seek: (stepIndex: number) => void;
  /** Instantly jumps to the final step of the current round. */
  skipToEnd: () => void;
  /** Speeds up or restores the complete Pixi choreography without changing game math. */
  setTurbo: (enabled: boolean) => void;
};''',
    "board handle",
)

replace_once(
'''  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<BoardWorld | null>(null);
  const lastRoundIdRef = useRef<string | null>(null);''',
'''  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<BoardWorld | null>(null);
  const speedRef = useRef(1);
  const lastRoundIdRef = useRef<string | null>(null);''',
    "speed ref",
)

replace_once(
'''    () => ({
      seek: (index) => worldRef.current?.seek(index),
      skipToEnd: () => worldRef.current?.skipToEnd()
    }),''',
'''    () => ({
      seek: (index) => worldRef.current?.seek(index),
      skipToEnd: () => worldRef.current?.skipToEnd(),
      setTurbo: (enabled) => {
        speedRef.current = enabled ? 1.65 : 1;
        worldRef.current?.setSpeed(speedRef.current);
      }
    }),''',
    "imperative handle",
)

replace_once(
'''      const world = buildWorld(app);
      worldRef.current = world;
      world.resize();''',
'''      const world = buildWorld(app);
      worldRef.current = world;
      world.setSpeed(speedRef.current);
      world.resize();''',
    "initial speed",
)

replace_once(
'''  seek: (index: number) => void;
  skipToEnd: () => void;
  destroy: () => void;''',
'''  seek: (index: number) => void;
  skipToEnd: () => void;
  setSpeed: (scale: number) => void;
  destroy: () => void;''',
    "world speed type",
)

replace_once(
'''  spotlight.eventMode = "none";
  boardContainer.addChild(spotlight);

  const fxLayer = new Container();''',
'''  spotlight.eventMode = "none";
  boardContainer.addChild(spotlight);

  // Temporarily lowers the rest of the board during target lock, shared Seed
  // celebrations and win ceremonies so the important action reads immediately.
  const focusShade = new Graphics().rect(0, 0, BOARD_W, BOARD_H).fill({ color: 0x010503, alpha: 1 });
  focusShade.alpha = 0;
  focusShade.eventMode = "none";
  boardContainer.addChild(focusShade);

  const fxLayer = new Container();''',
    "focus shade",
)

start = source.index('  async function playCollectorRoutes(')
end = source.index('  async function playCollect(', start)
new_collector_block = '''  type RenderCollectorRoute = NonNullable<WildwoodStep["collectorRoutes"]>[number];

  function buildRouteTelegraph(route: RenderCollectorRoute): Graphics {
    const routeLine = new Graphics();
    const color = SYMBOL_COLORS[route.symbol];
    let [previousX, previousY] = cellCenter(route.x, route.y);
    for (const move of route.moves) {
      const [nextX, nextY] = cellCenter(move.x, move.y);
      routeLine.moveTo(previousX, previousY).lineTo(nextX, nextY).stroke({ width: 7, color, alpha: 0.1, cap: "round" });
      routeLine.moveTo(previousX, previousY).lineTo(nextX, nextY).stroke({ width: 2.5, color, alpha: 0.78, cap: "round" });
      if (move.collect) {
        routeLine.circle(nextX, nextY, 10).stroke({ width: 2, color: 0xffffff, alpha: 0.72 });
        routeLine.circle(nextX, nextY, 15).stroke({ width: 2, color, alpha: 0.5 });
      }
      previousX = nextX;
      previousY = nextY;
    }
    routeLine.alpha = 0;
    fxLayer.addChild(routeLine);
    return routeLine;
  }

  async function playCollectorAnticipation(route: RenderCollectorRoute, origin: CellView, gen: number): Promise<Graphics> {
    const routeLine = buildRouteTelegraph(route);
    wildwoodSound.playTargetLock(route.symbol);
    await runner.animate(180, (p) => {
      focusShade.alpha = p * 0.28;
      routeLine.alpha = Easing.outQuad(p);
    });
    if (gen !== currentGeneration) return routeLine;

    const targets = route.moves.filter((move) => move.collect);
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      wildwoodSound.playTargetLock(route.symbol, index);
      spawnRingPulse(target.x, target.y, SYMBOL_COLORS[route.symbol], { size: CELL * 1.05, duration: 260, alpha: 0.58 });
      const targetCell = cellAt(target.x, target.y);
      await runner.animate(90, (p) => targetCell.container.scale.set(1 + Math.sin(p * Math.PI) * 0.055));
      targetCell.container.scale.set(1);
      if (gen !== currentGeneration) return routeLine;
    }

    origin.motionLocked = true;
    await runner.animate(240, (p) => {
      const k = Math.sin(p * Math.PI);
      switch (route.symbol) {
        case "fox":
          origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.1), origin.baseSymbolScaleY * (1 - k * 0.13));
          origin.symbolSprite.rotation = -k * 0.08;
          origin.symbolSprite.position.y = CELL / 2 + k * 5;
          break;
        case "owl":
          origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.17), origin.baseSymbolScaleY * (1 - k * 0.06));
          origin.symbolSprite.position.y = CELL / 2 - k * 7;
          break;
        case "stag":
          origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.08), origin.baseSymbolScaleY * (1 + k * 0.12));
          origin.symbolSprite.position.y = CELL / 2 - k * 5;
          break;
        case "wisp":
          origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 - k * 0.14), origin.baseSymbolScaleY * (1 + k * 0.18));
          origin.symbolSprite.rotation = k * 0.13;
          break;
      }
      origin.glow.alpha = 0.55 + k * 0.45;
    });
    origin.motionLocked = false;
    origin.symbolSprite.rotation = 0;
    origin.symbolSprite.position.set(CELL / 2, CELL / 2);
    origin.symbolSprite.scale.set(origin.baseSymbolScaleX, origin.baseSymbolScaleY);
    return routeLine;
  }

  async function playCollectorSignatureImpact(
    symbol: CollectorType,
    mover: Container,
    icon: Sprite,
    targetX: number,
    targetY: number
  ) {
    const signature = new Graphics();
    const color = SYMBOL_COLORS[symbol];
    const [cx, cy] = cellCenter(targetX, targetY);
    signature.position.set(cx, cy);
    switch (symbol) {
      case "fox":
        signature.moveTo(-31, 20).lineTo(28, -21).stroke({ width: 8, color, alpha: 0.18, cap: "round" });
        signature.moveTo(-27, 18).lineTo(30, -23).stroke({ width: 3, color: 0xfff2c4, alpha: 0.92, cap: "round" });
        break;
      case "owl":
        signature.moveTo(-34, -15).lineTo(0, 10).lineTo(34, -15).stroke({ width: 5, color, alpha: 0.7, cap: "round" });
        signature.circle(0, 8, 12).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
        break;
      case "stag":
        for (let index = 0; index < 8; index += 1) {
          const angle = (index / 8) * Math.PI * 2;
          signature.moveTo(Math.cos(angle) * 9, Math.sin(angle) * 9).lineTo(Math.cos(angle) * 40, Math.sin(angle) * 40).stroke({ width: 4, color, alpha: 0.7, cap: "round" });
        }
        break;
      case "wisp":
        signature.circle(0, 0, 17).stroke({ width: 8, color, alpha: 0.2 });
        signature.circle(0, 0, 12).stroke({ width: 3, color: 0xffffff, alpha: 0.78 });
        break;
    }
    signature.blendMode = "add";
    fxLayer.addChild(signature);

    await runner.animate(190, (p) => {
      const impact = Math.sin(p * Math.PI);
      signature.alpha = 1 - p;
      signature.scale.set(0.65 + Easing.outCubic(p) * 0.7);
      switch (symbol) {
        case "fox":
          mover.rotation = -0.1 + p * 0.2;
          icon.position.x = impact * 8;
          break;
        case "owl":
          mover.position.y += p < 0.5 ? -0.8 : 1.2;
          icon.scale.set(1 + impact * 0.16, 1 - impact * 0.08);
          break;
        case "stag":
          mover.position.y += impact * 0.8;
          icon.scale.set(1 + impact * 0.1, 1 + impact * 0.16);
          break;
        case "wisp":
          icon.scale.set(1 + impact * 0.3, 1 - impact * 0.18);
          icon.rotation += 0.06;
          break;
      }
    });
    signature.destroy();
    mover.rotation = 0;
    icon.position.set(0, 0);
    icon.scale.set(1);
  }

  async function playCollectorCelebration(symbol: CollectorType, mover: Container, aura: Graphics) {
    wildwoodSound.playCollectorCelebrate(symbol);
    await runner.animate(230, (p) => {
      const bounce = Math.sin(p * Math.PI);
      aura.alpha = 0.45 + bounce * 0.55;
      switch (symbol) {
        case "fox":
          mover.rotation = Math.sin(p * Math.PI * 2) * 0.09;
          mover.position.y -= bounce * 0.45;
          break;
        case "owl":
          mover.scale.set(1 + bounce * 0.12, 1 - bounce * 0.04);
          break;
        case "stag":
          mover.scale.set(1 + bounce * 0.08, 1 + bounce * 0.1);
          break;
        case "wisp":
          mover.rotation += 0.08;
          mover.scale.set(1 + bounce * 0.17);
          break;
      }
    });
    mover.rotation = 0;
    mover.scale.set(1);
    aura.alpha = 1;
  }

  async function playSharedSeedCelebration(
    x: number,
    y: number,
    collectors: readonly CollectorType[],
    gen: number
  ) {
    if (collectors.length < 2) return;
    wildwoodSound.playSpiritShare(collectors.length);
    focusShade.alpha = 0.24;
    collectors.forEach((collector, index) => {
      void runner.wait(index * 75).then(() => {
        if (gen === currentGeneration) spawnRingPulse(x, y, SYMBOL_COLORS[collector], { size: CELL * (1.05 + index * 0.16), duration: 520, alpha: 0.78 });
      });
    });
    const seed = cellAt(x, y);
    seed.motionLocked = true;
    const label = new Text({
      text: `SPIRIT SEED ×${collectors.length}`,
      style: new TextStyle({ fill: 0xcffafe, fontSize: 19, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", stroke: { color: 0x082f49, width: 5 } })
    });
    label.anchor.set(0.5);
    const [cx, cy] = cellCenter(x, y);
    label.position.set(cx, cy - 58);
    label.alpha = 0;
    fxLayer.addChild(label);
    await runner.animate(620, (p) => {
      const pulse = Math.sin(p * Math.PI * 3) * (1 - p);
      seed.symbolSprite.scale.set(seed.baseSymbolScaleX * (1 + pulse * 0.09), seed.baseSymbolScaleY * (1 + pulse * 0.09));
      label.alpha = p < 0.2 ? p / 0.2 : p > 0.78 ? 1 - (p - 0.78) / 0.22 : 1;
      label.position.y = cy - 52 - Easing.outCubic(p) * 15;
    });
    seed.symbolSprite.scale.set(seed.baseSymbolScaleX, seed.baseSymbolScaleY);
    seed.motionLocked = false;
    label.destroy();
    focusShade.alpha = 0;
  }

  async function playCollectorRoutes(step: WildwoodStep, prevBoard: BoardCell[], gen: number, comboStreak: number, stake: number) {
    const routes = step.collectorRoutes ?? [];
    if (routes.length === 0) return;

    const sharedSeeds = new Map<string, { x: number; y: number; collectors: CollectorType[] }>();
    for (const route of routes) {
      for (const move of route.moves) {
        if (!move.collect || prevBoard[move.y * COLS + move.x].symbol !== "spiritSeed") continue;
        const key = coordKey(move.x, move.y);
        const entry = sharedSeeds.get(key) ?? { x: move.x, y: move.y, collectors: [] };
        if (!entry.collectors.includes(route.symbol)) entry.collectors.push(route.symbol);
        sharedSeeds.set(key, entry);
      }
    }

    if (step.winDelta) spawnWinText(step.winDelta * stake);
    wildwoodSound.playCollect(comboStreak);

    for (const route of routes) {
      if (gen !== currentGeneration) return;
      const origin = cellAt(route.x, route.y);
      const routeLine = await playCollectorAnticipation(route, origin, gen);
      if (gen !== currentGeneration) return;
      hideCellSymbolVisualState(origin);

      const mover = new Container();
      const aura = new Graphics()
        .circle(0, 0, CELL * 0.46)
        .stroke({ width: 7, color: SYMBOL_COLORS[route.symbol], alpha: 0.16 })
        .circle(0, 0, CELL * 0.42)
        .stroke({ width: 3, color: SYMBOL_COLORS[route.symbol], alpha: 0.86 });
      const shadow = new Sprite(getSymbolTexture(route.symbol));
      shadow.anchor.set(0.5);
      shadow.tint = 0x000000;
      shadow.alpha = 0.3;
      shadow.width = CELL * 0.9;
      shadow.height = CELL * 0.9;
      shadow.position.set(3, 6);
      const icon = new Sprite(getSymbolTexture(route.symbol));
      icon.anchor.set(0.5);
      icon.width = CELL * 0.9;
      icon.height = CELL * 0.9;
      mover.addChild(aura, shadow, icon);
      const [originX, originY] = cellCenter(route.x, route.y);
      mover.position.set(originX, originY);
      fxLayer.addChild(mover);

      const moveTo = async (x: number, y: number, duration: number) => {
        const [targetX, targetY] = cellCenter(x, y);
        const startX = mover.position.x;
        const startY = mover.position.y;
        let trailIndex = 0;
        await runner.animate(duration, (p) => {
          const baseX = startX + (targetX - startX) * Easing.inOutQuad(p);
          const baseY = startY + (targetY - startY) * Easing.inOutQuad(p);
          let offsetX = 0;
          let offsetY = 0;
          switch (route.symbol) {
            case "fox":
              offsetY = -Math.sin(p * Math.PI) * 10;
              mover.rotation = Math.sin(p * Math.PI) * 0.16 * Math.sign(targetX - startX || 1);
              icon.scale.set(1.08, 0.94);
              break;
            case "owl":
              offsetY = -Math.sin(p * Math.PI) * 16;
              mover.rotation = Math.sin(p * Math.PI * 2) * 0.04;
              icon.scale.set(1.12, 0.94);
              break;
            case "stag":
              offsetY = -Math.abs(Math.sin(p * Math.PI * 4)) * 5;
              mover.rotation = Math.sin(p * Math.PI) * 0.045 * Math.sign(targetX - startX || 1);
              icon.scale.set(1.04, 1.08);
              break;
            case "wisp":
              offsetX = Math.sin(p * Math.PI * 2) * 8;
              offsetY = -Math.sin(p * Math.PI) * 7;
              mover.rotation += 0.045;
              icon.scale.set(1 + Math.sin(p * Math.PI) * 0.16, 1 - Math.sin(p * Math.PI) * 0.08);
              break;
          }
          mover.position.set(baseX + offsetX, baseY + offsetY);
          aura.rotation += route.symbol === "wisp" ? 0.06 : 0.025;
          const nextTrailIndex = Math.floor(p * 6);
          if (nextTrailIndex > trailIndex) {
            trailIndex = nextTrailIndex;
            spawnCollectorTrailMote(route.symbol, mover.position.x, mover.position.y, trailIndex);
          }
        });
        mover.position.set(targetX, targetY);
        mover.rotation = 0;
        icon.scale.set(1);
      };

      try {
        for (const move of route.moves) {
          await moveTo(move.x, move.y, 250);
          if (gen !== currentGeneration) return;
          if (!move.collect) continue;

          const target = cellAt(move.x, move.y);
          const targetSymbol = prevBoard[move.y * COLS + move.x].symbol;
          wildwoodSound.playCollectorImpact(route.symbol);
          await playCollectorSignatureImpact(route.symbol, mover, icon, move.x, move.y);
          if (gen !== currentGeneration) return;
          spawnBurstParticles([{ x: move.x, y: move.y, symbol: targetSymbol }]);
          spawnRingPulse(move.x, move.y, SYMBOL_COLORS[targetSymbol], { size: CELL * 1.45, duration: 480, alpha: 0.92 });
          spawnRingPulse(route.x, route.y, SYMBOL_COLORS[route.symbol], { size: CELL, duration: 340, alpha: 0.5 });
          spawnValueFly(move.x, move.y, targetSymbol, route.symbol);
          if (presentationLevel >= 3 || bonusPresentation) shakeScreen(1.5 + presentationLevel * 0.35, 130);
          target.motionLocked = true;
          await runner.wait(45);

          await runner.animate(210, (p) => {
            const bounce = Math.sin(p * Math.PI);
            const targetScale = targetSymbol === "spiritSeed" ? 1 + bounce * 0.2 : Math.max(0.08, 1 - Easing.inQuad(p) * 0.92);
            mover.scale.set(1 + bounce * 0.16);
            target.symbolSprite.scale.set(target.baseSymbolScaleX * targetScale, target.baseSymbolScaleY * targetScale);
            target.shadowSprite.scale.set(target.baseShadowScaleX * targetScale, target.baseShadowScaleY * targetScale);
            target.symbolSprite.alpha = targetSymbol === "spiritSeed" ? 1 : 1 - p;
            target.valueLabel.alpha = targetSymbol === "spiritSeed" ? 1 : 1 - p;
          });
          mover.scale.set(1);

          if (targetSymbol !== "spiritSeed") {
            hideCellSymbolVisualState(target);
          } else {
            target.symbolSprite.alpha = 1;
            target.symbolSprite.scale.set(target.baseSymbolScaleX, target.baseSymbolScaleY);
            target.shadowSprite.scale.set(target.baseShadowScaleX, target.baseShadowScaleY);
            drawValueLabel(target);
          }
          target.motionLocked = false;
        }

        await playCollectorCelebration(route.symbol, mover, aura);
        await runner.animate(210, (p) => {
          mover.alpha = 1 - Easing.inQuad(p);
          mover.scale.set(1 - p * 0.12);
          routeLine.alpha = 1 - p;
          focusShade.alpha = 0.28 * (1 - p);
        });
      } finally {
        if (routeLine.parent) routeLine.destroy();
        if (mover.parent) mover.destroy({ children: true });
        focusShade.alpha = 0;
        if (gen === currentGeneration && !runner.isDestroyed) {
          applyCellSymbol(origin, route.symbol);
          spawnRingPulse(route.x, route.y, SYMBOL_COLORS[route.symbol], { size: CELL * 0.9, duration: 260, alpha: 0.35 });
        }
      }
    }

    for (const shared of sharedSeeds.values()) {
      await playSharedSeedCelebration(shared.x, shared.y, shared.collectors, gen);
      if (gen !== currentGeneration) return;
    }
  }

'''
source = source[:start] + new_collector_block + source[end:]

start = source.index('  async function playBonusFlash(')
end = source.index('  async function playBanner(', start)
new_bonus_block = '''  async function playBonusTransformation(board: BoardCell[], gen: number) {
    const scene = new Container();
    const veil = new Graphics().rect(0, 0, BOARD_W, BOARD_H).fill({ color: 0x071126, alpha: 0.9 });
    const wind = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.mist));
    wind.width = BOARD_W * 1.65;
    wind.height = BOARD_H * 0.38;
    wind.position.set(-BOARD_W * 1.25, BOARD_H * 0.35);
    wind.tint = 0x9fffe0;
    wind.alpha = 0;
    wind.blendMode = "add";
    const title = new Text({
      text: "THE WILDWOOD AWAKENS",
      style: new TextStyle({ fill: 0xffe9a8, fontSize: 29, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: 1.5, stroke: { color: 0x2b1438, width: 6 } })
    });
    title.anchor.set(0.5);
    title.position.set(BOARD_W / 2, BOARD_H / 2 - 45);
    const sub = new Text({
      text: "SPIRIT BREATHS BEGIN",
      style: new TextStyle({ fill: 0xc7ffe5, fontSize: 14, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: 2 })
    });
    sub.anchor.set(0.5);
    sub.position.set(BOARD_W / 2, BOARD_H / 2 + 2);
    title.alpha = 0;
    sub.alpha = 0;
    scene.addChild(veil, wind, title, sub);
    scene.alpha = 0;
    fxLayer.addChild(scene);

    const seedCells = board.filter((cell) => cell.symbol === "spiritSeed");
    const seedSprites = seedCells.map((seed, index) => {
      const sprite = new Sprite(getSymbolTexture("spiritSeed"));
      sprite.anchor.set(0.5);
      sprite.width = CELL * 0.7;
      sprite.height = CELL * 0.7;
      const [startX, startY] = cellCenter(seed.x, seed.y);
      sprite.position.set(startX, startY);
      sprite.alpha = 0;
      sprite.tint = 0xd8ffff;
      sprite.blendMode = "add";
      scene.addChild(sprite);
      return { sprite, targetX: BOARD_W / 2 + (index - (seedCells.length - 1) / 2) * 72, targetY: 58 };
    });

    setBonusTiles(true);
    setPresentationLevel(5, true);
    await runner.animate(820, (p) => {
      scene.alpha = Math.min(1, p * 2.5);
      veil.alpha = 0.2 + Math.sin(p * Math.PI) * 0.62;
      wind.alpha = Math.sin(p * Math.PI) * 0.55;
      wind.position.x = -BOARD_W * 1.25 + BOARD_W * 2.15 * Easing.inOutQuad(p);
      title.alpha = p < 0.28 ? 0 : Math.min(1, (p - 0.28) / 0.2);
      sub.alpha = p < 0.42 ? 0 : Math.min(1, (p - 0.42) / 0.18);
      title.scale.set(0.72 + Easing.outBack(Math.min(1, p * 1.45)) * 0.28);
      seedSprites.forEach(({ sprite, targetX, targetY }, index) => {
        const delay = index * 0.08;
        const local = Math.max(0, Math.min(1, (p - delay) / (1 - delay)));
        const startX = seedCells[index].x * (CELL + GAP) + CELL / 2;
        const startY = seedCells[index].y * (CELL + GAP) + CELL / 2;
        sprite.alpha = Math.min(1, local * 3);
        sprite.position.set(startX + (targetX - startX) * Easing.inOutQuad(local), startY + (targetY - startY) * Easing.inOutQuad(local) - Math.sin(local * Math.PI) * 42);
        sprite.rotation += 0.035;
        sprite.scale.set(0.75 + local * 0.25);
      });
    });
    if (gen !== currentGeneration) return;
    seedSprites.forEach(({ targetX, targetY }, index) => spawnRingPulse(Math.max(0, Math.min(COLS - 1, Math.round(targetX / (CELL + GAP)))), 0, 0x22d3ee, { size: CELL, duration: 420 + index * 60, alpha: 0.65 }));
    await runner.wait(420);
    if (gen !== currentGeneration) return;
    await runner.animate(300, (p) => {
      scene.alpha = 1 - p;
      title.position.y -= p * 0.35;
    });
    scene.destroy({ children: true });
  }

  async function playBonusBreathGust(index: number, gen: number) {
    wildwoodSound.playBonusBreath(index);
    const gust = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.mist));
    gust.width = BOARD_W * 1.45;
    gust.height = BOARD_H * 0.28;
    gust.tint = 0xb8ffe8;
    gust.blendMode = "add";
    gust.alpha = 0;
    gust.position.set(-BOARD_W * 1.25, BOARD_H * 0.4);
    fxLayer.addChild(gust);
    await runner.animate(520, (p) => {
      gust.position.x = -BOARD_W * 1.25 + BOARD_W * 2.25 * Easing.inOutQuad(p);
      gust.alpha = Math.sin(p * Math.PI) * 0.48;
      for (const cell of cells) {
        if (!cell.symbol || cell.motionLocked) continue;
        const wave = Math.sin((p * 2.2 - cell.x * 0.13 - cell.y * 0.04) * Math.PI);
        cell.symbolSprite.rotation = wave * 0.025;
        cell.symbolSprite.position.x = CELL / 2 + wave * 2.2;
      }
    });
    for (const cell of cells) {
      if (!cell.symbol || cell.motionLocked) continue;
      cell.symbolSprite.rotation = 0;
      cell.symbolSprite.position.set(CELL / 2, CELL / 2);
    }
    gust.destroy();
    if (gen !== currentGeneration) return;
  }

'''
source = source[:start] + new_bonus_block + source[end:]

replace_once(
'''  function spawnCelebration(tier: "big" | "max") {
    celebrationField.setMode("celebrate");
    shakeScreen(tier === "max" ? 11 : 6, tier === "max" ? 520 : 340);
    void runner.wait(tier === "max" ? 1800 : 1300).then(() => celebrationField.setMode("off"));
  }''',
'''  function spawnCelebration(tier: Exclude<WinPresentationTier, "standard">) {
    const intensity: Record<Exclude<WinPresentationTier, "standard">, number> = { good: 2.5, big: 5.5, mega: 8.5, max: 11 };
    const duration: Record<Exclude<WinPresentationTier, "standard">, number> = { good: 900, big: 1300, mega: 1700, max: 2100 };
    celebrationField.setMode("celebrate");
    shakeScreen(intensity[tier], tier === "max" ? 520 : tier === "mega" ? 440 : tier === "big" ? 340 : 220);
    void runner.wait(duration[tier]).then(() => celebrationField.setMode("off"));
  }

  async function playWinCeremony(win: number, stake: number, capApplied: boolean, gen: number) {
    const presentation = getWinPresentation(win, stake, capApplied);
    if (presentation.tier === "standard") {
      await playBanner(win > 0 ? `WIN +${win.toFixed(2)}` : "ROUND COMPLETE", win > 0 ? "gold" : "emerald", presentation.holdMs, gen);
      return;
    }

    switch (presentation.tier) {
      case "good": wildwoodSound.playGoodWin(); break;
      case "big": wildwoodSound.playBigWin(); break;
      case "mega": wildwoodSound.playMegaWin(); break;
      case "max": wildwoodSound.playMaxWin(); break;
    }
    spawnCelebration(presentation.tier);
    focusShade.alpha = 0.42 + presentation.intensity * 0.28;

    const ceremony = new Container();
    const halo = new Graphics()
      .circle(0, 0, 118).fill({ color: presentation.tier === "max" ? 0xf5c542 : 0x34d399, alpha: 0.08 })
      .circle(0, 0, 98).stroke({ width: 6, color: presentation.tier === "mega" || presentation.tier === "max" ? 0xf5c542 : 0x6ee7b7, alpha: 0.52 })
      .circle(0, 0, 73).stroke({ width: 2, color: 0xffffff, alpha: 0.34 });
    const title = new Text({
      text: presentation.label,
      style: new TextStyle({ fill: presentation.tier === "max" ? 0xfff3b0 : 0xd1fae5, fontSize: presentation.tier === "max" ? 38 : presentation.tier === "mega" ? 34 : 30, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: 2, stroke: { color: 0x1c1206, width: 7 } })
    });
    title.anchor.set(0.5);
    title.position.y = -28;
    const amount = new Text({
      text: "0.00",
      style: new TextStyle({ fill: 0xffe9a8, fontSize: presentation.tier === "max" ? 43 : 37, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", stroke: { color: 0x2b1904, width: 6 } })
    });
    amount.anchor.set(0.5);
    amount.position.y = 28;
    ceremony.addChild(halo, title, amount);
    ceremony.position.set(BOARD_W / 2, BOARD_H / 2);
    ceremony.scale.set(0.45);
    ceremony.alpha = 0;
    fxLayer.addChild(ceremony);

    await runner.animate(presentation.countMs, (p) => {
      ceremony.alpha = Math.min(1, p * 4);
      ceremony.scale.set(0.45 + Easing.outBack(Math.min(1, p * 2.2)) * 0.55);
      halo.rotation += 0.012 + presentation.intensity * 0.01;
      amount.text = (win * Easing.outCubic(p)).toFixed(2);
    });
    amount.text = win.toFixed(2);
    await runner.wait(presentation.holdMs);
    if (gen !== currentGeneration) return;
    await runner.animate(280, (p) => {
      ceremony.alpha = 1 - p;
      ceremony.scale.set(1 + p * 0.18);
      focusShade.alpha *= 1 - p;
    });
    ceremony.destroy({ children: true });
    focusShade.alpha = 0;
  }''',
    "win celebration",
)

replace_once(
'''          await playBonusFlash(myGeneration);
          if (myGeneration !== currentGeneration) return;''',
'''          await playBonusTransformation(prev, myGeneration);
          if (myGeneration !== currentGeneration) return;''',
    "bonus transformation call",
)

replace_once(
'''        case "bonusBreath": {
          if (step.collectorRoutes?.length || step.collected?.length) {''',
'''        case "bonusBreath": {
          const currentBreath = parseBreathInfo(step.message)?.n ?? 1;
          await playBonusBreathGust(currentBreath, myGeneration);
          if (myGeneration !== currentGeneration) return;
          if (step.collectorRoutes?.length || step.collected?.length) {''',
    "bonus gust call",
)

old_round = '''        case "roundEnded": {
          // Snap to the authoritative server total — the running pot can't see the 1000x cap coming.
          potCash = round.cappedWin;
          potBadge.setAmount(potCash);
          potBadge.setSub("Round complete", round.cappedWin > 0 ? "gold" : "emerald");
          const perStake = stake > 0 ? round.cappedWin / stake : 0;
          const isMax = round.capApplied;
          const isBig = !isMax && perStake >= 20;
          const label = isMax ? "MAX WIN!" : isBig ? "BIG WIN!" : "ROUND COMPLETE";
          const cashLabel = round.cappedWin > 0 ? `${label} +${round.cappedWin.toFixed(2)}` : label;
          if (isMax || isBig) {
            wildwoodSound[isMax ? "playMaxWin" : "playBigWin"]();
            spawnCelebration(isMax ? "max" : "big");
          }
          await playBanner(cashLabel, round.cappedWin > 0 ? "gold" : "emerald", 900, myGeneration);
          break;
        }'''
new_round = '''        case "roundEnded": {
          // Snap to the authoritative server total — the running pot can't see the 1000x cap coming.
          potCash = round.cappedWin;
          potBadge.setAmount(potCash);
          potBadge.setSub("Round complete", round.cappedWin > 0 ? "gold" : "emerald");
          await playWinCeremony(round.cappedWin, stake, round.capApplied, myGeneration);
          break;
        }'''
replace_once(old_round, new_round, "round win ceremony")

replace_once(
'''    runner.cancelAll();
    clearFx();
    setBonusTiles(false);''',
'''    runner.cancelAll();
    clearFx();
    focusShade.alpha = 0;
    setBonusTiles(false);''',
    "round focus reset",
)

replace_once(
'''    const stake = activeRound.stake;
    clearFx();

    let bonusActive = false;''',
'''    const stake = activeRound.stake;
    clearFx();
    focusShade.alpha = 0;

    let bonusActive = false;''',
    "seek focus reset",
)

replace_once(
'''  function resize() {
    const w = app.screen.width;''',
'''  function setSpeed(scale: number) {
    runner.setTimeScale(scale);
  }

  function resize() {
    const w = app.screen.width;''',
    "set speed implementation",
)

replace_once(
'''  return { resize, playRound, seek, skipToEnd, destroy };''',
'''  return { resize, playRound, seek, skipToEnd, setSpeed, destroy };''',
    "world return",
)

path.write_text(source)
print("Premium Pixi presentation patch applied.")
