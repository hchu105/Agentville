import { useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { BUILDINGS, type BuildingDef } from '../sim/data'
import { buildingBusy, useStore } from '../sim/store'
import type { BuildingId } from '../sim/types'
import { Acrylic, Alu, Ceramic, Felt, Glow, Wood } from './materials'

const C = {
  oat: '#EDE3D1',
  cream: '#F6EFE3',
  clay: '#D98E62',
  moss: '#7E9A6A',
  mossDark: '#5F7B52',
  rust: '#B5532F',
  slate: '#5B6670',
  ink: '#2A2826',
  oak: '#C89B6D',
  signal: '#FF5A1F',
}

/** Status LED: dim when idle, pulsing signal-orange while an agent is using the tool. */
function Led({ busy, position }: { busy: boolean; position: [number, number, number] }) {
  const m = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (!m.current) return
    m.current.emissiveIntensity = busy ? 2.2 + Math.sin(clock.elapsedTime * 6) * 1.2 : 0.15
  })
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.07, 16, 16]} />
      <meshStandardMaterial ref={m} color={busy ? C.signal : '#6b6660'} emissive={C.signal} toneMapped={false} />
    </mesh>
  )
}

function Window({ busy, position, size = [0.42, 0.5] }: { busy: boolean; position: [number, number, number]; size?: [number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[size[0] + 0.08, size[1] + 0.08, 0.06]} radius={0.03}>
        <Wood color={C.ink} />
      </RoundedBox>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={size} />
        {busy ? <Glow color="#ffc27a" intensity={1.4} /> : <meshPhysicalMaterial color="#3a4148" roughness={0.1} clearcoat={1} />}
      </mesh>
    </group>
  )
}

function Door({ z, color = C.signal }: { z: number; color?: string }) {
  return (
    <group position={[0, 0.42, z]}>
      <RoundedBox args={[0.52, 0.84, 0.08]} radius={0.04}>
        <Wood color={color} />
      </RoundedBox>
      <mesh position={[0.16, -0.02, 0.05]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <Alu />
      </mesh>
    </group>
  )
}

function Roof({ w, d, h, color, y }: { w: number; d: number; h: number; color: string; y: number }) {
  // A gabled roof from a 3-sided cylinder, stretched.
  return (
    <mesh position={[0, y + h / 2 - 0.02, 0]} rotation={[0, 0, Math.PI / 2]} scale={[h * 1.15, w / 1.7, d / 1.15]} castShadow>
      <cylinderGeometry args={[0.66, 0.66, 1.7, 3, 1]} />
      <Wood color={color} />
    </mesh>
  )
}

function Desk({ busy }: { busy: boolean }) {
  return (
    <group>
      <RoundedBox args={[2.6, 1.5, 1.9]} radius={0.08} position={[0, 0.75, 0]} castShadow receiveShadow>
        <Wood color={C.cream} />
      </RoundedBox>
      <mesh position={[0, 1.95, 0]} castShadow>
        <boxGeometry args={[2.9, 0.12, 2.2]} />
        <Alu color="#c9c6c0" />
      </mesh>
      <Roof w={2.7} d={2.1} h={0.9} color={C.slate} y={1.98} />
      <Door z={0.96} />
      <Window busy={busy} position={[-0.85, 0.95, 0.96]} />
      <Window busy={busy} position={[0.85, 0.95, 0.96]} />
      {/* flagpole */}
      <group position={[1.15, 1.95, -0.6]}>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.4, 8]} />
          <Alu />
        </mesh>
        <mesh position={[0.22, 1.22, 0]}>
          <boxGeometry args={[0.42, 0.26, 0.02]} />
          <Wood color={C.signal} />
        </mesh>
      </group>
      {/* in-tray by the door */}
      <group position={[-1.6, 0, 1.1]}>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
          <Alu />
        </mesh>
        <RoundedBox args={[0.5, 0.3, 0.4]} radius={0.05} position={[0, 0.88, 0]} castShadow>
          <Wood color={C.signal} />
        </RoundedBox>
      </group>
      <Led busy={busy} position={[0, 1.65, 0.97]} />
    </group>
  )
}

