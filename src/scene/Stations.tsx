import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { BUILDINGS, LOUNGE, type BuildingDef } from '../sim/data'
import { buildingBusy, useStore } from '../sim/store'
import type { BuildingId } from '../sim/types'
import { Alu, Ceramic, Fabric, Glow, Plain, Wood, useRug } from './materials'

// Muted, furniture-catalog palette.
const P = {
  oak: '#C9A47A',
  oakDark: '#9C7650',
  walnut: '#5C3A2A',
  maroon: '#6B2E2A',
  cream: '#EFE9DE',
  oat: '#E2D8C6',
  sage: '#8F9F7A',
  mocha: '#A98572',
  blush: '#E3B7AA',
  sky: '#BFD1E0',
  mustard: '#D9B44A',
  ink: '#262422',
  red: '#C2453A',
  signal: '#FF5A1F',
  kraft: '#C49A6C',
  leaf: '#5E7A4E',
  white: '#F7F5F0',
}

// ───────── pieces ─────────

function Rug({ w, d, kind, a, b, cells, round }: { w: number; d: number; kind: 'checker' | 'stripe' | 'border' | 'plain'; a: string; b: string; cells?: number; round?: boolean }) {
  const tex = useRug(kind, a, b, cells)
  if (round)
    return (
      <mesh position={[0, 0.008, 0]} receiveShadow>
        <cylinderGeometry args={[w / 2, w / 2, 0.016, 64]} />
        <meshStandardMaterial map={tex} roughness={1} />
      </mesh>
    )
  return (
    <RoundedBox args={[w, 0.016, d]} radius={0.006} position={[0, 0.008, 0]} receiveShadow>
      <meshStandardMaterial map={tex} roughness={1} />
    </RoundedBox>
  )
}

/** A pool of warm light on the floor, shown while a tool is in use. */
function LightPool({ on, r = 1.6, position = [0, 0.02, 0] as [number, number, number] }: { on: boolean; r?: number; position?: [number, number, number] }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(255,214,150,0.9)')
    grd.addColorStop(0.5, 'rgba(255,200,130,0.35)')
    grd.addColorStop(1, 'rgba(255,190,120,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
  const m = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((_, dt) => {
    if (!m.current) return
    const target = on ? 0.32 : 0
    m.current.opacity += (target - m.current.opacity) * Math.min(1, dt * 4)
  })
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[r * 2, r * 2]} />
      <meshBasicMaterial ref={m} map={tex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}

function Bulb({ on, position, r = 0.06 }: { on: boolean; position: [number, number, number]; r?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[r, 16, 12]} />
      {on ? <Glow color="#ffd9a0" intensity={3.2} /> : <Plain color="#efe9dc" rough={0.3} />}
    </mesh>
  )
}

function FloorLamp({ on, position, shade = P.red }: { on: boolean; position: [number, number, number]; shade?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.015, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.03, 24]} />
        <Plain color={P.ink} rough={0.4} />
      </mesh>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 1.5, 8]} />
        <Alu color="#d8d6d0" />
      </mesh>
      <group position={[0.12, 1.5, 0]} rotation={[0, 0, -0.7]}>
        <mesh castShadow>
          <coneGeometry args={[0.13, 0.22, 24, 1, true]} />
          <meshStandardMaterial color={shade} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <Bulb on={on} position={[0, -0.05, 0]} r={0.045} />
      </group>
    </group>
  )
}

function DeskLamp({ on, position, rot = 0 }: { on: boolean; position: [number, number, number]; rot?: number }) {
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.08, 0.09, 0.024, 20]} />
        <Plain color={P.ink} rough={0.4} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.32, 8]} />
        <Plain color={P.ink} rough={0.4} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <sphereGeometry args={[0.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={P.white} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Bulb on={on} position={[0, 0.34, 0]} r={0.05} />
    </group>
  )
}

