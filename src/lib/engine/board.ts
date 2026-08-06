/** 8-directional adjacency for a `width`x`height` grid, indexed `y * width + x`. */
export function buildNeighbourIndex(width: number, height: number): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const neighbours: number[] = [];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          neighbours.push(ny * width + nx);
        }
      }
      map[y * width + x] = neighbours;
    }
  }
  return map;
}
