import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { runtime, useStore } from '../sim/store'
import type { AgentState } from '../sim/types'
import { Alu, Glow, Vinyl } from './materials'

const INK = '#1d1c1a'

function Prop({ agent }: { agent: AgentState }) {
  switch (agent.prop) {
    case 'beret':
      return (
        <group position={[0.06, 1.42, -0.02]} rotation={[0.1, 0, -0.32]}>
          <mesh castShadow scale={[1, 0.32, 1]}>
            <sphereGeometry args={[0.34, 32, 16]} />
            <Vinyl color={agent.accent} gloss={0.1} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
            <Vinyl color={agent.accent} />
          </mesh>
        </group>
      )
    case 'camera':
      return (
        <group>
          <mesh castShadow position={[0, 1.34, 0]} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.35, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Vinyl color={agent.accent} gloss={0.1} />
          </mesh>
          <mesh position={[0, 1.33, 0.22]} rotation={[0.25, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.025, 32, 1, false, -Math.PI / 2.4, Math.PI / 1.2]} />
            <Vinyl color={agent.accent} />
          </mesh>
          <group position={[0, 0.52, 0.3]}>
            <RoundedBox args={[0.3, 0.2, 0.14]} radius={0.04} castShadow>
              <meshPhysicalMaterial color={INK} roughness={0.4} clearcoat={0.6} />
            </RoundedBox>
            <mesh position={[0, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.08, 0.07, 24]} />
              <Alu color="#8a8a88" />
            </mesh>
            <mesh position={[0, 0, 0.128]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.005, 24]} />
              <meshPhysicalMaterial color="#223" roughness={0.05} metalness={0.2} clearcoat={1} />
            </mesh>
          </group>
        </group>
      )
    case 'antenna':
      return (
        <group position={[0.1, 1.38, 0]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.36, 8]} />
            <Alu />
          </mesh>
          <mesh position={[0, 0.39, 0]}>
            <sphereGeometry args={[0.065, 16, 16]} />
            <Glow color="#ffd36b" intensity={3} />
          </mesh>
        </group>
      )
    case 'satchel':
      return (
        <group>
          <mesh castShadow position={[0, 1.36, 0]}>
            <cylinderGeometry args={[0.28, 0.3, 0.16, 32]} />
            <Vinyl color={agent.accent} gloss={0.1} />
          </mesh>
          <mesh position={[0, 1.29, 0.16]} rotation={[-0.25, 0, 0]}>
            <boxGeometry args={[0.44, 0.02, 0.2]} />
            <Vinyl color={INK} />
          </mesh>
          <RoundedBox args={[0.24, 0.22, 0.1]} radius={0.04} position={[0.33, 0.38, 0.05]} rotation={[0, 0, 0.15]} castShadow>
            <Vinyl color="#c99a5b" gloss={0.05} />
          </RoundedBox>
        </group>
      )
  }
}