function Plant({ position, s = 1, pot = P.cream }: { position: [number, number, number]; s?: number; pot?: string }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + i * 0.4
        const tilt = 0.5 + (i % 3) * 0.25
        return { a, tilt, len: 0.28 + (i % 4) * 0.06 }
      }),
    [],
  )
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.12, 0.3, 24]} />
        <Ceramic color={pot} />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} position={[0, 0.3, 0]} rotation={[0, l.a, l.tilt]}>
          <mesh position={[0, l.len, 0]} scale={[1, 1, 0.25]} castShadow>
            <sphereGeometry args={[0.1, 12, 10]} />
            <Plain color={i % 2 ? P.leaf : '#6F8B5C'} rough={0.7} />
          </mesh>
          <mesh position={[0, l.len / 2, 0]}>
            <cylinderGeometry args={[0.006, 0.006, l.len, 4]} />
            <Plain color={P.leaf} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function TableTop({ w, d, h, color = P.oak, legs = P.oakDark }: { w: number; d: number; h: number; color?: string; legs?: string }) {
  return (
    <group>
      <RoundedBox args={[w, 0.05, d]} radius={0.015} position={[0, h - 0.025, 0]} castShadow receiveShadow>
        <Wood color={color} />
      </RoundedBox>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x * (w / 2 - 0.06), (h - 0.05) / 2, z * (d / 2 - 0.06)]} castShadow>
          <cylinderGeometry args={[0.025, 0.02, h - 0.05, 10]} />
          <Wood color={legs} />
        </mesh>
      ))}
    </group>
  )
}

function Stool({ position, h = 0.46, color = P.oak }: { position: [number, number, number]; h?: number; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, h - 0.025, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.05, 28]} />
        <Wood color={color} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, (h - 0.05) / 2, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, h - 0.05, 8]} />
            <Wood color={color} />
          </mesh>
        )
      })}
    </group>
  )
}

function Laptop({ position, rot = 0, on }: { position: [number, number, number]; rot?: number; on?: boolean }) {
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <RoundedBox args={[0.34, 0.015, 0.24]} radius={0.005} castShadow>
        <Alu color="#d6d4cf" />
      </RoundedBox>
      <group position={[0, 0.005, -0.12]} rotation={[-0.3, 0, 0]}>
        <RoundedBox args={[0.34, 0.23, 0.01]} radius={0.005} position={[0, 0.115, 0]} castShadow>
          <Alu color="#d6d4cf" />
        </RoundedBox>
        <mesh position={[0, 0.115, 0.006]}>
          <planeGeometry args={[0.31, 0.2]} />
          {on ? <Glow color="#dbe8ff" intensity={0.9} /> : <Plain color="#2a2e33" rough={0.2} />}
        </mesh>
      </group>
    </group>
  )
}

function Pots({ position, colors }: { position: [number, number, number]; colors: string[] }) {
  return (
    <group position={position}>
      {colors.map((c, i) => {
        const tall = i % 3 === 0
        return (
          <mesh key={i} position={[(i - (colors.length - 1) / 2) * 0.2, tall ? 0.11 : 0.065, (i % 2) * 0.06]} castShadow>
            {tall ? <cylinderGeometry args={[0.065, 0.055, 0.22, 24]} /> : <cylinderGeometry args={[0.08, 0.045, 0.13, 24]} />}
            <Ceramic color={c} />
          </mesh>
        )
      })}
    </group>
  )
}

function Box({ position, size, color = P.kraft, rot = 0 }: { position: [number, number, number]; size: [number, number, number]; color?: string; rot?: number }) {
  return (
    <RoundedBox args={size} radius={0.012} position={position} rotation={[0, rot, 0]} castShadow receiveShadow>
      <Plain color={color} rough={0.9} />
    </RoundedBox>
  )
}