function Library({ busy }: { busy: boolean }) {
  return (
    <group>
      <RoundedBox args={[2.3, 0.22, 1.8]} radius={0.05} position={[0, 0.11, 0]} receiveShadow castShadow>
        <Wood color={C.oat} />
      </RoundedBox>
      <RoundedBox args={[2.0, 1.4, 1.3]} radius={0.06} position={[0, 0.92, -0.15]} castShadow receiveShadow>
        <Wood color={C.cream} />
      </RoundedBox>
      {[-0.8, -0.27, 0.27, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.92, 0.65]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 1.4, 20]} />
          <Wood color={C.oat} />
        </mesh>
      ))}
      <RoundedBox args={[2.3, 0.16, 1.8]} radius={0.05} position={[0, 1.7, 0]} castShadow>
        <Wood color={C.oat} />
      </RoundedBox>
      <mesh position={[0, 2.1, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]} castShadow>
        <cylinderGeometry args={[0.001, 1.3, 0.62, 4, 1]} />
        <Wood color={C.mossDark} />
      </mesh>
      <Door z={0.52} color={C.mossDark} />
      <Window busy={busy} position={[-0.55, 1.05, 0.52]} size={[0.3, 0.5]} />
      <Window busy={busy} position={[0.55, 1.05, 0.52]} size={[0.3, 0.5]} />
      <Led busy={busy} position={[0, 1.7, 0.92]} />
    </group>
  )
}

function Studio({ busy }: { busy: boolean }) {
  return (
    <group>
      <RoundedBox args={[2.2, 1.7, 1.8]} radius={0.1} position={[0, 0.85, 0]} castShadow receiveShadow>
        <Wood color={C.ink} />
      </RoundedBox>
      {/* sawtooth skylight roof */}
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 1.7, 0]}>
          <mesh rotation={[0, 0, -0.5]} position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[1.25, 0.06, 1.8]} />
            <Alu color="#d2d0cb" />
          </mesh>
          <mesh position={[0.5, 0.3, 0]}>
            <boxGeometry args={[0.04, 0.6, 1.7]} />
            {busy ? <Glow color="#fff3dd" intensity={1.6} /> : <Acrylic color="#e8f2f5" frost={0.2} />}
          </mesh>
        </group>
      ))}
      {/* big frosted front window */}
      <mesh position={[-0.35, 0.95, 0.91]}>
        <boxGeometry args={[1.0, 1.0, 0.05]} />
        {busy ? <Glow color="#ffe7c7" intensity={1.2} /> : <Acrylic color="#f2f4f5" frost={0.45} />}
      </mesh>
      {/* lens badge */}
      <group position={[0.65, 1.15, 0.92]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.28, 0.28, 0.1, 40]} />
          <Alu />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.04, 40]} />
          <meshPhysicalMaterial color="#1b2430" roughness={0.02} clearcoat={1} metalness={0.3} />
        </mesh>
      </group>
      <group position={[0.65, 0, 0.9]}>
        <Door z={0} color={C.clay} />
      </group>
      <Led busy={busy} position={[0.65, 1.6, 0.93]} />
    </group>
  )
}

function PostOffice({ busy }: { busy: boolean }) {
  return (
    <group>
      <RoundedBox args={[2.1, 1.3, 1.7]} radius={0.08} position={[0, 0.65, 0]} castShadow receiveShadow>
        <Wood color={C.oat} />
      </RoundedBox>
      {/* barrel roof */}
      <mesh position={[0, 1.3, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.88, 0.88, 2.3, 40, 1, false, 0, Math.PI]} />
        <Wood color={C.rust} />
      </mesh>
      <mesh position={[0, 1.3, 0.86]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.88, 40, 0, Math.PI]} />
        <Wood color={C.oat} />
      </mesh>
      <Window busy={busy} position={[0, 1.55, 0.88]} size={[0.6, 0.28]} />
      <Door z={0.86} color={C.rust} />
      {/* mailbox */}
      <group position={[1.35, 0, 1.0]}>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
          <Alu />
        </mesh>
        <RoundedBox args={[0.34, 0.42, 0.5]} radius={0.12} position={[0, 0.85, 0]} castShadow>
          <Wood color={C.signal} />
        </RoundedBox>
        <mesh position={[0.18, 1.0, -0.1]}>
          <boxGeometry args={[0.02, 0.22, 0.08]} />
          <Alu />
        </mesh>
      </group>
      <Led busy={busy} position={[-0.7, 1.05, 0.87]} />
    </group>
  )
}

