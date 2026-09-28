/**
 * Places people in a room the way a crowd settles: a loose sunflower spiral around the middle,
 * newest arrivals on the outside, so nobody jumps around when someone comes or goes.
 *
 * Grouped by `zone` so conversation circles can later each gather around their own spot.
 */

export interface BubbleInput {
  id: string
  zone?: string | null
}

export interface BubbleSpot {
  id: string
  /** Centre, in px from the stage's top-left. */
  x: number
  y: number
  size: number
}

export interface LayoutResult {
  spots: BubbleSpot[]
  size: number
  /** Height the bubbles need; larger than the stage when a very full room must scroll. */
  height: number
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Small stable offset per person so the crowd doesn't look like a grid. */
function jitter(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return [((h & 0xff) / 255 - 0.5) * 0.12, (((h >> 8) & 0xff) / 255 - 0.5) * 0.12]
}

function spiral(n: number, size: number, stretch: number) {
  const c = size * 0.7
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const r = c * Math.sqrt(i + (n === 1 ? 0 : 0.5))
    const t = i * GOLDEN_ANGLE
    pts.push([r * Math.cos(t) * stretch, r * Math.sin(t)])
  }
  return pts
}

export function layoutBubbles(people: BubbleInput[], width: number, height: number, opts: { minSize: number; maxSize: number }): LayoutResult {
  if (!people.length || width <= 0 || height <= 0) return { spots: [], size: opts.maxSize, height }

  const groups = new Map<string, BubbleInput[]>()
  for (const p of people) {
    const key = p.zone ?? ''
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  const zones = [...groups.values()]
  const cellW = width / zones.length
  const biggest = Math.max(...zones.map((z) => z.length))
  // Landscape rooms spread sideways a little.
  const stretch = Math.min(1.6, Math.max(1, cellW / height))

  let size = Math.max(opts.minSize, Math.min(opts.maxSize, Math.sqrt((cellW * height * 0.3) / biggest)))
  let pts = spiral(biggest, size, stretch)
  const fits = (s: number, p: [number, number][]) => p.every(([x, y]) => Math.abs(x) <= cellW / 2 - s / 2 && Math.abs(y) <= height / 2 - s / 2 - s * 0.2)
  while (size > opts.minSize && !fits(size, pts)) {
    size = Math.max(opts.minSize, size * 0.92)
    pts = spiral(biggest, size, stretch)
  }
  const extentY = Math.max(...pts.map(([, y]) => Math.abs(y))) + size * 0.8
  const stageH = Math.max(height, extentY * 2)

  const spots: BubbleSpot[] = []
  zones.forEach((zone, zi) => {
    const cx = cellW * zi + cellW / 2
    const cy = stageH / 2
    const zp = spiral(zone.length, size, stretch)
    zone.forEach((p, i) => {
      const [jx, jy] = zone.length > 1 ? jitter(p.id) : [0, 0]
      spots.push({ id: p.id, x: cx + zp[i][0] + jx * size, y: cy + zp[i][1] + jy * size, size })
    })
  })
  return { spots, size, height: stageH }
}