/** Soft, chunky modular sofa like a catalog render. */
function Sofa({ w = 3.2, color = P.mocha }: { w?: number; color?: string }) {
  const seats = 3
  const sw = (w - 0.5) / seats
  return (
    <group>
      <RoundedBox args={[w, 0.24, 1.0]} radius={0.1} position={[0, 0.14, 0]} castShadow receiveShadow>
        <Fabric color={color} repeat={6} />
      </RoundedBox>
      {Array.from({ length: seats }, (_, i) => (
        <RoundedBox key={i} args={[sw - 0.02, 0.16, 0.72]} radius={0.07} position={[-w / 2 + 0.25 + sw * (i + 0.5), 0.33, 0.1]} castShadow receiveShadow>
          <Fabric color={color} repeat={4} />
        </RoundedBox>
      ))}
      <RoundedBox args={[w, 0.5, 0.26]} radius={0.11} position={[0, 0.5, -0.37]} castShadow receiveShadow>
        <Fabric color={color} repeat={6} />
      </RoundedBox>
      {[-1, 1].map((sd) => (
        <RoundedBox key={sd} args={[0.26, 0.5, 1.0]} radius={0.11} position={[sd * (w / 2 - 0.13), 0.32, 0]} castShadow receiveShadow>
          <Fabric color={color} repeat={4} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.42, 0.36, 0.14]} radius={0.06} position={[-w / 2 + 0.55, 0.58, -0.18]} rotation={[-0.25, 0.15, 0.08]} castShadow>
        <Fabric color={P.mustard} repeat={2} />
      </RoundedBox>
      <RoundedBox args={[0.4, 0.34, 0.14]} radius={0.06} position={[w / 2 - 0.55, 0.58, -0.18]} rotation={[-0.25, -0.2, -0.06]} castShadow>
        <Fabric color={P.cream} repeat={2} />
      </RoundedBox>
    </group>
  )
}

function Armchair({ color = P.sky }: { color?: string }) {
  return (
    <group>
      <RoundedBox args={[0.95, 0.36, 0.9]} radius={0.12} position={[0, 0.2, 0]} castShadow receiveShadow>
        <Fabric color={color} repeat={3} />
      </RoundedBox>
      <RoundedBox args={[0.95, 0.5, 0.24]} radius={0.11} position={[0, 0.5, -0.34]} castShadow>
        <Fabric color={color} repeat={3} />
      </RoundedBox>
      {[-1, 1].map((sd) => (
        <RoundedBox key={sd} args={[0.2, 0.3, 0.86]} radius={0.09} position={[sd * 0.4, 0.45, 0]} castShadow>
          <Fabric color={color} repeat={3} />
        </RoundedBox>
      ))}
    </group>
  )
}

function Bookshelf({ w = 1.8, h = 1.8 }: { w?: number; h?: number }) {
  const rows = 4
  const books = useMemo(() => {
    const cols = ['#C2453A', '#2F3B4C', '#D9B44A', '#8F9F7A', '#EFE9DE', '#A98572', '#5E9A92', '#262422', '#E3B7AA']
    const out: { x: number; y: number; w: number; h: number; c: string; lean: number }[] = []
    for (let r = 0; r < rows; r++) {
      let x = -w / 2 + 0.08
      let i = r * 7
      while (x < w / 2 - 0.25) {
        const bw = 0.04 + ((i * 17) % 5) * 0.012
        const bh = 0.26 + ((i * 11) % 4) * 0.04
        out.push({ x: x + bw / 2, y: 0.08 + r * (h / rows) + bh / 2, w: bw, h: bh, c: cols[(i * 7) % cols.length], lean: i % 9 === 0 ? 0.25 : 0 })
        x += bw + 0.008 + (i % 6 === 0 ? 0.12 : 0)
        i++
      }
    }
    return out
  }, [w, h])
  return (
    <group>
      {/* frame */}
      <Box position={[-w / 2, h / 2, 0]} size={[0.04, h, 0.38]} color={P.oak} />
      <Box position={[w / 2, h / 2, 0]} size={[0.04, h, 0.38]} color={P.oak} />
      <Box position={[0, h / 2, -0.18]} size={[w, h, 0.02]} color={P.oat} />
      {Array.from({ length: rows + 1 }, (_, r) => (
        <Box key={r} position={[0, 0.04 + r * (h / rows), 0]} size={[w, 0.035, 0.38]} color={P.oak} />
      ))}
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0.02]} rotation={[0, 0, b.lean]} castShadow>
          <boxGeometry args={[b.w, b.h, 0.26]} />
          <Plain color={b.c} rough={0.75} />
        </mesh>
      ))}
    </group>
  )
}

// ───────── stations ─────────

