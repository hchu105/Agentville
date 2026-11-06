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
