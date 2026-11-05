import { useMemo } from 'react'
import * as THREE from 'three'

// Material system. Each material has one job:
//   vinyl    → agents (personality)
//   felt     → ground, foliage (the world)
//   wood     → buildings
//   alu      → plinth, controls (your authority)
//   acrylic  → signage, glass (information)
//   ceramic  → the shop's own product, glazed and glossy

// One shared procedural noise texture gives every surface micro-variation,
// which is most of what makes simple shapes read as real objects.
let noiseTex: THREE.CanvasTexture | null = null
let brushTex: THREE.CanvasTexture | null = null

function makeNoise() {
  if (noiseTex) return noiseTex
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  // value noise with a couple of octaves, plus fibre speckle for the felt look
  const grid = (n: number) => Array.from({ length: n * n }, () => Math.random())
  const g1 = grid(16)
  const g2 = grid(64)
  const sample = (g: number[], n: number, x: number, y: number) => {
    const fx = (x / size) * n
    const fy = (y / size) * n
    const x0 = Math.floor(fx) % n
    const y0 = Math.floor(fy) % n
    const x1 = (x0 + 1) % n
    const y1 = (y0 + 1) % n
    const tx = fx - Math.floor(fx)
    const ty = fy - Math.floor(fy)
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const a = g[y0 * n + x0] * (1 - sx) + g[y0 * n + x1] * sx
    const b = g[y1 * n + x0] * (1 - sx) + g[y1 * n + x1] * sx
    return a * (1 - sy) + b * sy
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = 0.5 * sample(g1, 16, x, y) + 0.35 * sample(g2, 64, x, y) + 0.15 * Math.random()
      const i = (y * size + x) * 4
      const b = Math.floor(v * 255)
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  noiseTex = new THREE.CanvasTexture(c)
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping
  noiseTex.colorSpace = THREE.NoColorSpace
  return noiseTex
}

function makeBrush() {
  if (brushTex) return brushTex
  const w = 512
  const h = 64
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 1400; i++) {
    const y = Math.random() * h
    const v = 100 + Math.random() * 60
    ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`
    ctx.beginPath()
    ctx.moveTo(Math.random() * w, y)
    ctx.lineTo(Math.random() * w, y + (Math.random() - 0.5) * 0.6)
    ctx.stroke()
  }
  brushTex = new THREE.CanvasTexture(c)
  brushTex.wrapS = brushTex.wrapT = THREE.RepeatWrapping
  brushTex.colorSpace = THREE.NoColorSpace
  return brushTex
}

const useTex = (make: () => THREE.CanvasTexture, repeat: number) =>
  useMemo(() => {
    const t = make().clone()
    t.needsUpdate = true
    t.repeat.set(repeat, repeat)
    return t
  }, [make, repeat])

export function Vinyl({ color, gloss = 0.35 }: { color: string; gloss?: number }) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.55}
      clearcoat={gloss}
      clearcoatRoughness={0.35}
      sheen={0.25}
      sheenRoughness={0.6}
      sheenColor={'#ffffff'}
    />
  )
}

export function Felt({ color, repeat = 3 }: { color: string; repeat?: number }) {
  const tex = useTex(makeNoise, repeat)
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={1}
      roughnessMap={tex}
      bumpMap={tex}
      bumpScale={1.4}
      sheen={1}
      sheenRoughness={0.85}
      sheenColor={'#fff6e8'}
    />
  )
}

export function Wood({ color, repeat = 1 }: { color: string; repeat?: number }) {
  const tex = useTex(makeNoise, repeat)
  return <meshStandardMaterial color={color} roughness={0.72} roughnessMap={tex} bumpMap={tex} bumpScale={0.35} />
}

export function Alu({ color = '#b9b8b4', rough = 0.32 }: { color?: string; rough?: number }) {
  const tex = useTex(makeBrush, 2)
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={1}
      roughness={rough}
      roughnessMap={tex}
      anisotropy={0.6}
      clearcoat={0.2}
      clearcoatRoughness={0.4}
    />
  )
}

export function Acrylic({ color = '#ffffff', frost = 0.35 }: { color?: string; frost?: number }) {
  return (
    <meshPhysicalMaterial
      color={color}
      transmission={1}
      thickness={0.4}
      roughness={frost}
      ior={1.49}
      attenuationColor={color}
      attenuationDistance={1.2}
    />
  )
}

export function Ceramic({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={1} clearcoatRoughness={0.08} />
}

export function Glow({ color, intensity = 2 }: { color: string; intensity?: number }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
}