/** Orange sign held up when waiting for approval. */
function Sign() {
  return (
    <group position={[0.42, 1.0, 0.1]} rotation={[0, 0, -0.08]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
        <Alu />
      </mesh>
      <RoundedBox args={[0.42, 0.34, 0.04]} radius={0.04} position={[0, 0.78, 0]} castShadow>
        <Glow color="#ff5a1f" intensity={1.2} />
      </RoundedBox>
      <mesh position={[0, 0.82, 0.025]}>
        <boxGeometry args={[0.05, 0.15, 0.01]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      <mesh position={[0, 0.69, 0.025]}>
        <boxGeometry args={[0.05, 0.05, 0.01]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
    </group>
  )
}

export function Agent({ agent }: { agent: AgentState }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const selected = useStore((s) => s.selectedAgentId === agent.id)
  const select = useStore((s) => s.select)
  const a = agent.activity

  useFrame((state, dt) => {
    const p = runtime.poses[agent.id]
    const g = root.current
    if (!g || !body.current) return
    const t = state.clock.elapsedTime + agent.id.length
    g.position.x = p.x
    g.position.z = p.z
    // smooth turn
    let dh = p.heading - g.rotation.y
    dh = Math.atan2(Math.sin(dh), Math.cos(dh))
    g.rotation.y += dh * Math.min(1, dt * 10)

    let y = 0
    let tilt = 0
    let swing = 0
    let spin = 0
    if (a === 'walking') {
      y = Math.abs(Math.sin(t * 11)) * 0.12
      tilt = 0.12
      swing = Math.sin(t * 11) * 0.7
    } else if (a === 'working') {
      y = Math.abs(Math.sin(t * 5)) * 0.04
      swing = Math.sin(t * 14) * 0.25
      tilt = 0.08
    } else if (a === 'waiting') {
      y = Math.sin(t * 2.5) * 0.02
    } else if (a === 'blocked') {
      tilt = Math.sin(t * 1.5) * 0.12
    } else if (a === 'celebrating') {
      const c = Math.max(0, runtime.celebrate[agent.id] ?? 0)
      y = Math.abs(Math.sin(c * 7)) * 0.45
      spin = (1.4 - c) * Math.PI * 1.45
      swing = 1.8
    } else {
      y = Math.sin(t * 1.6) * 0.015 // breathing
    }
    body.current.position.y = y
    body.current.rotation.x = tilt
    body.current.rotation.y = spin
    const sq = 1 + Math.sin(t * 1.6) * 0.012
    body.current.scale.set(1 / sq, sq, 1 / sq)
    if (armL.current && armR.current) {
      armL.current.rotation.x = swing
      armR.current.rotation.x = a === 'waiting' ? -2.4 : -swing
      armL.current.rotation.z = a === 'celebrating' ? 2.4 : 0.2
      armR.current.rotation.z = a === 'celebrating' ? -2.4 : -0.2
    }
    // blink
    if (eyes.current) eyes.current.scale.y = Math.sin(t * 0.9) > 0.995 ? 0.1 : 1
  })

  return (
    <group
      ref={root}
      scale={1.3}
      onClick={(e) => {
        e.stopPropagation()
        select(selected ? null : agent.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      {/* selection ring */}
      {(selected || hover) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.48, 0.56, 48]} />
          <meshBasicMaterial color={selected ? '#ff5a1f' : '#ffffff'} transparent opacity={selected ? 1 : 0.7} toneMapped={false} />
        </mesh>
      )}
      <group ref={body}>
        {/* feet */}
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} position={[x, 0.07, 0.04]} scale={[1, 0.7, 1.3]} castShadow>
            <sphereGeometry args={[0.1, 20, 12]} />
            <Vinyl color={agent.accent} />
          </mesh>
        ))}
        {/* body */}
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.27, 0.26, 12, 32]} />
          <Vinyl color={agent.color} />
        </mesh>
        {/* arms */}
        <group ref={armL} position={[-0.29, 0.6, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.16, 8, 16]} />
            <Vinyl color={agent.color} />
          </mesh>
        </group>
        <group ref={armR} position={[0.29, 0.6, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.16, 8, 16]} />
            <Vinyl color={agent.color} />
          </mesh>
        </group>
        {/* head */}
        <mesh position={[0, 1.06, 0]} scale={[1, 0.9, 0.95]} castShadow>
          <sphereGeometry args={[0.38, 48, 32]} />
          <Vinyl color={agent.color} />
        </mesh>
        {/* face */}
        <group ref={eyes} position={[0, 1.08, 0.33]}>
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshPhysicalMaterial color={INK} roughness={0.15} clearcoat={1} />
            </mesh>
          ))}
        </group>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0.98, 0.29]} scale={[1, 0.6, 0.4]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial color="#ff9b8a" roughness={0.9} transparent opacity={0.55} />
          </mesh>
        ))}
        <Prop agent={agent} />
        {a === 'waiting' && <Sign />}
      </group>

      <Html position={[0, 1.75, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`bubble bubble--${a} ${selected ? 'is-selected' : ''}`}>
          <span className="bubble__name">{agent.name}</span>
          {agent.bubble && a !== 'walking' && <span className="bubble__text">{agent.bubble}</span>}
        </div>
      </Html>
    </group>
  )
}
