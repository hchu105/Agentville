import { useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { useStore } from '../sim/store'
import { Person } from './Person'
import { World } from './Stations'

// A catalog-style set: an endless warm-white floor (the page background shows through),
// soft daylight from the upper left, long gentle shadows and strong contact shadows.

function People() {
  const agents = useStore((s) => s.agents)
  return (
    <>
      {Object.values(agents).map((a) => (
        <Person key={a.id} agent={a} />
      ))}
    </>
  )
}

/**
 * The post-processing composer turns off renderer.autoClear, which leaves the
 * contact-shadow buffer uncleared and smears moving people into trails.
 * Turn it on just for that pass (useFrame callbacks run in mount order).
 */
function AutoClear({ on }: { on: boolean }) {
  useFrame(({ gl }) => {
    gl.autoClear = on
  })
  return null
}

/** Fit the orthographic zoom so the whole set sits between the side panels. */
function Fit() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    const narrow = size.width < 820
    const free = narrow ? size.width : Math.max(size.width - 2 * (size.width < 1100 ? 320 : 360), size.width * 0.45)
    cam.zoom = Math.min(free / (narrow ? 15.5 : 12.8), size.height / 9.2)
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

export function Village() {
  const select = useStore((s) => s.select)
  const lowPower = typeof window !== 'undefined' && window.innerWidth < 820
  return (
    <Canvas
      shadows
      orthographic
      dpr={[1, 2]}
      camera={{ position: [24, 24, 24], near: 0.1, far: 200, zoom: 40 }}
      gl={{ antialias: false, alpha: true, toneMapping: THREE.NoToneMapping }}
      onPointerMissed={() => select(null)}
    >
      <Fit />
      <OrbitControls
        target={[-0.7, 0.5, -0.7]}
        enablePan={false}
        enableDamping
        minPolarAngle={0.7}
        maxPolarAngle={1.05}
        minAzimuthAngle={Math.PI / 4 - 0.6}
        maxAzimuthAngle={Math.PI / 4 + 0.6}
        minZoom={18}
        maxZoom={160}
      />

      <hemisphereLight args={['#ffffff', '#d8d0c4', 0.55]} />
      <directionalLight
        position={[-9, 15, 3]}
        intensity={2.1}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={5}
        shadow-bias={-0.0006}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={50}
      />
      <Environment resolution={256} frames={1} environmentIntensity={0.5}>
        <color attach="background" args={['#bdb8b0']} />
        <Lightformer form="rect" intensity={2.5} position={[0, 10, 0]} scale={[16, 16, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.4} position={[-8, 4, 4]} scale={[6, 8, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.0} position={[8, 4, 6]} scale={[6, 8, 1]} rotation-y={-Math.PI / 2} color="#fff1e0" />
      </Environment>

      {/* the floor only catches shadows; the page color is the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <shadowMaterial transparent opacity={0.16} color="#4a3f33" />
      </mesh>
      <AutoClear on />
      <ContactShadows position={[0, 0.003, 0]} scale={40} resolution={1024} blur={2.2} far={1.6} opacity={0.55} color="#3d342b" frames={Infinity} />
      <AutoClear on={false} />

      <World />
      <People />

      <EffectComposer multisampling={lowPower ? 0 : 4} enableNormalPass={false}>
        <N8AO aoRadius={0.5} intensity={2.4} distanceFalloff={0.4} quality={lowPower ? 'performance' : 'medium'} />
        <Bloom mipmapBlur intensity={0.5} luminanceThreshold={2.2} luminanceSmoothing={0.1} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  )
}
