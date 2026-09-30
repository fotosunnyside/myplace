/**
 * Talking distance inside a Virtual Place.
 *
 * Positions are 0–1 across and down the room. Distances are measured as if the room were 16:9 (height = 1),
 * whatever the screen, so everyone agrees on who is near whom. People within talking distance see and hear
 * each other; step away and the connection closes (with a little slack so it doesn't flicker at the edge).
 */

export const ROOM_ASPECT = 16 / 9
/** Connect when closer than this (in room heights). */
export const TALK_DISTANCE = 0.34
/** Stay connected until further than this. */
export const LEAVE_DISTANCE = 0.42
/** Person-to-person video is a mesh; keep it to the nearest few. */
export const MAX_CONNECTIONS = 8

export interface Spot {
  x: number
  y: number
}

export const distance = (a: Spot, b: Spot) => Math.hypot((a.x - b.x) * ROOM_ASPECT, a.y - b.y)

/** Who you should be connected to: people within talking distance (or still within leaving distance if already connected), nearest first. */
export function nearby(me: Spot | null, others: { id: string; x: number | null; y: number | null }[], connected: ReadonlySet<string> = new Set()): string[] {
  if (!me) return []
  return others
    .filter((o): o is { id: string; x: number; y: number } => o.x != null && o.y != null)
    .map((o) => ({ id: o.id, d: distance(me, o) }))
    .filter((o) => o.d < (connected.has(o.id) ? LEAVE_DISTANCE : TALK_DISTANCE))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_CONNECTIONS)
    .map((o) => o.id)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const clampSpot = (s: Spot): Spot => ({ x: clamp(s.x, 0.06, 0.94), y: clamp(s.y, 0.1, 0.9) })

/**
 * Where someone arriving stands: the first free spot on a loose spiral around the middle, so newcomers
 * land near the people already there (and can hear them) without sitting on top of anyone.
 */
export function startingSpot(taken: Spot[]): Spot {
  // About a bubble and a half apart on a laptop screen: side by side, not on top of each other.
  const gap = 0.24
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < 400; i++) {
    const r = 0.11 * Math.sqrt(i)
    const t = i * golden
    const spot = clampSpot({ x: 0.5 + (r * Math.cos(t)) / ROOM_ASPECT, y: 0.52 + r * Math.sin(t) })
    if (taken.every((o) => distance(o, spot) >= gap)) return spot
  }
  return { x: 0.5, y: 0.52 }
}

/** Moves a spot by arrow-key steps (keyboard users can walk too). */
export function step(s: Spot, key: string, amount = 0.04): Spot | null {
  const d = { ArrowLeft: [-amount / ROOM_ASPECT, 0], ArrowRight: [amount / ROOM_ASPECT, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount] }[key]
  return d ? clampSpot({ x: s.x + d[0], y: s.y + d[1] }) : null
}
