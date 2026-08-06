from pathlib import Path

path = Path("src/components/wildwood-pixi-board.tsx")
source = path.read_text()

replacements = [
    (
        'const size = symbol === "stag" ? 13 : symbol === "wisp" ? 18 : 11;',
        'const size = symbol === "stag" ? 8 : symbol === "wisp" ? 18 : 11;',
        "stag trail mote size",
    ),
    (
        'origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.1), origin.baseSymbolScaleY * (1 - k * 0.13));',
        'origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.035), origin.baseSymbolScaleY * (1 - k * 0.045));',
        "fox anticipation scale",
    ),
    (
        'origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.17), origin.baseSymbolScaleY * (1 - k * 0.06));',
        'origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.05), origin.baseSymbolScaleY * (1 - k * 0.025));',
        "owl anticipation scale",
    ),
    (
        'origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.08), origin.baseSymbolScaleY * (1 + k * 0.12));',
        'origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 + k * 0.03), origin.baseSymbolScaleY * (1 + k * 0.04));',
        "stag anticipation scale",
    ),
    (
        'origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 - k * 0.14), origin.baseSymbolScaleY * (1 + k * 0.18));',
        'origin.symbolSprite.scale.set(origin.baseSymbolScaleX * (1 - k * 0.045), origin.baseSymbolScaleY * (1 + k * 0.06));',
        "wisp anticipation scale",
    ),
    (
        'icon.scale.set(1 + impact * 0.16, 1 - impact * 0.08);',
        'icon.scale.set(1 + impact * 0.05, 1 - impact * 0.025);',
        "owl impact scale",
    ),
    (
        'icon.scale.set(1 + impact * 0.1, 1 + impact * 0.16);',
        'icon.scale.set(1 + impact * 0.04, 1 + impact * 0.055);',
        "stag impact scale",
    ),
    (
        'icon.scale.set(1 + impact * 0.3, 1 - impact * 0.18);',
        'icon.scale.set(1 + impact * 0.08, 1 - impact * 0.05);',
        "wisp impact scale",
    ),
    (
        'mover.scale.set(1 + bounce * 0.12, 1 - bounce * 0.04);',
        'mover.scale.set(1 + bounce * 0.045, 1 - bounce * 0.02);',
        "owl celebration scale",
    ),
    (
        'mover.scale.set(1 + bounce * 0.08, 1 + bounce * 0.1);',
        'mover.scale.set(1 + bounce * 0.035, 1 + bounce * 0.045);',
        "stag celebration scale",
    ),
    (
        'mover.scale.set(1 + bounce * 0.17);',
        'mover.scale.set(1 + bounce * 0.06);',
        "wisp celebration scale",
    ),
    (
        'icon.scale.set(1.08, 0.94);',
        'icon.scale.set(1.03, 0.985);',
        "fox travel scale",
    ),
    (
        'icon.scale.set(1.12, 0.94);',
        'icon.scale.set(1.04, 0.985);',
        "owl travel scale",
    ),
    (
        'icon.scale.set(1.04, 1.08);',
        'icon.scale.set(1.02, 1.03);',
        "stag travel scale",
    ),
    (
        'icon.scale.set(1 + Math.sin(p * Math.PI) * 0.16, 1 - Math.sin(p * Math.PI) * 0.08);',
        'icon.scale.set(1 + Math.sin(p * Math.PI) * 0.05, 1 - Math.sin(p * Math.PI) * 0.03);',
        "wisp travel scale",
    ),
    (
        'mover.scale.set(1 + bounce * 0.16);',
        'mover.scale.set(1 + bounce * 0.05);',
        "collection impact scale",
    ),
]

for old, new, label in replacements:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one {label} match, found {count}")
    source = source.replace(old, new, 1)

path.write_text(source)
print("Reduced stag trail mote and collector collection scaling.")
