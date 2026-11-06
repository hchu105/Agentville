import { Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../sim/store'
import { Agent } from './Agent'
import { LEISURE } from '../sim/data'
import { usePanZoom, pan } from './pan'
import { Furniture, Hotspots } from './Stations'
import { CAM_POS, CAM_TARGET, LAYER, VIEW_QUAT } from './view'
import { assetUrl, LAYERS, layerOrder, manifest, prepare, ROOM } from './world'

// Where the job board stands in the lounge. Mirrors BOARD_AT in art/world.py.
const BOARD_AT = { x: 2.75, z: -0.35 }

/** The prerendered world, drawn flat to the camera. */
function Plate() {
  const tex = useTexture(assetUrl(manifest.plate.file), prepare)
  return (
    <mesh renderOrder={LAYER.plate}>
      <planeGeometry args={[manifest.plate.w, manifest.plate.h]} />
      <meshBasicMaterial map={tex} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Live index cards pinned to the board: one for each job waiting. */
function BoardCards() {
  const jobs = useStore((s) => s.board.length)
  const cards = Math.min(jobs, 6)
  const order = layerOrder(LAYERS.board) + 0.5
  const lounge = LEISURE.find((l) => l.id === 'lounge')!
  return (
    <group position={[lounge.x + BOARD_AT.x, 0, lounge.z + BOARD_AT.z]}>
      {Array.from({ length: cards }, (_, i) => (
        <group key={i} position={[-0.42 + (i % 3) * 0.42, 1.33 - Math.floor(i / 3) * 0.38, 0.04]} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.06]}>
          <mesh renderOrder={order}>
            <planeGeometry args={[0.32, 0.28]} />
            <meshBasicMaterial color="#FAF7F0" transparent depthTest={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.11, 0.01]} renderOrder={order + 0.1}>
            <circleGeometry args={[0.025, 12]} />
            <meshBasicMaterial color="#ff5a1f" transparent depthTest={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Agents() {
  const agents = useStore((s) => s.agents)
  return (
    <>
      {Object.values(agents).map((a) => (
        <Agent key={a.id} agent={a} />
      ))}
    </>
  )
}

/** Fit the whole room between the side panels on open; then drag and zoom from there. */
function Fit() {
  const { size } = useThree()
  const narrow = size.width < 820
  const side = narrow ? 0 : size.width < 1100 ? 330 : 372
  const free = Math.max(size.width - 2 * side, size.width * 0.45)
  const fit = Math.min(free / (ROOM.u1 - ROOM.u0 + 1), size.height / (ROOM.v1 - ROOM.v0 + 1.5))
  usePanZoom(fit, { u: 0, v: 0 })
  return null
}

export function Village() {
  const select = useStore((s) => s.select)
  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      flat
      camera={{ position: CAM_POS.toArray(), near: 0.1, far: 200, zoom: 40 }}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
      onPointerMissed={() => {
        if (!pan.moved) select(null)
      }}
    >
      <color attach="background" args={[manifest.floor]} />
      <Fit />
      <Suspense fallback={null}>
        <group position={CAM_TARGET} quaternion={VIEW_QUAT}>
          <Plate />
          <Furniture />
        </group>
        <BoardCards />
        <Agents />
        <Hotspots />
      </Suspense>
    </Canvas>
  )
}