function DeskStation({ busy }: { busy: boolean }) {
  return (
    <group>
      <Rug w={3.4} d={2.8} kind="checker" a="#E6E1C2" b="#CFD3A3" cells={8} />
      <group position={[0, 0, -0.35]}>
        <TableTop w={1.7} d={0.8} h={0.75} color={P.maroon} legs={P.maroon} />
        <Laptop position={[0.05, 0.76, 0.05]} on={busy} />
        <DeskLamp on={busy} position={[-0.6, 0.75, -0.15]} />
        {/* the in-tray: approvals land here */}
        <group position={[0.6, 0.76, 0.05]}>
          <Box position={[0, 0.03, 0]} size={[0.34, 0.06, 0.26]} color={P.signal} />
          <Box position={[0, 0.075, 0]} size={[0.28, 0.02, 0.2]} color={P.white} rot={0.08} />
        </group>
        <mesh position={[-0.25, 0.81, 0.15]} castShadow>
          <cylinderGeometry args={[0.04, 0.035, 0.1, 16]} />
          <Ceramic color={P.cream} />
        </mesh>
      </group>
      {/* Rae's chair, empty: Rae is you */}
      <group position={[0, 0, -1.15]}>
        <RoundedBox args={[0.5, 0.08, 0.48]} radius={0.03} position={[0, 0.46, 0]} castShadow>
          <Fabric color={P.ink} repeat={2} />
        </RoundedBox>
        <RoundedBox args={[0.5, 0.5, 0.06]} radius={0.03} position={[0, 0.76, -0.22]} castShadow>
          <Fabric color={P.ink} repeat={2} />
        </RoundedBox>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.42, 8]} />
          <Alu />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.03, 5]} />
          <Alu />
        </mesh>
        <RoundedBox args={[0.46, 0.2, 0.05]} radius={0.02} position={[0.05, 0.9, -0.15]} rotation={[0.3, 0.2, 0.1]} castShadow>
          <Fabric color={P.mustard} repeat={2} />
        </RoundedBox>
      </group>
      <Plant position={[-1.45, 0, -1.0]} s={1.15} />
      <LightPool on={busy} position={[0, 0.02, -0.2]} />
    </group>
  )
}

function LibraryStation({ busy }: { busy: boolean }) {
  return (
    <group>
      <Rug w={3.2} d={2.6} kind="border" a="#EDE4D3" b="#B4583E" />
      <group position={[-0.35, 0, -0.95]}>
        <Bookshelf />
      </group>
      <group position={[0.75, 0, 0.3]}>
        <Armchair />
      </group>
      <group position={[-0.35, 0, 0.45]}>
        <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.48, 32]} />
          <Wood color={P.oak} />
        </mesh>
        <Box position={[0, 0.51, 0]} size={[0.26, 0.05, 0.2]} color={P.mustard} rot={0.3} />
        <Box position={[0.02, 0.56, 0]} size={[0.24, 0.04, 0.18]} color={P.ink} rot={0.1} />
      </group>
      <FloorLamp on={busy} position={[1.45, 0, -0.55]} shade={P.mustard} />
      <Plant position={[-1.4, 0, 0.6]} s={0.9} pot={P.maroon} />
      <LightPool on={busy} position={[0.7, 0.02, 0.1]} />
    </group>
  )
}

