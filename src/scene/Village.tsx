import { useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { BUILDINGS } from '../sim/data'
import { doorOf, useStore } from '../sim/store'
import { Agent } from './Agent'
import { Buildings } from './Buildings'
import { Alu, Ceramic, Felt, Glow, Wood } from './materials'

const PLINTH = 17

function Tree({ x, z, s = 1, kind = 0 }: { x: number; z: number; s?: number; kind?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.6, 10]} />
        <Wood color="#6b4a33" />
      </mesh>
      {kind === 0 ? (
        <mesh position={[0, 0.95, 0]} castShadow>
          <sphereGeometry args={[0.5, 32, 24]} />
          <Felt color="#7E9A6A" repeat={2} />
        </mesh>
      ) : (
        <mesh position={[0, 1.05, 0]} castShadow>
          <coneGeometry args={[0.45, 1.3, 32]} />
          <Felt color="#5F7B52" repeat={2} />
        </mesh>
      )}
    </group>
  )
}

function JobBoard3D() {
  const jobs = useStore((s) => s.board.length)
  const cards = Math.min(jobs, 6)
  return (
    <group position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.0, 1.1, 0.24, 48]} />
        <Wood color="#EDE3D1" />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1.5, 10]} />
          <Wood color="#2A2826" />
        </mesh>
      ))}
      <RoundedBox args={[1.3, 0.9, 0.08]} radius={0.03} position={[0, 1.15, 0]} castShadow>
        <Wood color="#C89B6D" />
      </RoundedBox>
      {Array.from({ length: cards }, (_, i) => (
        <group key={i} position={[-0.42 + (i % 3) * 0.42, 1.33 - Math.floor(i / 3) * 0.38, 0.05]} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.06]}>
          <mesh>
            <planeGeometry args={[0.32, 0.28]} />
            <meshStandardMaterial color="#FAF7F0" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.11, 0.01]}>
            <sphereGeometry args={[0.025, 10, 10]} />
            <Glow color="#ff5a1f" intensity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Ground() {
  // paths from plaza to each building door
  const paths = useMemo(
    () =>
      BUILDINGS.map((b) => {
        const d = doorOf(b.id)
        const len = Math.hypot(d.x, d.z)
        return { id: b.id, len, angle: Math.atan2(d.x, d.z), mid: { x: d.x / 2, z: d.z / 2 } }
      }),
    [],
  )
  return (
    <group>
      {/* machined aluminum plinth */}
      <RoundedBox args={[PLINTH, 1.1, PLINTH]} radius={0.35} smoothness={6} position={[0, -0.6, 0]} receiveShadow castShadow>
        <Alu color="#cfccc6" rough={0.42} />
      </RoundedBox>
      {/* signal-orange LED strip along the front edges */}
      <mesh position={[0, -0.58, PLINTH / 2 + 0.005]}>
        <boxGeometry args={[PLINTH - 2, 0.05, 0.02]} />
        <Glow color="#ff5a1f" intensity={2.5} />
      </mesh>
      <mesh position={[PLINTH / 2 + 0.005, -0.58, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[PLINTH - 2, 0.05, 0.02]} />
        <Glow color="#ff5a1f" intensity={0.6} />
      </mesh>
      {/* felt top */}
      <RoundedBox args={[PLINTH - 0.8, 0.2, PLINTH - 0.8]} radius={0.08} position={[0, -0.06, 0]} receiveShadow>
        <Felt color="#C7B596" repeat={6} />
      </RoundedBox>
      {/* plaza */}
      <mesh position={[0, 0.045, 0]} receiveShadow>
        <cylinderGeometry args={[3.2, 3.2, 0.02, 64]} />
        <Felt color="#E6DCC8" repeat={4} />
      </mesh>
      {paths.map((p) => (
        <mesh key={p.id} position={[p.mid.x, 0.042, p.mid.z]} rotation={[0, p.angle, 0]} receiveShadow>
          <boxGeometry args={[1.0, 0.02, p.len]} />
          <Felt color="#E6DCC8" repeat={2} />
        </mesh>
      ))}
      {/* grass patches */}
      {[
        [-3.2, 3.3, 2.4, 1.6],
        [3.0, -1.4, 1.6, 2.2],
        [-2.6, -2.6, 1.4, 1.0],
        [6.3, 5.6, 2.6, 2.6],
        [-6.6, 6.1, 2.4, 2.0],
        [2.2, 6.6, 2.0, 1.5],
      ].map(([x, z, w, d], i) => (
        <RoundedBox key={i} args={[w, 0.08, d]} radius={0.04} position={[x, 0.06, z]} receiveShadow>
          <Felt color="#9DB08A" repeat={2} />
        </RoundedBox>
      ))}
      <Tree x={-3.3} z={3.5} />
      <Tree x={-2.6} z={2.9} s={0.7} kind={1} />
      <Tree x={6.6} z={6.0} s={1.1} kind={1} />
      <Tree x={5.7} z={5.5} s={0.8} />
      <Tree x={-6.9} z={6.3} s={0.9} />
      <Tree x={-7.2} z={-1.4} s={0.8} kind={1} />
      <Tree x={7.2} z={-1.6} s={0.9} />
      <Tree x={2.6} z={-7.0} s={0.8} kind={1} />
      <Tree x={-2.7} z={-7.1} s={0.7} />
      <Tree x={3.1} z={-1.3} s={0.6} kind={1} />
      {/* kiln chimney: a nod to the shop */}
      <group position={[2.2, 0, 6.6]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.55, 0.8, 32]} />
          <Wood color="#B5532F" />
        </mesh>
        <mesh position={[0, 0.82, 0]} castShadow>
          <sphereGeometry args={[0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Wood color="#B5532F" />
        </mesh>
        <mesh position={[0.18, 0.35, 0.43]}>
          <circleGeometry args={[0.14, 24]} />
          <Glow color="#ff8a3d" intensity={2} />
        </mesh>
      </group>
      {/* a stack of pots by the plaza */}
      {[
        [1.9, 2.6, '#3E5C6E'],
        [2.2, 2.3, '#EDE3D1'],
        [2.15, 2.75, '#7E9A6A'],
      ].map(([x, z, c], i) => (
        <mesh key={i} position={[x as number, 0.15, z as number]} castShadow>
          <cylinderGeometry args={[0.14, 0.1, 0.22, 24]} />
          <Ceramic color={c as string} />
        </mesh>
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

/** Fit the orthographic zoom to the viewport so the diorama looks right at any size. */
function Fit() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    // On desktop the side panels cover ~370px each, so fit the plinth into the space between them.
    const narrow = size.width < 820
    const free = narrow ? size.width : Math.max(size.width - 2 * (size.width < 1100 ? 330 : 372), size.width * 0.45)
    cam.zoom = Math.min(free / 21, size.height / 15.5)
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
      camera={{ position: [22, 20, 22], near: 0.1, far: 200, zoom: 40 }}
      gl={{ antialias: false, alpha: true, toneMapping: THREE.NoToneMapping }}
      onPointerMissed={() => select(null)}
    >
      <Fit />
      <OrbitControls
        target={[0, 0.6, 0]}
        enablePan={false}
        enableDamping
        minPolarAngle={0.65}
        maxPolarAngle={1.05}
        minAzimuthAngle={Math.PI / 4 - 0.6}
        maxAzimuthAngle={Math.PI / 4 + 0.6}
        minZoom={18}
        maxZoom={140}
      />

      {/* Product-photography lighting: a warm key, cool fill, and a softbox studio for reflections. */}
      <hemisphereLight args={['#fff4e6', '#5a5048', 0.35]} />
      <directionalLight
        position={[9, 16, 6]}
        intensity={3.2}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={6}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={50}
      />
      <directionalLight position={[-10, 6, -4]} intensity={0.5} color="#cfe0ff" />
      <Environment resolution={256} frames={1} environmentIntensity={0.55}>
        <color attach="background" args={['#8f8a82']} />
        <Lightformer form="rect" intensity={3} position={[0, 8, 4]} scale={[12, 4, 1]} rotation-x={-Math.PI / 2.5} />
        <Lightformer form="rect" intensity={1.6} position={[-8, 3, 2]} scale={[4, 8, 1]} rotation-y={Math.PI / 2} color="#dfe8ff" />
        <Lightformer form="rect" intensity={2.2} position={[8, 3, 4]} scale={[4, 8, 1]} rotation-y={-Math.PI / 2} color="#fff0dc" />
        <Lightformer form="ring" intensity={1.2} position={[0, 4, -9]} scale={4} color="#ffffff" />
      </Environment>

      <Ground />
      <JobBoard3D />
      <Buildings />
      <Agents />

      <EffectComposer multisampling={lowPower ? 0 : 4} enableNormalPass={false}>
        <N8AO aoRadius={0.8} intensity={2.6} distanceFalloff={0.5} quality={lowPower ? 'performance' : 'medium'} />
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.4} luminanceSmoothing={0.1} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  )
}
