import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { BUILDINGS } from '../sim/data'
import { runtime, useStore } from '../sim/store'
import type { AgentState, Look, Pose } from '../sim/types'
import { useShallow } from 'zustand/react/shallow'
import { Fabric, Hair, Plain, Skin } from './materials'

const CHIP_STATE: Record<AgentState['activity'], string> = {
  idle: 'Free',
  walking: 'On the way',
  working: 'Working',
  waiting: 'Needs you',
  blocked: 'Stuck',
  celebrating: 'Done',
}

// Proportions in metres-ish units. Legs 0.42 + 0.42 + foot ≈ 0.92 hip height.
const HIP = 0.92
const THIGH = 0.42
const SHIN = 0.42

type Limb = [number, number, number] // shoulder pitch, shoulder out, elbow
interface Joints {
  hip: number
  lean: number
  head: number
  legL: [number, number]
  legR: [number, number]
  armL: Limb
  armR: Limb
}

const STAND: Joints = { hip: HIP, lean: 0, head: 0, legL: [0, 0], legR: [0, 0], armL: [0.05, 0.1, -0.15], armR: [0.05, 0.1, -0.15] }

function target(pose: Pose, seat: number, t: number): Joints {
  const sitH = seat + 0.07
  switch (pose) {
    case 'walk': {
      const ph = t * 7.2
      const s = Math.sin(ph)
      return {
        hip: HIP - 0.015 + Math.abs(Math.cos(ph)) * 0.03,
        lean: 0.06,
        head: 0,
        legL: [s * 0.5, Math.max(0, Math.sin(ph + 1.9)) * 0.75],
        legR: [-s * 0.5, Math.max(0, Math.sin(ph + 1.9 + Math.PI)) * 0.75],
        armL: [-s * 0.42, 0.08, -0.3],
        armR: [s * 0.42, 0.08, -0.3],
      }
    }
    case 'lounge':
      return { hip: sitH, lean: -0.4, head: 0.22, legL: [-1.35, 1.2], legR: [-1.5, 1.45], armL: [-0.1, 0.4, -0.5], armR: [-0.35, 0.1, -0.9] }
    case 'sit':
      return { hip: sitH, lean: 0.02, head: 0.12 + Math.sin(t * 0.6) * 0.06, legL: [-1.5, 1.45], legR: [-1.5, 1.55], armL: [-0.55, -0.12, -0.8], armR: [-0.6, -0.1, -0.95] }
    case 'browse': {
      // flipping through records or reading a menu: head down, hands forward
      const f = Math.sin(t * 1.1) * 0.12
      return { hip: HIP, lean: 0.12, head: 0.42, legL: [0.06, 0.04], legR: [-0.04, 0.12], armL: [-0.95 + f, -0.1, -0.7], armR: [-0.85, -0.12, -0.9 - f] }
    }
    case 'sip': {
      // coffee in hand, lifting it now and then
      const lift = Math.max(0, Math.sin(t * 0.45)) ** 6
      return { hip: HIP, lean: -0.02, head: -0.05 - lift * 0.15, legL: [0.05, 0.05], legR: [-0.08, 0.15], armL: [0.05, 0.1, -0.2], armR: [-0.55 - lift * 0.5, -0.25, -1.5 - lift * 0.6] }
    }
    case 'type': {
      const j = Math.sin(t * 16) * 0.06
      return { hip: sitH, lean: 0.1, head: 0.3, legL: [-1.5, 1.5], legR: [-1.5, 1.5], armL: [-0.85 + j, -0.12, -0.75], armR: [-0.85 - j, -0.12, -0.75] }
    }
    case 'read':
      return { hip: sitH, lean: -0.22, head: 0.4, legL: [-1.4, 1.3], legR: [-1.4, 1.3], armL: [-0.55, -0.2, -1.55], armR: [-0.55, -0.2, -1.55] }
    case 'operate': {
      const w = Math.sin(t * 1.3) * 0.05
      return { hip: HIP, lean: 0.14, head: 0.12 + w, legL: [0.12, 0.1], legR: [-0.12, 0.08], armL: [-1.05, -0.14, -0.7], armR: [-1.05 + w, -0.14, -0.7] }
    }
    case 'counter': {
      const s = Math.sin(t * 3.2) * 0.18
      return { hip: HIP - 0.01, lean: 0.24, head: 0.35, legL: [0.08, 0.06], legR: [-0.08, 0.06], armL: [-0.8 + s, -0.08, -0.6], armR: [-0.8 - s, -0.08, -0.6] }
    }
    case 'present':
      return { hip: HIP, lean: 0, head: 0.05 + Math.sin(t * 1.6) * 0.03, legL: [0, 0], legR: [0, 0], armL: [-0.75, -0.22, -1.0], armR: [-0.75, -0.22, -1.0] }
    case 'scratch': {
      const s = Math.sin(t * 9) * 0.08
      return { hip: HIP, lean: 0.02, head: -0.12, legL: [0, 0], legR: [0.05, 0.05], armL: [0.05, 0.12, -0.15], armR: [-2.55 + s, 0.25, -2.0] }
    }
    case 'cheer':
      return { hip: HIP, lean: -0.05, head: -0.2, legL: [0, 0], legR: [0, 0], armL: [-0.2, 2.5, -0.25], armR: [-0.2, 2.5, -0.25] }
    default:
      return { ...STAND, head: Math.sin(t * 0.7) * 0.04 }
  }
}