function StudioStation({ busy }: { busy: boolean }) {
  return (
    <group>
      {/* backdrop sweep */}
      <group position={[0, 0, -1.0]}>
        <mesh position={[0, 1.2, -0.02]} receiveShadow castShadow>
          <boxGeometry args={[2.4, 1.6, 0.02]} />
          <Plain color="#DCE3E6" rough={0.95} />
        </mesh>
        <mesh position={[0, 0.4, 0.38]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <cylinderGeometry args={[0.4, 0.4, 2.4, 32, 1, true, Math.PI, Math.PI / 2]} />
          <meshStandardMaterial color="#DCE3E6" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.006, 0.95]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[2.4, 1.15]} />
          <Plain color="#DCE3E6" rough={0.95} />
        </mesh>
        {[-1.22, 1.22].map((x) => (
          <mesh key={x} position={[x, 1.0, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 2.0, 8]} />
            <Plain color={P.ink} />
          </mesh>
        ))}
        <mesh position={[0, 2.0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.5, 16]} />
          <Plain color="#DCE3E6" />
        </mesh>
      </group>
      {/* pedestal with today's product */}
      <group position={[0, 0, -0.35]}>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.6, 32]} />
          <Plain color={P.white} rough={0.6} />
        </mesh>
        <mesh position={[0, 0.72, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.07, 0.24, 28]} />
          <Ceramic color="#B5532F" />
        </mesh>
        <mesh position={[0.1, 0.68, 0.0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.05, 0.014, 8, 20, Math.PI]} />
          <Ceramic color="#B5532F" />
        </mesh>
      </group>
      {/* softbox */}
      <group position={[-1.15, 0, 0.15]} rotation={[0, 0.7, 0]}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 1.6, 8]} />
          <Plain color={P.ink} />
        </mesh>
        <group position={[0, 1.55, 0.05]} rotation={[0.25, 0, 0]}>
          <RoundedBox args={[0.6, 0.6, 0.3]} radius={0.03} castShadow>
            <Plain color={P.ink} rough={0.6} />
          </RoundedBox>
          <mesh position={[0, 0, 0.152]}>
            <planeGeometry args={[0.54, 0.54]} />
            {busy ? <Glow color="#fff4e2" intensity={2.6} /> : <Plain color="#f1efea" rough={0.5} />}
          </mesh>
        </group>
      </group>
      {/* tripod camera */}
      <group position={[0, 0, 0.95]}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.14, 0.55, Math.sin(a) * 0.14]} rotation={[Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 1.12, 6]} />
              <Plain color={P.ink} />
            </mesh>
          )
        })}
        <group position={[0, 1.15, 0]}>
          <RoundedBox args={[0.2, 0.14, 0.12]} radius={0.02} castShadow>
            <Plain color={P.ink} rough={0.4} />
          </RoundedBox>
          <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.055, 0.1, 20]} />
            <meshPhysicalMaterial color="#1b1b1b" roughness={0.2} clearcoat={1} />
          </mesh>
        </group>
      </group>
      <LightPool on={busy} r={1.4} position={[0, 0.02, -0.2]} />
    </group>
  )
}

function LookoutStation({ busy }: { busy: boolean }) {
  return (
    <group>
      <Rug w={3.1} d={3.1} kind="stripe" a="#E9E2D3" b="#D7CBB4" cells={14} round />
      {/* telescope on tripod */}
      <group position={[0.25, 0, -0.35]}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.4
          return (
            <mesh key={i} position={[Math.cos(a) * 0.16, 0.5, Math.sin(a) * 0.16]} rotation={[Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]} castShadow>
              <cylinderGeometry args={[0.014, 0.014, 1.05, 6]} />
              <Wood color={P.oakDark} />
            </mesh>
          )
        })}
        <group position={[0, 1.08, 0]} rotation={[0.6, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.05, 0.9, 24]} />
            <meshPhysicalMaterial color={P.white} roughness={0.35} clearcoat={0.6} />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.05, 24]} />
            <Alu />
          </mesh>
        </group>
      </group>
      {/* globe */}
      <group position={[-0.95, 0, -0.45]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.1, 0.6, 12]} />
          <Wood color={P.walnut} />
        </mesh>
        <mesh position={[0, 0.82, 0]} rotation={[0, 0, 0.4]} castShadow>
          <sphereGeometry args={[0.22, 32, 24]} />
          <meshPhysicalMaterial color="#9DB7C4" roughness={0.3} clearcoat={0.8} />
        </mesh>
        <mesh position={[0, 0.82, 0]} rotation={[0, 0, 0.4]}>
          <torusGeometry args={[0.25, 0.01, 8, 40, Math.PI * 1.3]} />
          <Alu />
        </mesh>
      </group>
      {/* side table with notes + lamp */}
      <group position={[1.0, 0, 0.35]}>
        <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.04, 28]} />
          <Wood color={P.oak} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.03, 0.05, 0.28, 10]} />
          <Wood color={P.oak} />
        </mesh>
        <DeskLamp on={busy} position={[0.05, 0.3, -0.05]} />
      </group>
      <Box position={[-0.6, 0.04, 0.75]} size={[0.32, 0.08, 0.24]} color={P.sky} rot={0.5} />
      <Box position={[-0.58, 0.1, 0.76]} size={[0.3, 0.04, 0.22]} color={P.red} rot={0.3} />
      <LightPool on={busy} r={1.4} position={[0.2, 0.02, 0]} />
    </group>
  )
}