function Market({ busy }: { busy: boolean }) {
  const stripes = 7
  const glazes = ['#B5532F', '#EDE3D1', '#7E9A6A', '#3E5C6E', '#D9B48A', '#B5532F', '#EDE3D1']
  return (
    <group>
      {/* counter */}
      <RoundedBox args={[2.4, 0.8, 0.8]} radius={0.06} position={[0, 0.4, 0.35]} castShadow receiveShadow>
        <Wood color={C.oak} />
      </RoundedBox>
      {/* posts */}
      {[-1.1, 1.1].map((x) =>
        [-0.45, 0.65].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.95, z]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 1.9, 10]} />
            <Wood color={C.ink} />
          </mesh>
        )),
      )}
      {/* striped awning */}
      <group position={[0, 1.95, 0.15]} rotation={[0.28, 0, 0]}>
        {Array.from({ length: stripes }, (_, i) => (
          <RoundedBox
            key={i}
            args={[2.6 / stripes, 0.06, 1.5]}
            radius={0.02}
            position={[-1.3 + (2.6 / stripes) * (i + 0.5), 0, 0]}
            castShadow
          >
            <Felt color={i % 2 ? C.cream : C.signal} repeat={1} />
          </RoundedBox>
        ))}
      </group>
      {/* the shop's own pots on the counter */}
      {glazes.map((g, i) => {
        const x = -0.95 + i * 0.32
        const tall = i % 3 === 0
        return (
          <mesh key={i} position={[x, 0.8 + (tall ? 0.14 : 0.09), 0.38 + (i % 2) * 0.12]} castShadow>
            {tall ? <cylinderGeometry args={[0.1, 0.08, 0.28, 24]} /> : <cylinderGeometry args={[0.13, 0.07, 0.18, 24]} />}
            <Ceramic color={g} />
          </mesh>
        )
      })}
      {/* back shelf */}
      <RoundedBox args={[2.2, 0.08, 0.35]} radius={0.02} position={[0, 1.15, -0.4]} castShadow>
        <Wood color={C.oak} />
      </RoundedBox>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[-0.8 + i * 0.4, 1.28, -0.4]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.18, 20]} />
          <Ceramic color={glazes[(i + 2) % glazes.length]} />
        </mesh>
      ))}
      <Led busy={busy} position={[1.0, 0.65, 0.77]} />
    </group>
  )
}

function Lookout({ busy }: { busy: boolean }) {
  const scope = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (scope.current) scope.current.rotation.y = busy ? Math.sin(clock.elapsedTime * 0.8) * 0.9 : 0.3
  })
  return (
    <group>
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.78, 2.4, 40]} />
        <Wood color={C.cream} />
      </mesh>
      {[0.5, 1.3, 2.1].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.7 - y * 0.035, 0.035, 8, 48]} />
          <Alu />
        </mesh>
      ))}
      <mesh position={[0, 2.48, 0]} castShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.14, 40]} />
        <Alu color="#c9c6c0" />
      </mesh>
      {/* glass dome */}
      <mesh position={[0, 2.55, 0]}>
        <sphereGeometry args={[0.6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Acrylic color="#e9f3f6" frost={0.08} />
      </mesh>
      <group ref={scope} position={[0, 2.75, 0]}>
        <mesh rotation={[0.9, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.13, 0.7, 24]} />
          <Wood color={C.signal} />
        </mesh>
      </group>
      <Window busy={busy} position={[0, 1.65, 0.68]} size={[0.3, 0.42]} />
      <Door z={0.72} color={C.mossDark} />
      <Led busy={busy} position={[0.4, 0.95, 0.62]} />
    </group>
  )
}

const MODELS: Record<BuildingId, (p: { busy: boolean }) => ReactNode> = {
  desk: Desk,
  library: Library,
  studio: Studio,
  post: PostOffice,
  market: Market,
  lookout: Lookout,
}

function Building({ def, busy, waiting }: { def: BuildingDef; busy: boolean; waiting: number }) {
  const [hover, setHover] = useState(false)
  const face = Math.atan2(-def.x, -def.z)
  const Model = MODELS[def.id]
  const labelY = def.id === 'lookout' ? 3.4 : def.id === 'desk' ? 3.15 : 2.7
  return (
    <group
      position={[def.x, 0, def.z]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <group rotation={[0, face, 0]}>
        <Model busy={busy} />
      </group>
      <Html position={[0, labelY, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`tag ${busy ? 'is-busy' : ''} ${hover ? 'is-hover' : ''} ${waiting ? 'is-waiting' : ''}`}>
          <span className="tag__name">{def.name}</span>
          <span className="tag__tool">{waiting ? `${waiting} waiting for you` : def.tool}</span>
        </div>
      </Html>
    </group>
  )
}

export function Buildings() {
  const busyKey = useStore((s) => [...buildingBusy(s)].sort().join(','))
  const busy = new Set(busyKey.split(','))
  const waiting = useStore((s) => Object.values(s.tasks).filter((t) => t.status === 'waiting').length)
  return (
    <>
      {BUILDINGS.map((b) => (
        <Building key={b.id} def={b} busy={busy.has(b.id) || (b.id === 'desk' && waiting > 0)} waiting={b.id === 'desk' ? waiting : 0} />
      ))}
    </>
  )
}
