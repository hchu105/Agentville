import * as THREE from 'three'
import manifest from '../assets/world/manifest.json'

// Everything visual in the world is an image rendered by art/. The manifest says where it goes.
export { manifest }

const urls = import.meta.glob('../assets/world/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const assetUrl = (file: string) => urls[`../assets/world/${file}`]

export type Clip = { start: number; dirs: number; frames: number; fps: number; offset: number }
export const CLIPS = manifest.sprites.clips as Record<string, Clip>

/** One piece of furniture: a cutout drawn over or under residents by where they stand. */
export type Layer = {
  u: number
  v: number
  w: number
  h: number
  depth: number
  group: string
  footprint: number[]
  idle: string
  busy?: string
}
export const LAYERS: Record<string, Layer> = manifest.layers
const LAYER_BASE = 100
export const layerOrder = (l: Layer) => LAYER_BASE + (l.depth + 30) * 10

/** The room's extent in view space, for fitting and panning. */
export const ROOM = (() => {
  const ls = Object.values(LAYERS)
  return {
    u0: Math.min(...ls.map((l) => l.u - l.w / 2)),
    u1: Math.max(...ls.map((l) => l.u + l.w / 2)),
    v0: Math.min(...ls.map((l) => l.v - l.h / 2)),
    v1: Math.max(...ls.map((l) => l.v + l.h / 2)),
  }
})()

/**
 * Where a resident at (x, z) draws relative to the furniture: in front of
 * every piece they're in front of, behind every piece they're behind.
 * Someone inside a footprint is sitting in it or standing at it, so in front.
 */
export function residentOrder(x: number, z: number) {
  let lo = -Infinity
  let hi = Infinity
  for (const l of Object.values(LAYERS)) {
    const [x0, x1, z0, z1] = l.footprint
    const front = x > x1 || z > z1
    const back = x < x0 || z < z0
    const o = layerOrder(l)
    if (front && back) {
      if (x + z > l.depth) lo = Math.max(lo, o)
      else hi = Math.min(hi, o)
    } else if (back) hi = Math.min(hi, o)
    else lo = Math.max(lo, o)
  }
  const want = LAYER_BASE + (x + z + 30) * 10
  if (lo >= hi) return lo + 0.5
  return Math.min(hi - 0.5, Math.max(lo + 0.5, want))
}

/** Prerendered pixels pass straight through: no lighting, no tone mapping. */
export function prepare(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}