function PostStation({ busy }: { busy: boolean }) {
  return (
    <group>
      <Rug w={3.0} d={2.4} kind="plain" a="#E4DED3" b="#E4DED3" />
      {/* pigeonhole sorter */}
      <group position={[0, 0, -0.85]}>
        <Box position={[0, 0.65, 0]} size={[1.8, 1.3, 0.36]} color={P.oak} />
        {Array.from({ length: 12 }, (_, i) => {
          const col = i % 4
          const row = Math.floor(i / 4)
          return (
            <group key={i} position={[-0.66 + col * 0.44, 0.28 + row * 0.38, 0.12]}>
              <mesh>
                <boxGeometry args={[0.38, 0.32, 0.14]} />
                <Plain color="#a3825d" rough={0.9} />
              </mesh>
              {(i * 7) % 3 !== 0 && (
                <mesh position={[0, -0.04 + ((i * 3) % 2) * 0.03, 0.04]} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.06]}>
                  <boxGeometry args={[0.3, 0.17, 0.02]} />
                  <Plain color={i % 4 === 1 ? '#f2d6c6' : P.white} />
                </mesh>
              )}
            </group>
          )
        })}
      </group>
      {/* standing counter */}
      <group position={[0, 0, 0]}>
        <TableTop w={1.5} d={0.6} h={0.92} color={P.cream} legs={P.ink} />
        <Box position={[-0.4, 0.96, 0]} size={[0.3, 0.08, 0.2]} color={P.white} rot={0.15} />
        <Box position={[-0.38, 1.02, 0.01]} size={[0.28, 0.04, 0.18]} color="#f2d6c6" rot={-0.1} />
        <Laptop position={[0.25, 0.93, 0]} rot={Math.PI} on={busy} />
        <DeskLamp on={busy} position={[0.6, 0.92, -0.15]} />
      </group>
      {/* mailbox */}
      <group position={[1.25, 0, 0.55]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
          <Plain color={P.ink} />
        </mesh>
        <RoundedBox args={[0.32, 0.36, 0.48]} radius={0.12} position={[0, 0.85, 0]} castShadow>
          <Plain color={P.signal} rough={0.5} />
        </RoundedBox>
      </group>
      <LightPool on={busy} r={1.3} position={[0, 0.02, 0.2]} />
    </group>
  )
}

function MarketStation({ busy }: { busy: boolean }) {
  return (
    <group>
      <Rug w={3.4} d={2.6} kind="checker" a="#EADFD5" b="#E3C9BE" cells={10} />
      <group position={[0, 0, -0.25]}>
        <TableTop w={2.1} d={0.75} h={0.75} color={P.oak} />
        <Pots position={[-0.45, 0.75, -0.1]} colors={['#B5532F', '#EDE3D1', '#7E9A6A', '#3E5C6E', '#D9B48A']} />
        <Laptop position={[0.45, 0.76, 0.05]} rot={0} on={busy} />
        <DeskLamp on={busy} position={[0.9, 0.75, -0.2]} />
      </group>
      <Stool position={[0.2, 0, 0.6]} />
      {/* shipping boxes */}
      <Box position={[-1.35, 0.18, 0.55]} size={[0.5, 0.36, 0.4]} rot={0.2} />
      <Box position={[-1.32, 0.48, 0.52]} size={[0.38, 0.24, 0.3]} rot={-0.1} />
      <Box position={[-0.85, 0.12, 0.85]} size={[0.32, 0.24, 0.26]} rot={0.6} color="#D8B48C" />
      <Plant position={[1.35, 0, 0.75]} s={0.85} pot={P.sky} />
      <LightPool on={busy} r={1.4} position={[0.1, 0.02, 0.1]} />
    </group>
  )
}

const MODELS: Record<BuildingId, (p: { busy: boolean }) => ReactNode> = {
  desk: DeskStation,
  library: LibraryStation,
  studio: StudioStation,
  post: PostStation,
  market: MarketStation,
  lookout: LookoutStation,
}

