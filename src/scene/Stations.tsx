import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { BUILDINGS, type BuildingDef } from '../sim/data'
import { buildingBusy, useStore } from '../sim/store'
import { assetUrl, manifest, prepare } from './world'
import { orderOf } from './view'

type Layer = (typeof manifest.layers)['desk'] & { busy?: string }
const layers = manifest.layers as Record<string, Layer>

/** A station is a cutout from the world image, so residents can pass behind it. */
export function Cutout({ name, busy = false }: { name: string; busy?: boolean }) {
  const l = layers[name]
  const idle = useTexture(assetUrl(l.idle), prepare)
  const lit = useTexture(assetUrl(l.busy ?? l.idle), prepare)
  const litMat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((_, dt) => {
    const m = litMat.current
    if (m) m.opacity = THREE.MathUtils.damp(m.opacity, busy ? 1 : 0, 5, dt)
  })
  const order = orderOf(l.depth)
  return (
    <group position={[l.u, l.v, 0]}>
      <mesh renderOrder={order}>
        <planeGeometry args={[l.w, l.h]} />
        <meshBasicMaterial map={idle} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {l.busy && (
        <mesh renderOrder={order + 0.01}>
          <planeGeometry args={[l.w, l.h]} />
          <meshBasicMaterial ref={litMat} map={lit} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/** World-space hover area and label for one station. */
function Hotspot({ def, busy, waiting }: { def: BuildingDef; busy: boolean; waiting: number }) {
  const [hover, setHover] = useState(false)
  return (
    <group position={[def.x, 0, def.z]}>
      <mesh
        position={[0, def.labelY / 2, 0]}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[3, def.labelY, 2.4]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <Html position={[0, def.labelY, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`tag ${busy ? 'is-busy' : ''} ${hover ? 'is-hover' : ''} ${waiting ? 'is-waiting' : ''}`}>
          <span className="tag__name">{def.name}</span>
          <span className="tag__tool">{waiting ? `${waiting} waiting for you` : def.tool}</span>
        </div>
      </Html>
    </group>
  )
}

const useBusy = () => {
  const busyKey = useStore((s) => [...buildingBusy(s)].sort().join(','))
  const waiting = useStore((s) => Object.values(s.tasks).filter((t) => t.status === 'waiting').length)
  const set = new Set(busyKey.split(','))
  return { waiting, isBusy: (id: string) => set.has(id) || (id === 'desk' && waiting > 0) }
}

export function StationCutouts() {
  const { isBusy } = useBusy()
  return (
    <>
      {BUILDINGS.map((b) => (
        <Cutout key={b.id} name={b.id} busy={isBusy(b.id)} />
      ))}
    </>
  )
}

export function Hotspots() {
  const { isBusy, waiting } = useBusy()
  return (
    <>
      {BUILDINGS.map((b) => (
        <Hotspot key={b.id} def={b} busy={isBusy(b.id)} waiting={b.id === 'desk' ? waiting : 0} />
      ))}
    </>
  )
}
