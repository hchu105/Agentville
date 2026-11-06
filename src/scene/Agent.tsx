import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { runtime, useStore } from '../sim/store'
import type { Activity, AgentState } from '../sim/types'
import { StatusPin } from '../ui/StatusPin'
import { CAM_TARGET, toView, VIEW_QUAT } from './view'
import { assetUrl, CLIPS, manifest, prepare, residentOrder } from './world'
import { pan } from './pan'

const S = manifest.sprites
const SEATED = new Set(['sit', 'lounge', 'sit_work'])

/** Which clip plays: what they're doing, refined by where they are. */
function clipOf(a: Activity, p: (typeof runtime.poses)[string]) {
  if (p.path.length) return 'walk'
  if (p.wave > 0) return 'wave'
  if (a === 'waiting' || a === 'blocked' || a === 'celebrating') return a
  if (a === 'working') return p.pose ?? 'working'
  return p.pose ?? 'idle'
}
const TAU = Math.PI * 2
const ORANGE = new THREE.Color('#ff5a1f')
const WHITE = new THREE.Color('#ffffff')

export function Agent({ agent }: { agent: AgentState }) {
  const sprite = useRef<THREE.Group>(null)
  const ground = useRef<THREE.Group>(null)
  const plane = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const heading = useRef(0)
  const pinAt = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const selected = useStore((s) => s.selectedAgentId === agent.id)
  const select = useStore((s) => s.select)
  const speed = useStore((s) => s.speed)
  const a = agent.activity

  const tex = useTexture(assetUrl(S.sheets[agent.id as keyof typeof S.sheets]), (t) => {
    prepare(t)
    t.repeat.set(1 / S.cols, 1 / S.rows)
    // Mipmaps bleed neighbouring frames together in an atlas.
    t.generateMipmaps = false
    t.minFilter = THREE.LinearFilter
    t.needsUpdate = true
  })

  useFrame((state, dt) => {
    const p = runtime.poses[agent.id]
    if (!sprite.current || !ground.current) return
    // Smooth turning, as before, then snap to the nearest rendered direction.
    let dh = p.heading - heading.current
    dh = Math.atan2(Math.sin(dh), Math.cos(dh))
    heading.current += dh * Math.min(1, dt * 10)

    const name = clipOf(a, p)
    const clip = CLIPS[name]
    let h = heading.current - clip.offset
    if (a === 'celebrating') h += ((1.4 - Math.max(0, runtime.celebrate[agent.id] ?? 0)) / 1.4) * TAU
    const dir = ((Math.round((h / TAU) * clip.dirs) % clip.dirs) + clip.dirs) % clip.dirs
    const t = state.clock.elapsedTime * (name === 'walk' ? speed * p.speed : 1)
    const frame = Math.floor(t * clip.fps) % clip.frames
    const cell = clip.start + dir * clip.frames + frame
    tex.offset.set((cell % S.cols) / S.cols, 1 - (Math.floor(cell / S.cols) + 1) / S.rows)

    // Feet land on the sim position; the anchor says where feet sit in the cell.
    // Seated clips sit on a standard seat; lower or raise them to the real one.
    const lift = SEATED.has(name) ? (p.place?.seat ?? S.seat) - S.seat : 0
    const { u, v } = toView(p.x, lift, p.z)
    if (pinAt.current) pinAt.current.position.y = (a === 'waiting' ? 2.6 : 1.95) + lift
    sprite.current.position.set(u - (S.anchor[0] - 0.5) * S.world, v - (S.anchor[1] - 0.5) * S.world, 0)
    const order = residentOrder(p.x, p.z)
    if (plane.current) plane.current.renderOrder = order
    if (ring.current) ring.current.renderOrder = order - 0.1
    ground.current.position.set(p.x, 0, p.z)
  })

  return (
    <>
      <group ref={ground}>
        {(selected || hover) && (
          <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.42, 0.5, 48]} />
            <meshBasicMaterial color={selected ? ORANGE : WHITE} transparent opacity={selected ? 1 : 0.8} depthTest={false} toneMapped={false} />
          </mesh>
        )}
        {/* a body-sized hit area: the sprite cell itself is mostly empty */}
        <mesh
          position={[0, 0.8, 0]}
          onClick={(e) => {
            e.stopPropagation()
            if (pan.moved) return
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
          <cylinderGeometry args={[0.42, 0.42, 1.6, 12]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        <group ref={pinAt}>
        <Html zIndexRange={selected ? [30, 0] : [20, 0]} style={{ pointerEvents: 'none' }}>
          <StatusPin agent={agent} selected={selected} hover={hover} onToggle={() => select(selected ? null : agent.id)} />
        </Html>
        </group>
      </group>
      <group position={CAM_TARGET} quaternion={VIEW_QUAT}>
        <group ref={sprite}>
          <mesh ref={plane}>
            <planeGeometry args={[S.world, S.world]} />
            <meshBasicMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </>
  )
}
