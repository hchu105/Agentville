import * as THREE from 'three'
import manifest from '../assets/world/manifest.json'

// Everything visual in the world is an image rendered by art/. The manifest says where it goes.
export { manifest }

const urls = import.meta.glob('../assets/world/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const assetUrl = (file: string) => urls[`../assets/world/${file}`]

export type Clip = { start: number; dirs: number; frames: number; fps: number }
export const CLIPS = manifest.sprites.clips as Record<string, Clip>

/** Prerendered pixels pass straight through: no lighting, no tone mapping. */
export function prepare(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}
