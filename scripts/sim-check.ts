// Runs the village headless and fails if anyone walks through a person or furniture.
// npm run check:sim
import { JOBS } from '../src/sim/data'
import { RADIUS, walkable } from '../src/sim/nav'
import { runtime, useStore } from '../src/sim/store'

const FRAME = 1 / 60
const SIM_SECONDS = 2400
const s = () => useStore.getState()
useStore.setState({ speed: 4 })
for (const j of [...JOBS]) s().dispatch(j.id)

let closest = Infinity
let offFloor = 0
let waited = 0
let longestStill = 0
const still: Record<string, number> = {}
const last: Record<string, { x: number; z: number }> = {}
const ids = Object.keys(runtime.poses)

let frames = 0
while (s().clock < SIM_SECONDS) {
  s()._tick(FRAME)
  frames++
  for (const t of Object.values(s().tasks)) {
    if (t.status === 'waiting') {
      s().approve(t.id)
      waited++
    }
  }
  // Keep work coming, so crossings keep happening.
  if (frames % 600 === 0) {
    const a = ids[frames % 4]
    s().addCustom(`Check ${a}`)
    const job = s().board[0]
    if (job) s().dispatch(job.id, a)
  }
  for (let i = 0; i < ids.length; i++) {
    const p = runtime.poses[ids[i]]
    if (!walkable(p.x, p.z)) offFloor++
    for (let k = i + 1; k < ids.length; k++) {
      const q = runtime.poses[ids[k]]
      closest = Math.min(closest, Math.hypot(p.x - q.x, p.z - q.z))
    }
    if (p.path.length) {
      const l = last[ids[i]] ?? p
      const moved = Math.hypot(p.x - l.x, p.z - l.z)
      still[ids[i]] = moved < 1e-3 ? (still[ids[i]] ?? 0) + FRAME * 4 : 0
      longestStill = Math.max(longestStill, still[ids[i]])
    }
    last[ids[i]] = { x: p.x, z: p.z }
  }
}
const tasks = Object.values(s().tasks)
const done = tasks.filter((t) => t.status === 'done').length
console.log({ simSeconds: Math.round(s().clock), tasks: tasks.length, done, waited, closest: +closest.toFixed(3), offFloor, longestStill: +longestStill.toFixed(2) })
const fail = closest < RADIUS * 2 - 0.08 || offFloor > 0 || longestStill > 4 || done < tasks.length - 4
if (fail) {
  console.error('FAILED')
  process.exit(1)
}
