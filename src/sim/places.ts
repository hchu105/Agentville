import { AGENTS, BUILDINGS, DESK_QUEUE, LEISURE, type LeisurePose, type Spot } from './data'
import type { BuildingId } from './types'

export interface P {
  x: number
  z: number
}
export interface Place extends P {
  heading: number
  seat?: number
  approach?: number
}

interface Frame {
  x: number
  z: number
  rot: number
}

/** Station-local spot → world position and heading. */
export function toWorld(f: Frame, s: Spot): Place {
  const c = Math.cos(f.rot)
  const sn = Math.sin(f.rot)
  return {
    x: f.x + s.x * c + s.z * sn,
    z: f.z - s.x * sn + s.z * c,
    heading: f.rot + s.h,
    seat: s.seat,
    approach: s.approach,
  }
}

const station = (id: BuildingId) => BUILDINGS.find((b) => b.id === id)!
const agentIndex = (id: string) => Math.max(0, AGENTS.findIndex((a) => a.id === id))

export const workSpot = (id: BuildingId) => toWorld(station(id), station(id).work)
export const queueSpot = (agentId: string) => toWorld(station('desk'), DESK_QUEUE[agentIndex(agentId) % DESK_QUEUE.length])

export interface LeisurePlace extends Place {
  key: string
  island: string
  pose: LeisurePose
}

/** Every place a free agent can go and hang out, in world space. */
export const LEISURE_SPOTS: LeisurePlace[] = LEISURE.flatMap((isl) =>
  isl.spots.map((sp, i) => ({ ...toWorld(isl, sp), key: `${isl.id}:${i}`, island: isl.id, pose: sp.pose })),
)

/** Where each agent starts the day: a seat on the lounge sofa. */
export const startSpot = (agentId: string) => LEISURE_SPOTS[agentIndex(agentId) % 4]

/** A point just in front of a spot, so agents walk up to a chair instead of through it. */
export const approachOf = (p: Place, dist = 0.75): P => ({
  x: p.x + Math.sin(p.heading) * dist,
  z: p.z + Math.cos(p.heading) * dist,
})

const OBSTACLES = [...BUILDINGS.map((b) => ({ id: b.id as string, x: b.x, z: b.z, r: b.r })), ...LEISURE.map((l) => ({ id: l.id as string, x: l.x, z: l.z, r: l.r }))]

/** Nearest obstacle a straight segment cuts through, or null. */
function blocker(a: P, b: P, skip: Set<string>) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len2 = dx * dx + dz * dz || 1
  let best: { o: (typeof OBSTACLES)[number]; u: number; cx: number; cz: number } | null = null
  for (const o of OBSTACLES) {
    if (skip.has(o.id)) continue
    const u = Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / len2))
    const cx = a.x + dx * u
    const cz = a.z + dz * u
    if (Math.hypot(cx - o.x, cz - o.z) < o.r + 0.25 && (!best || u < best.u)) best = { o, u, cx, cz }
  }
  return best
}

/** Which obstacle (if any) contains a point: start and end stations are not obstacles. */
const inside = (p: P) => OBSTACLES.filter((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + 0.3).map((o) => o.id)

/** Straight lines, detouring around furniture islands. */
export function route(from: P, to: P, depth = 0): P[] {
  const skip = new Set([...inside(from), ...inside(to)])
  const hit = depth < 4 ? blocker(from, to, skip) : null
  if (!hit) return [to]
  const { o, cx, cz } = hit
  let nx = cx - o.x
  let nz = cz - o.z
  if (Math.hypot(nx, nz) < 0.01) {
    nx = -(to.z - from.z)
    nz = to.x - from.x
  }
  const nl = Math.hypot(nx, nz) || 1
  const via = { x: o.x + (nx / nl) * (o.r + 0.7), z: o.z + (nz / nl) * (o.r + 0.7) }
  return [...route(from, via, depth + 1), ...route(via, to, depth + 1)]
}