function HairPiece({ look }: { look: Look }) {
  const curls = useMemo(() => {
    // deterministic curls over the crown and back
    const out: [number, number, number, number][] = []
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 * 2.618
      const up = 0.15 + ((i * 37) % 22) / 22 * 0.85
      const r = 0.122
      const y = Math.cos(up * 1.5) * r
      const rr = Math.sin(up * 1.5) * r
      out.push([Math.cos(a) * rr, y + 0.01, Math.sin(a) * rr - 0.015, 0.046 + ((i * 13) % 5) * 0.005])
    }
    return out.filter(([, , z, ]) => z < 0.07)
  }, [])
  const cap = (
    <mesh rotation={[-0.45, 0, 0]} castShadow>
      <sphereGeometry args={[0.127, 32, 16, 0, Math.PI * 2, 0, 1.75]} />
      <Hair color={look.hair} />
    </mesh>
  )
  switch (look.hairStyle) {
    case 'curly':
      return (
        <group>
          {cap}
          {curls.map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} castShadow>
              <sphereGeometry args={[r, 12, 10]} />
              <Hair color={look.hair} />
            </mesh>
          ))}
        </group>
      )
    case 'bun':
      return (
        <group>
          {cap}
          <mesh position={[0, 0.1, -0.1]} castShadow>
            <sphereGeometry args={[0.062, 20, 16]} />
            <Hair color={look.hair} />
          </mesh>
        </group>
      )
    case 'long':
      return (
        <group>
          {cap}
          <RoundedBox args={[0.25, 0.34, 0.09]} radius={0.04} position={[0, -0.1, -0.075]} castShadow>
            <Hair color={look.hair} />
          </RoundedBox>
        </group>
      )
    case 'beanie':
      return (
        <group>
          {cap}
          <mesh position={[0, 0.012, -0.004]} rotation={[-0.3, 0, 0]} castShadow>
            <sphereGeometry args={[0.134, 32, 16, 0, Math.PI * 2, 0, 1.4]} />
            <Fabric color={look.hat ?? '#333'} repeat={2} />
          </mesh>
          <mesh position={[0, 0.035, -0.01]} rotation={[Math.PI / 2 - 0.3, 0, 0]}>
            <torusGeometry args={[0.128, 0.022, 10, 32]} />
            <Fabric color={look.hat ?? '#333'} repeat={2} />
          </mesh>
        </group>
      )
    default:
      return cap
  }
}

