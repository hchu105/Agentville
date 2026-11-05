import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../sim/store'
import { Agent } from './Agent'
import { Cutout, Hotspots, StationCutouts } from './Stations'
import { CAM_POS, CAM_TARGET, LAYER, orderOf, VIEW_QUAT } from './view'
import { assetUrl, manifest, prepare } from './world'

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
  const order = orderOf(0) + 0.5
  return (
    <group rotation={[0, Math.PI / 4, 0]}>
      {Array.from({ length: cards }, (_, i) => (
        <group key={i} position={[-0.42 + (i % 3) * 0.42, 1.33 - Math.floor(i / 3) * 0.38, 0.05]} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.06]}>
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

/** Lock the camera and fit the village between the side panels at any size. */
function Fit() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    cam.position.copy(CAM_POS)
    cam.lookAt(CAM_TARGET)
    const narrow = size.width < 820
    const free = narrow ? size.width : Math.max(size.width - 2 * (size.width < 1100 ? 330 : 372), size.width * 0.45)
    cam.zoom = Math.min(free / 18, size.height / 13.5)
    cam.updateProjectionMatrix()
  }, [camera, size])
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
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={[manifest.floor]} />
      <Fit />
      <Suspense fallback={null}>
        <group position={CAM_TARGET} quaternion={VIEW_QUAT}>
          <Plate />
          <StationCutouts />
          <Cutout name="board" />
        </group>
        <BoardCards />
        <Agents />
        <Hotspots />
      </Suspense>
    </Canvas>
  )
}
