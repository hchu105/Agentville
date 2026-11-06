import nav from '../assets/world/nav.json'

// The walkable floor, read from the rendered scene by art/navmap.py.

export type Pt = { x: number; z: number }

/** Half a resident's width, plus a little air. */
export const RADIUS = 0.3

const { cell, extent, rows } = nav
const n = rows.length
const idx = (i: number, j: number) => j * n + i
const toCell = (v: number) => Math.floor((v + extent) / cell)
const toWorld = (i: number) => (i + 0.5) * cell - extent

/** Furniture grown by RADIUS, so a resident's centre can travel anywhere that's clear. */
const blocked = new Uint8Array(n * n)
{
  const r = Math.ceil(RADIUS / cell)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (rows[j][i] !== '1') continue
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const a = i + di
          const b = j + dj
          if (a >= 0 && b >= 0 && a < n && b < n && Math.hypot(di, dj) * cell <= RADIUS + cell * 0.72) blocked[idx(a, b)] = 1
        }
      }
    }
  }
}

export function walkable(x: number, z: number) {
  const i = toCell(x)
  const j = toCell(z)
  return i >= 0 && j >= 0 && i < n && j < n && !blocked[idx(i, j)]
}

/** True if nothing solid or standing sits on the straight line from a to b. */
export function clearLine(a: Pt, b: Pt, avoid: Pt[] = []) {
  const d = Math.hypot(b.x - a.x, b.z - a.z)
  const steps = Math.ceil(d / (cell / 2))
  for (let s = 0; s <= steps; s++) {
    const t = steps ? s / steps : 0
    const x = a.x + (b.x - a.x) * t
    const z = a.z + (b.z - a.z) * t
    if (!walkable(x, z) || avoid.some((p) => Math.hypot(p.x - x, p.z - z) < RADIUS * 2.4)) return false
  }
  return true
}

/** Closest walkable spot, for anyone nudged against furniture. */
export function nearestWalkable(p: Pt, avoid: Pt[] = [], gap = 0): Pt {
  for (let r = 0; r < 4; r += cell) {
    const ring = Math.max(1, Math.round((r * 6.3) / cell))
    for (let a = 0; a < ring; a++) {
      const q = { x: p.x + Math.cos((a / ring) * 6.283) * r, z: p.z + Math.sin((a / ring) * 6.283) * r }
      if (walkable(q.x, q.z) && avoid.every((o) => Math.hypot(o.x - q.x, o.z - q.z) >= gap)) return q
    }
  }
  return p
}

/** A* across the grid, then pull the path tight so walks read as straight lines. */
export function findPath(from: Pt, to: Pt, avoid?: Pt[]): Pt[]
export function findPath(from: Pt, to: Pt, avoid: Pt[], strict: true): Pt[] | null
export function findPath(from: Pt, to: Pt, avoid: Pt[] = [], strict = false): Pt[] | null {
  const standing = (x: number, z: number) => avoid.some((p) => Math.hypot(p.x - x, p.z - z) < RADIUS * 2.4)
  const open = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= n || j >= n || blocked[idx(i, j)]) return false
    return !standing(toWorld(i), toWorld(j))
  }
  const start = nearestWalkable(from)
  const end = nearestWalkable(to)
  const si = toCell(start.x)
  const sj = toCell(start.z)
  const ei = toCell(end.x)
  const ej = toCell(end.z)
  const goal = idx(ei, ej)
  const best = new Float32Array(n * n).fill(Infinity)
  const came = new Int32Array(n * n).fill(-1)
  const seen = new Uint8Array(n * n)
  const h = (i: number, j: number) => Math.hypot(i - ei, j - ej)
  const heap: [number, number][] = [[h(si, sj), idx(si, sj)]]
  best[idx(si, sj)] = 0
  const push = (e: [number, number]) => {
    let c = heap.push(e) - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (heap[p][0] <= heap[c][0]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      c = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      for (let c = 0; ; ) {
        let m = c
        for (const k of [2 * c + 1, 2 * c + 2]) if (k < heap.length && heap[k][0] < heap[m][0]) m = k
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }
  let found = false
  while (heap.length) {
    const [, cur] = pop()
    if (seen[cur]) continue
    seen[cur] = 1
    if (cur === goal) {
      found = true
      break
    }
    const j = Math.floor(cur / n)
    const i = cur - j * n
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if ((!di && !dj) || !open(i + di, j + dj)) continue
        if (di && dj && (!open(i + di, j) || !open(i, j + dj))) continue // no cutting corners
        const k = idx(i + di, j + dj)
        const g = best[cur] + (di && dj ? 1.414 : 1)
        if (g < best[k]) {
          best[k] = g
          came[k] = cur
          push([g + h(i + di, j + dj), k])
        }
      }
    }
  }
  if (!found) return strict ? null : avoid.length ? findPath(from, to) : [end]
  const raw: Pt[] = []
  for (let c = goal; c !== -1 && c !== idx(si, sj); c = came[c]) {
    const j = Math.floor(c / n)
    raw.unshift({ x: toWorld(c - j * n), z: toWorld(j) })
  }
  raw.push(end)
  const path: Pt[] = []
  let at = start
  for (let i = 0; i < raw.length; ) {
    let far = i
    for (let k = raw.length - 1; k > i; k--) {
      if (clearLine(at, raw[k], avoid)) {
        far = k
        break
      }
    }
    path.push(raw[far])
    at = raw[far]
    i = far + 1
  }
  return path
}