function Glasses() {
  return (
    <group position={[0, 0.005, 0.112]}>
      {[-0.042, 0.042].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <torusGeometry args={[0.026, 0.0055, 8, 24]} />
          <Plain color="#1d1c1a" rough={0.3} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[0.03, 0.006, 0.006]} />
        <Plain color="#1d1c1a" rough={0.3} />
      </mesh>
    </group>
  )
}

const torsoGeo = (() => {
  const pts = [
    [0.0, -0.05],
    [0.15, -0.05],
    [0.165, 0.06],
    [0.152, 0.2],
    [0.17, 0.34],
    [0.19, 0.43],
    [0.15, 0.5],
    [0.06, 0.535],
    [0.0, 0.54],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(pts, 28)
  g.scale(1, 1, 0.64)
  return g
})()

export function Person({ agent }: { agent: AgentState }) {
  const look = agent.look
  const root = useRef<THREE.Group>(null)
  const hips = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const kneeL = useRef<THREE.Group>(null)
  const kneeR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const elbowL = useRef<THREE.Group>(null)
  const elbowR = useRef<THREE.Group>(null)
  const cur = useRef<Joints>({ ...STAND, legL: [0, 0], legR: [0, 0], armL: [...STAND.armL], armR: [...STAND.armR] })
  const [hover, setHover] = useState(false)
  const selected = useStore((s) => s.selectedAgentId === agent.id)
  const select = useStore((s) => s.select)
  const a = agent.activity
  const task = useStore(
    useShallow((s) => {
      const ag = s.agents[agent.id]
      const t = ag.taskId ? s.tasks[ag.taskId] : null
      if (!t) return null
      const st = t.steps[t.stepIndex]
      return {
        title: t.title,
        step: Math.max(0, t.stepIndex),
        total: t.steps.length,
        building: st && (st.kind === 'tool' || st.kind === 'hiccup') ? st.building : null,
      }
    }),
  )
  const station = BUILDINGS.find((b) => b.id === task?.building)
  const sleeve = look.sleeves === 'long' ? look.top : look.skin
  // Pose is decided every frame from the runtime (moving, sitting where), but
  // mirrored into React state so held props and the chip height can follow it.
  const [pose, setPose] = useState<Pose>('lounge')
  const poseRef = useRef<Pose>('lounge')
  const seatRef = useRef(0.44)
  const wave = useRef(0)
  const glanceUp = useRef(0)
  const wasSelected = useRef(false)
  const camDir = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const p = runtime.poses[agent.id]
    const g = root.current
    if (!g || !hips.current || !torso.current) return
    const t = state.clock.elapsedTime + agent.id.length * 1.7
    const act = useStore.getState().agents[agent.id].activity

    // what am I doing right now?
    let ps: Pose
    let seat = 0.45
    const moving = p.path.length > 0
    if (moving) ps = 'walk'
    else if (act === 'idle' && p.leisure) {
      ps = p.leisure.pose
      seat = p.leisure.seat ?? 0.45
    } else if (act === 'working') {
      ps = station?.work.pose ?? 'stand'
      seat = station?.work.seat ?? 0.45
    } else if (act === 'waiting') ps = 'present'
    else if (act === 'blocked') ps = 'scratch'
    else if (act === 'celebrating') ps = 'cheer'
    else ps = 'stand'
    seatRef.current = seat
    if (ps !== poseRef.current) {
      poseRef.current = ps
      setPose(ps)
    }
    const seated = ps === 'lounge' || ps === 'sit' || ps === 'type' || ps === 'read'

    // Selected: look up and wave. Work never stops for it: a busy agent gives you
    // a moment of attention and goes back to it; a free (or waiting) one stays with you.
    if (selected && !wasSelected.current) {
      wave.current = 1.8
      glanceUp.current = 2.6
    }
    wasSelected.current = selected
    if (wave.current > 0) wave.current -= dt
    if (glanceUp.current > 0) glanceUp.current -= dt
    const attention = selected && (act === 'idle' || act === 'waiting' || glanceUp.current > 0)
    const facing = attention && !seated && !moving
    state.camera.getWorldDirection(camDir)
    const toViewer = Math.atan2(-camDir.x, -camDir.z)

    g.position.x = p.x
    g.position.z = p.z
    const want = facing ? toViewer : p.heading
    let dh = want - g.rotation.y
    dh = Math.atan2(Math.sin(dh), Math.cos(dh))
    g.rotation.y += dh * Math.min(1, dt * (facing ? 6 : 9))

    const tg = target(facing ? 'stand' : ps, seat, t)
    if (attention) tg.head = -0.28 // look up at the viewer
    if (selected) {
      if (facing) {
        tg.lean = 0
        tg.legL = [0, 0]
        tg.legR = [0, 0]
        tg.armL = [0.05, 0.12, -0.2]
        tg.armR = [0.05, 0.12, -0.2]
      }
      if (wave.current > 0) tg.armR = [-0.15, 2.55 + Math.sin(t * 14) * 0.28, -0.35]
    }
    const k = ps === 'walk' && wave.current <= 0 ? 1 : 1 - Math.exp(-dt * 8)
    const c = cur.current
    const mix = (x: number, y: number) => x + (y - x) * k
    c.hip = mix(c.hip, tg.hip)
    c.lean = mix(c.lean, tg.lean)
    c.head = mix(c.head, tg.head)
    for (const key of ['legL', 'legR'] as const) for (let i = 0; i < 2; i++) c[key][i] = mix(c[key][i], tg[key][i])
    for (const key of ['armL', 'armR'] as const) for (let i = 0; i < 3; i++) c[key][i] = mix(c[key][i], tg[key][i])

    let hop = 0
    if (ps === 'cheer') hop = Math.abs(Math.sin(Math.max(0, runtime.celebrate[agent.id] ?? 0) * 7)) * 0.18
    hips.current.position.y = c.hip + hop
    // idle life: a little weight shift and sway when standing still
    const still = !seated && ps !== 'walk'
    hips.current.position.x = still ? Math.sin(t * 0.55) * 0.018 : 0
    torso.current.rotation.z = still ? Math.sin(t * 0.55) * -0.025 : 0
    torso.current.rotation.x = c.lean
    if (head.current) {
      head.current.rotation.order = 'YXZ'
      head.current.rotation.x = c.head - c.lean * 0.5
      // glance around now and then; when selected, find the viewer
      const glance = Math.sin(t * 0.31) * 0.35 + Math.sin(t * 0.83) * 0.12
      let yaw = ps === 'walk' ? 0 : glance * (seated || still ? 1 : 0.3)
      if (attention) {
        let rel = toViewer - g.rotation.y
        rel = Math.atan2(Math.sin(rel), Math.cos(rel))
        yaw = Math.max(-1.2, Math.min(1.2, rel))
      }
      head.current.rotation.y += (yaw - head.current.rotation.y) * Math.min(1, dt * 5)
    }
    legL.current!.rotation.x = c.legL[0]
    kneeL.current!.rotation.x = c.legL[1]
    legR.current!.rotation.x = c.legR[0]
    kneeR.current!.rotation.x = c.legR[1]
    armL.current!.rotation.set(c.armL[0], 0, -c.armL[1])
    armR.current!.rotation.set(c.armR[0], 0, c.armR[1])
    elbowL.current!.rotation.x = c.armL[2]
    elbowR.current!.rotation.x = c.armR[2]
    torso.current.scale.y = 1 + Math.sin(t * 1.8) * 0.008
  })

  const leg = (side: 1 | -1, hipRef: React.RefObject<THREE.Group | null>, kneeRef: React.RefObject<THREE.Group | null>) => (
    <group ref={hipRef} position={[side * 0.088, 0, 0]}>
      <mesh position={[0, -THIGH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.083, 0.07, THIGH + 0.04, 16]} />
        <Fabric color={look.bottom} />
      </mesh>
      <group ref={kneeRef} position={[0, -THIGH, 0]}>
        <mesh position={[0, -SHIN / 2 + 0.03, 0]} castShadow>
          <cylinderGeometry args={[0.068, look.hairStyle === 'long' ? 0.08 : 0.064, SHIN - 0.02, 16]} />
          <Fabric color={look.bottom} />
        </mesh>
        <RoundedBox args={[0.1, 0.075, 0.24]} radius={0.035} position={[0, -SHIN - 0.03, 0.045]} castShadow>
          <Plain color={look.shoes} rough={0.6} />
        </RoundedBox>
      </group>
    </group>
  )

  const arm = (side: 1 | -1, shoulderRef: React.RefObject<THREE.Group | null>, elbowRef: React.RefObject<THREE.Group | null>, held?: React.ReactNode) => (
    <group ref={shoulderRef} position={[side * 0.205, 0.45, 0]}>
      <mesh position={[0, -0.125, 0]} castShadow>
        <capsuleGeometry args={[0.052, 0.17, 6, 14]} />
        <Fabric color={look.top} />
      </mesh>
      <group ref={elbowRef} position={[0, -0.27, 0]}>
        <mesh position={[0, -0.11, 0]} castShadow>
          <capsuleGeometry args={[0.044, 0.16, 6, 14]} />
          {look.sleeves === 'long' ? <Fabric color={sleeve} /> : <Skin color={look.skin} />}
        </mesh>
        <mesh position={[0, -0.255, 0.005]} scale={[0.85, 1.15, 0.7]} castShadow>
          <sphereGeometry args={[0.046, 14, 12]} />
          <Skin color={look.skin} />
        </mesh>
        {held}
      </group>
    </group>
  )

  // What's in hand depends on what they're doing.
  const heldL =
    pose === 'present' ? (
      <group position={[0.1, -0.3, 0.08]} rotation={[-0.6, 0, 0]}>
        <RoundedBox args={[0.26, 0.32, 0.018]} radius={0.006} castShadow>
          <meshStandardMaterial color="#ff5a1f" emissive="#ff5a1f" emissiveIntensity={0.35} roughness={0.5} />
        </RoundedBox>
      </group>
    ) : pose === 'read' ? (
      <group position={[0.1, -0.3, 0.05]} rotation={[-0.9, 0, 0]}>
        <RoundedBox args={[0.24, 0.17, 0.03]} radius={0.006} castShadow>
          <Plain color="#f4efe4" />
        </RoundedBox>
      </group>
    ) : look.prop === 'notebook' && (pose === 'stand' || pose === 'walk' || pose === 'lounge') ? (
      <RoundedBox args={[0.035, 0.2, 0.15]} radius={0.008} position={[0.03, -0.27, 0.02]} castShadow>
        <Plain color={look.propColor} rough={0.5} />
      </RoundedBox>
    ) : null

  return (
    <group
      ref={root}
      scale={look.height}
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
      {(selected || hover) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[0.42, 0.47, 48]} />
          <meshBasicMaterial color={selected ? '#ff5a1f' : '#9a948a'} transparent opacity={selected ? 1 : 0.6} toneMapped={false} />
        </mesh>
      )}
      {/* invisible hit target so people are easy to click */}
      <mesh position={[0, 0.9, 0]} visible={false}>
        <cylinderGeometry args={[0.3, 0.3, 1.8, 8]} />
        <meshBasicMaterial />
      </mesh>

      <group ref={hips} position={[0, HIP, 0]}>
        {/* pelvis */}
        <RoundedBox args={[0.32, 0.17, 0.2]} radius={0.07} position={[0, 0.0, 0]} castShadow>
          <Fabric color={look.bottom} />
        </RoundedBox>
        {leg(-1, legL, kneeL)}
        {leg(1, legR, kneeR)}

        <group ref={torso}>
          <mesh geometry={torsoGeo} castShadow receiveShadow>
            <Fabric color={look.top} />
          </mesh>

          {/* signature props */}
          {look.prop === 'camera' && (
            <group position={[0, 0.3, 0.13]}>
              <RoundedBox args={[0.15, 0.095, 0.07]} radius={0.015} castShadow>
                <Plain color={look.propColor} rough={0.4} />
              </RoundedBox>
              <mesh position={[0.02, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.032, 0.035, 0.05, 20]} />
                <meshPhysicalMaterial color="#2a2a2a" roughness={0.25} clearcoat={1} />
              </mesh>
              <mesh position={[0, 0.12, -0.04]} rotation={[0.3, 0, 0]}>
                <torusGeometry args={[0.15, 0.007, 6, 24, Math.PI]} />
                <Plain color="#222" />
              </mesh>
            </group>
          )}
          {look.prop === 'backpack' && (
            <group position={[0, 0.27, -0.14]}>
              <RoundedBox args={[0.27, 0.33, 0.14]} radius={0.05} castShadow>
                <Fabric color={look.propColor} />
              </RoundedBox>
              <RoundedBox args={[0.18, 0.1, 0.03]} radius={0.015} position={[0, -0.07, -0.075]}>
                <Fabric color={look.propColor} />
              </RoundedBox>
            </group>
          )}
          {look.prop === 'tote' && pose !== 'lounge' && (
            <group position={[0.2, 0.16, 0.02]} rotation={[0, 0, 0.08]}>
              <RoundedBox args={[0.05, 0.3, 0.26]} radius={0.015} castShadow>
                <Fabric color={look.propColor} repeat={2} />
              </RoundedBox>
              <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.1, 0.008, 6, 20, Math.PI]} />
                <Fabric color={look.propColor} />
              </mesh>
            </group>
          )}

          {/* neck + head */}
          <group position={[0, 0.52, 0]}>
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.046, 0.05, 0.1, 14]} />
              <Skin color={look.skin} />
            </mesh>
            <group ref={head} position={[0, 0.17, 0]}>
              <mesh scale={[0.92, 1.06, 1]} castShadow>
                <sphereGeometry args={[0.118, 32, 24]} />
                <Skin color={look.skin} />
              </mesh>
              <mesh position={[0, -0.005, 0.113]} scale={[0.8, 1, 1]}>
                <sphereGeometry args={[0.022, 12, 10]} />
                <Skin color={look.skin} />
              </mesh>
              {[-1, 1].map((sd) => (
                <mesh key={sd} position={[sd * 0.108, 0, -0.005]} scale={[0.5, 1, 0.8]}>
                  <sphereGeometry args={[0.03, 12, 10]} />
                  <Skin color={look.skin} />
                </mesh>
              ))}
              <HairPiece look={look} />
              {look.glasses && <Glasses />}
            </group>
          </group>

          {arm(-1, armL, elbowL, heldL)}
          {arm(
            1,
            armR,
            elbowR,
            pose === 'sip' ? (
              <mesh position={[-0.03, -0.27, 0.05]} castShadow>
                <cylinderGeometry args={[0.04, 0.035, 0.09, 16]} />
                <meshPhysicalMaterial color="#EDE3D1" roughness={0.25} clearcoat={1} />
              </mesh>
            ) : null,
          )}
        </group>
      </group>

      <Html position={[0, pose === 'lounge' || pose === 'sit' || pose === 'type' || pose === 'read' ? 1.62 : 2.0, 0]} center zIndexRange={[20, 0]}>
        <button
          type="button"
          className={`chip3d chip3d--${a} ${selected ? 'is-selected' : ''} ${hover ? 'is-hover' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            select(selected ? null : agent.id)
          }}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          aria-label={`${agent.name}: ${CHIP_STATE[a]}${task ? `, ${task.title}` : ''}`}
        >
          <span className="chip3d__row">
            <span className="chip3d__dot" />
            <span className="chip3d__name">{agent.name}</span>
            <span className="chip3d__state">{CHIP_STATE[a]}</span>
          </span>
          {task && (
            <>
              <span className="chip3d__task">{task.title}</span>
              <span className="chip3d__bar">
                <i style={{ width: `${Math.round((task.step / task.total) * 100)}%` }} />
              </span>
            </>
          )}
          {selected && agent.bubble && <span className="chip3d__more">{agent.bubble}</span>}
        </button>
      </Html>
    </group>
  )
}