function Station({ def, busy, waiting }: { def: BuildingDef; busy: boolean; waiting: number }) {
  const [hover, setHover] = useState(false)
  const Model = MODELS[def.id]
  // caption sits on the floor at the island's front edge, toward the camera
  const lx = def.x + 1.2
  const lz = def.z + 1.2
  return (
    <group>
      <group
        position={[def.x, 0, def.z]}
        rotation={[0, def.rot, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <Model busy={busy} />
      </group>
      <Html position={[lx, 0.02, lz]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`tag ${busy ? 'is-busy' : ''} ${hover ? 'is-hover' : ''} ${waiting ? 'is-waiting' : ''}`}>
          <span className="tag__name">{def.name}</span>
          <span className="tag__tool">{waiting ? `${waiting} waiting for you` : def.tool}</span>
        </div>
      </Html>
    </group>
  )
}

function Lounge() {
  const jobs = useStore((s) => s.board.length)
  return (
    <group position={[LOUNGE.x, 0, LOUNGE.z]} rotation={[0, LOUNGE.rot, 0]}>
      <Rug w={4.4} d={3.4} kind="plain" a="#DDD5C6" b="#DDD5C6" />
      <group position={[0, 0, -0.55]}>
        <Sofa />
      </group>
      {/* oval coffee table */}
      <group position={[0, 0, 0.85]}>
        <mesh position={[0, 0.34, 0]} scale={[1.6, 1, 0.8]} castShadow receiveShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.05, 40]} />
          <Wood color={P.oak} />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.16, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.32, 20]} />
            <Wood color={P.oak} />
          </mesh>
        ))}
        <Pots position={[-0.25, 0.37, 0]} colors={['#3E5C6E', '#EDE3D1']} />
        <Box position={[0.3, 0.39, 0.02]} size={[0.3, 0.04, 0.22]} color={P.ink} rot={0.2} />
        <Box position={[0.31, 0.42, 0.02]} size={[0.28, 0.03, 0.2]} color={P.blush} rot={-0.1} />
      </group>
      {/* the job board, pinned with today's jobs */}
      <group position={[2.75, 0, 0.75]} rotation={[0, -0.35, 0]}>
        {[-0.4, 0.4].map((x) => (
          <mesh key={x} position={[x, 0.75, -0.1]} rotation={[0.12, 0, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
            <Wood color={P.oakDark} />
          </mesh>
        ))}
        <RoundedBox args={[1.0, 0.75, 0.04]} radius={0.02} position={[0, 1.1, -0.06]} rotation={[0.12, 0, 0]} castShadow>
          <Plain color="#C8A27A" rough={0.95} />
        </RoundedBox>
        {Array.from({ length: Math.min(jobs, 6) }, (_, i) => (
          <group key={i} position={[-0.3 + (i % 3) * 0.3, 1.24 - Math.floor(i / 3) * 0.3, -0.03]} rotation={[0.12, 0, (i % 2 ? 1 : -1) * 0.07]}>
            <mesh>
              <planeGeometry args={[0.24, 0.22]} />
              <Plain color={P.white} rough={0.9} />
            </mesh>
            <mesh position={[0, 0.08, 0.01]}>
              <sphereGeometry args={[0.018, 10, 10]} />
              <Plain color={P.signal} rough={0.4} />
            </mesh>
          </group>
        ))}
      </group>
      <FloorLamp on={false} position={[-2.1, 0, -0.7]} shade={P.red} />
      <Plant position={[-1.95, 0, 0.8]} s={1.25} pot={P.oat} />
    </group>
  )
}

export function World() {
  const busyKey = useStore((s) => [...buildingBusy(s)].sort().join(','))
  const busy = new Set(busyKey.split(','))
  const waiting = useStore((s) => Object.values(s.tasks).filter((t) => t.status === 'waiting').length)
  return (
    <>
      <Lounge />
      {BUILDINGS.map((b) => (
        <Station key={b.id} def={b} busy={busy.has(b.id) || (b.id === 'desk' && waiting > 0)} waiting={b.id === 'desk' ? waiting : 0} />
      ))}
    </>
  )
}
