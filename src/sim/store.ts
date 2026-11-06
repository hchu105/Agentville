import { create } from 'zustand'
import { AGENTS, BUILDINGS, JOBS, planCustomJob } from './data'
import { clearLine, findPath, nearestWalkable, RADIUS, walkable, type Pt } from './nav'
import type { AgentEvent, AgentState, Autonomy, BuildingId, EventType, JobTemplate, Task } from './types'

export type View = 'village' | 'ledger'

export interface Toast {
  id: number
  agentId: string
  title: string
  body: string
}

interface State {
  clock: number // sim seconds since start
  speed: 1 | 2 | 4
  view: View
  muted: boolean
  agents: Record<string, AgentState>
  tasks: Record<string, Task>
  board: JobTemplate[]
  events: AgentEvent[]
  receipts: string[] // task ids, newest first
  unread: number
  spent: number
  selectedAgentId: string | null
  openTaskId: string | null
  approvalTaskId: string | null
  toast: Toast | null
  customCount: number

  select: (id: string | null) => void
  setView: (v: View) => void
  setSpeed: (s: 1 | 2 | 4) => void
  toggleMute: () => void
  setAutonomy: (agentId: string, a: Autonomy) => void
  dispatch: (jobId: string, agentId?: string) => void
  addCustom: (text: string) => void
  approve: (taskId: string) => void
  sendBack: (taskId: string) => void
  openTask: (taskId: string | null) => void
  openApproval: (taskId: string | null) => void
  markRead: () => void
  dismissToast: () => void
  // internal, called by the engine
  _log: (agentId: string, type: EventType, text: string, extra?: Partial<AgentEvent>) => void
  _patchAgent: (id: string, patch: Partial<AgentState>) => void
  _patchTask: (id: string, patch: Partial<Task>) => void
  _tick: (dt: number) => void
}

let eventId = 0
let taskSeq = 0

const initialAgents = (): Record<string, AgentState> => {
  const start: Record<string, { autonomy: Autonomy; maxAutonomy: Autonomy; done: number; streak: number }> = {
    pip: { autonomy: 1, maxAutonomy: 2, done: 14, streak: 1 },
    juno: { autonomy: 2, maxAutonomy: 2, done: 22, streak: 0 },
    scout: { autonomy: 3, maxAutonomy: 3, done: 31, streak: 0 },
    bea: { autonomy: 1, maxAutonomy: 1, done: 6, streak: 1 },
  }
  return Object.fromEntries(
    AGENTS.map((a) => [a.id, { ...a, activity: 'idle', bubble: null, taskId: null, ...start[a.id] } as AgentState]),
  )
}

export const useStore = create<State>((set, get) => ({
  clock: 0,
  speed: 1,
  view: 'village',
  muted: true,
  agents: initialAgents(),
  tasks: {},
  board: JOBS,
  events: [],
  receipts: [],
  unread: 0,
  spent: 0,
  selectedAgentId: null,
  openTaskId: null,
  approvalTaskId: null,
  toast: null,
  customCount: 0,

  select: (id) => set({ selectedAgentId: id }),
  setView: (view) => set({ view }),
  setSpeed: (speed) => set({ speed }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setAutonomy: (agentId, a) => {
    const ag = get().agents[agentId]
    if (!ag || a > ag.maxAutonomy) return
    get()._patchAgent(agentId, { autonomy: a })
  },

  dispatch: (jobId, agentId) => {
    const job = get().board.find((j) => j.id === jobId)
    if (!job) return
    const id = `t${++taskSeq}`
    const who = agentId ?? job.agentId
    const task: Task = {
      id,
      title: job.title,
      agentId: who,
      steps: job.steps,
      stepIndex: -1,
      status: 'queued',
      createdAt: get().clock,
      deliverable: job.deliverable,
      cost: 0,
      revisions: 0,
    }
    set((s) => ({ tasks: { ...s.tasks, [id]: task }, board: s.board.filter((j) => j.id !== jobId) }))
    get()._log(who, 'assigned', `Picked up “${job.title}”`, { taskId: id })
  },

  addCustom: (text) => {
    if (!text.trim()) return
    const n = get().customCount + 1
    const job = planCustomJob(text, n)
    set((s) => ({ board: [job, ...s.board], customCount: n }))
  },

  approve: (taskId) => {
    const t = get().tasks[taskId]
    if (!t || t.status !== 'waiting') return
    const step = t.steps[t.stepIndex]
    const ag = get().agents[t.agentId]
    const streak = ag.streak + 1
    get()._log(t.agentId, 'approved', `Rae approved: ${step.kind === 'approval' ? step.label : ''}`, { taskId })
    let maxAutonomy = ag.maxAutonomy
    // Progression = trust. Two clean approvals in a row unlock the next autonomy level.
    if (streak >= 2 && ag.maxAutonomy < 3) {
      maxAutonomy = (ag.maxAutonomy + 1) as Autonomy
      const label = maxAutonomy === 2 ? 'can now do small things without asking' : 'can now work fully on its own'
      get()._log(t.agentId, 'level_up', `Earned autonomy level ${maxAutonomy}`, { taskId })
      set({
        toast: { id: Date.now(), agentId: ag.id, title: `${ag.name} earned more trust`, body: `${ag.name} ${label}. Turn the dial up when you're ready.` },
      })
    }
    get()._patchAgent(t.agentId, { streak: maxAutonomy !== ag.maxAutonomy ? 0 : streak, maxAutonomy })
    get()._patchTask(taskId, { status: 'active', stepIndex: t.stepIndex + 1 })
    runtime.begin(t.agentId)
    set({ approvalTaskId: null })
  },

  sendBack: (taskId) => {
    const t = get().tasks[taskId]
    if (!t || t.status !== 'waiting') return
    get()._log(t.agentId, 'sent_back', `Rae sent it back for another pass`, { taskId })
    get()._patchAgent(t.agentId, { streak: 0 })
    // redo the last tool step before the approval
    let back = t.stepIndex - 1
    while (back > 0 && t.steps[back].kind !== 'tool') back--
    get()._patchTask(taskId, { status: 'active', stepIndex: back, revisions: t.revisions + 1 })
    runtime.begin(t.agentId)
    set({ approvalTaskId: null })
  },

  openTask: (openTaskId) => set({ openTaskId }),
  openApproval: (approvalTaskId) => set({ approvalTaskId }),
  markRead: () => set({ unread: 0 }),
  dismissToast: () => set({ toast: null }),

  _log: (agentId, type, text, extra) =>
    set((s) => ({ events: [{ id: ++eventId, t: s.clock, agentId, type, text, ...extra }, ...s.events].slice(0, 300) })),
  _patchAgent: (id, patch) => set((s) => ({ agents: { ...s.agents, [id]: { ...s.agents[id], ...patch } } })),
  _patchTask: (id, patch) => set((s) => ({ tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...patch } } })),
  _tick: (dt) => runtime.tick(dt),
}))

// ───────────────────────── Runtime ─────────────────────────
// Positions change every frame, so they live outside React state.
// The scene reads them in useFrame; the store only hears about phase changes.

export interface Pose {
  x: number
  z: number
  heading: number
  path: Pt[]
  /** Where this resident is headed. Holding it keeps two people off one spot. */
  goal: Pt | null
  timer: number
  arrive: (() => void) | null
  stuck: number
  check: number
}

export const doorOf = (b: BuildingId) => BUILDINGS.find((x) => x.id === b)!.stop

const homeOf = (agentId: string) => {
  const i = AGENTS.findIndex((a) => a.id === agentId)
  const ang = (i / AGENTS.length) * Math.PI * 2 + Math.PI / 4
  return { x: Math.cos(ang) * 2.1, z: Math.sin(ang) * 2.1 }
}

const WALK_SPEED = 1.7
const SUBSTEP = 1 / 30
/** Closest two residents' centres may get: shoulder to shoulder. */
const PERSONAL = RADIUS * 2
/** Gap between people waiting at the same station. */
const QUEUE_GAP = 0.8
const LOOK_AHEAD = 1.5

export const runtime = {
  poses: Object.fromEntries(
    AGENTS.map((a) => {
      const h = homeOf(a.id)
      return [a.id, { x: h.x, z: h.z, heading: Math.atan2(-h.x, -h.z), path: [], goal: null, timer: 0, arrive: null, stuck: 0, check: 0 } as Pose]
    }),
  ) as Record<string, Pose>,
  celebrate: {} as Record<string, number>,

  /** People standing still, whom a walker must go around. */
  standing(except: string): Pt[] {
    return Object.entries(this.poses)
      .filter(([id, p]) => id !== except && !p.path.length)
      .map(([, p]) => p)
  },

  /** Where everyone else stands now or has claimed, so nobody picks the same spot. */
  claimed(except: string): Pt[] {
    return Object.entries(this.poses)
      .filter(([id]) => id !== except)
      .map(([, p]) => p.goal ?? p)
  },

  walk(agentId: string, to: Pt, arrive: () => void) {
    const p = this.poses[agentId]
    const spot = nearestWalkable(to, this.claimed(agentId), QUEUE_GAP)
    p.goal = spot
    p.path = findPath(p, spot, this.standing(agentId))
    p.arrive = arrive
    p.stuck = 0
    useStore.getState()._patchAgent(agentId, { activity: 'walking' })
  },

  face(agentId: string, b: BuildingId) {
    const p = this.poses[agentId]
    const d = BUILDINGS.find((x) => x.id === b)!
    p.heading = Math.atan2(d.x - p.x, d.z - p.z)
  },

  /** Start (or continue) the agent's current task at its stepIndex. */
  begin(agentId: string) {
    const s = useStore.getState()
    const ag = s.agents[agentId]
    const task = ag.taskId ? s.tasks[ag.taskId] : null
    if (!task) return
    const step = task.steps[task.stepIndex]
    if (!step) return
    const next = () => {
      const cur = useStore.getState().tasks[task.id]
      useStore.getState()._patchTask(task.id, { stepIndex: cur.stepIndex + 1 })
      this.begin(agentId)
    }
    const st = useStore.getState()
    if (step.kind === 'tool') {
      st._patchAgent(agentId, { bubble: null })
      this.walk(agentId, doorOf(step.building), () => {
        const g = useStore.getState()
        g._patchAgent(agentId, { activity: 'working', bubble: step.label })
        this.face(agentId, step.building)
        g._log(agentId, 'tool_start', step.label, { taskId: task.id, building: step.building })
        this.poses[agentId].timer = step.seconds
        this.poses[agentId].arrive = () => {
          const g2 = useStore.getState()
          g2._log(agentId, 'tool_end', `Finished: ${step.label}`, { taskId: task.id, building: step.building })
          useStore.setState((x) => ({ spent: x.spent + step.cost }))
          g2._patchTask(task.id, { cost: g2.tasks[task.id].cost + step.cost })
          next()
        }
      })
    } else if (step.kind === 'hiccup') {
      st._patchAgent(agentId, { activity: 'blocked', bubble: step.label })
      st._log(agentId, 'blocked', step.label, { taskId: task.id, building: step.building })
      this.poses[agentId].timer = step.seconds
      this.poses[agentId].arrive = next
    } else if (step.kind === 'approval') {
      const need = step.risk === 'high' ? ag.autonomy < 3 : ag.autonomy < 2
      if (!need) {
        st._log(agentId, 'auto_approved', `Did it without asking (autonomy ${ag.autonomy}): ${step.label}`, { taskId: task.id })
        next()
        return
      }
      this.walk(agentId, doorOf('desk'), () => {
        const g = useStore.getState()
        g._patchAgent(agentId, { activity: 'waiting', bubble: step.label })
        g._patchTask(task.id, { status: 'waiting' })
        g._log(agentId, 'needs_approval', `Needs your OK: ${step.label}`, { taskId: task.id })
        this.face(agentId, 'desk')
      })
    } else if (step.kind === 'deliver') {
      this.walk(agentId, doorOf('desk'), () => {
        const g = useStore.getState()
        g._patchTask(task.id, { status: 'done', finishedAt: g.clock })
        g._log(agentId, 'done', `Delivered “${task.title}”`, { taskId: task.id })
        useStore.setState((x) => ({ receipts: [task.id, ...x.receipts], unread: x.unread + 1 }))
        g._patchAgent(agentId, { activity: 'celebrating', bubble: null, taskId: null, done: g.agents[agentId].done + 1, doneAt: g.clock })
        this.celebrate[agentId] = 1.4
        this.poses[agentId].timer = 1.4
        this.poses[agentId].arrive = () => this.goHome(agentId)
      })
    }
  },

  goHome(agentId: string) {
    this.walk(agentId, homeOf(agentId), () => {
      useStore.getState()._patchAgent(agentId, { activity: 'idle', bubble: null })
      const p = this.poses[agentId]
      p.heading = Math.atan2(-p.x + 4, -p.z + 4) // face the camera-ish
    })
  },

  tick(rawDt: number) {
    const s = useStore.getState()
    const dt = Math.min(rawDt, 0.1) * s.speed
    useStore.setState({ clock: s.clock + dt })

    for (const id of Object.keys(this.poses)) {
      const p = this.poses[id]
      const ag = s.agents[id]

      // pick up queued work
      if (!ag.taskId && (ag.activity === 'idle' || (ag.activity === 'walking' && p.path.length && !p.timer))) {
        const queued = Object.values(s.tasks)
          .filter((t) => t.agentId === id && t.status === 'queued')
          .sort((a, b) => a.createdAt - b.createdAt)[0]
        if (queued) {
          s._patchTask(queued.id, { status: 'active', stepIndex: 0 })
          s._patchAgent(id, { taskId: queued.id })
          this.begin(id)
          continue
        }
      }

      if (!p.path.length && p.timer > 0) {
        p.timer -= dt
        if (p.timer <= 0) {
          p.timer = 0
          const cb = p.arrive
          p.arrive = null
          cb?.()
        }
      }
      if (this.celebrate[id] > 0) this.celebrate[id] -= dt
    }
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP))
    for (let i = 0; i < steps; i++) this.move(dt / steps)
  },

  /** One physics step: steer around people, stop at furniture, never overlap. */
  move(dt: number) {
    const ids = Object.keys(this.poses)
    const prev = new Map(ids.map((id) => [id, { x: this.poses[id].x, z: this.poses[id].z }]))

    for (const id of ids) {
      const p = this.poses[id]
      if (!p.path.length) continue
      const tgt = p.path[0]
      const toX = tgt.x - p.x
      const toZ = tgt.z - p.z
      const d = Math.hypot(toX, toZ)
      const stepLen = WALK_SPEED * dt
      const last = p.path.length === 1
      if (d <= Math.max(stepLen, last ? 0.04 : 0.15)) {
        const clear = ids.every((o) => o === id || Math.hypot(this.poses[o].x - tgt.x, this.poses[o].z - tgt.z) >= PERSONAL)
        if (clear || !last) {
          if (clear) {
            p.x = tgt.x
            p.z = tgt.z
          }
          p.path.shift()
          if (!p.path.length) {
            p.goal = null
            const cb = p.arrive
            p.arrive = null
            cb?.()
          }
          continue
        }
      }
      const fx = d ? toX / d : 0
      const fz = d ? toZ / d : 0
      let vx = fx
      let vz = fz
      let pace = 1
      for (const o of ids) {
        if (o === id) continue
        const q = this.poses[o]
        const ox = q.x - p.x
        const oz = q.z - p.z
        const od = Math.hypot(ox, oz)
        const ahead = (ox * fx + oz * fz) / (od || 1)
        if (od > LOOK_AHEAD || ahead < 0.2) continue
        const push = (1 - od / LOOK_AHEAD) * 1.6
        // Everyone keeps right to pass. Around someone standing, take the nearer side.
        const side = q.path.length ? 1 : Math.sign(fx * oz - fz * ox) || 1
        vx += -fz * -side * push
        vz += fx * -side * push
        // Same direction: fall in behind them instead of barging past.
        if (q.path.length && od < 1) {
          const qt = q.path[0]
          const ql = Math.hypot(qt.x - q.x, qt.z - q.z) || 1
          if (((qt.x - q.x) * fx + (qt.z - q.z) * fz) / ql > 0.5) pace = Math.min(pace, (od - PERSONAL) / 0.4)
        }
      }
      const vl = Math.hypot(vx, vz) || 1
      const step = WALK_SPEED * dt * Math.max(0, Math.min(1, pace))
      const nx = p.x + (vx / vl) * step
      const nz = p.z + (vz / vl) * step
      if (walkable(nx, nz)) {
        p.x = nx
        p.z = nz
      } else if (walkable(nx, p.z)) {
        p.x = nx
      } else if (walkable(p.x, nz)) {
        p.z = nz
      }
    }

    // Bodies are solid. Walkers yield; someone working or waiting holds their ground.
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const p = this.poses[ids[a]]
        const q = this.poses[ids[b]]
        const dx = q.x - p.x
        const dz = q.z - p.z
        const d = Math.hypot(dx, dz) || 0.001
        if (d >= PERSONAL) continue
        const over = PERSONAL - d
        const pm = p.path.length ? 1 : 0
        const qm = q.path.length ? 1 : 0
        const total = pm + qm
        if (!total) continue
        const shift = (o: Pose, share: number, sx: number) => {
          const nx = o.x + (dx / d) * over * share * sx
          const nz = o.z + (dz / d) * over * share * sx
          if (walkable(nx, nz)) {
            o.x = nx
            o.z = nz
          } else {
            // Pinned against furniture: this one stays put and the other gives way.
            const from = prev.get(o === p ? ids[a] : ids[b])!
            o.x = from.x
            o.z = from.z
          }
        }
        if (pm) shift(p, qm ? 0.5 : 1, -1)
        if (qm) shift(q, pm ? 0.5 : 1, 1)
      }
    }

    for (const id of ids) {
      const p = this.poses[id]
      if (!p.path.length) continue
      const from = prev.get(id)!
      const mx = p.x - from.x
      const mz = p.z - from.z
      const moved = Math.hypot(mx, mz)
      // Small shoves don't turn anyone around; only real steps set the facing.
      if (moved > WALK_SPEED * dt * 0.4) p.heading = Math.atan2(mx, mz)
      p.stuck = moved < WALK_SPEED * dt * 0.25 ? p.stuck + dt : Math.max(0, p.stuck - dt)
      p.check += dt
      // Pushed off course or boxed in: think again from here.
      const lost = p.check > 0.25 && !clearLine(p, p.path[0])
      if (lost) p.check = 0
      if (lost || p.stuck > 0.7) {
        const others = this.standing(id)
        // The spot may have been taken by someone standing there now.
        if (p.goal && others.some((o) => Math.hypot(o.x - p.goal!.x, o.z - p.goal!.z) < PERSONAL)) {
          p.goal = nearestWalkable(p.goal, this.claimed(id), QUEUE_GAP)
        }
        p.path = findPath(p, p.goal ?? p.path[p.path.length - 1], others)
        p.stuck = 0
      }
    }
  },
}

// Seed the village with a little work in flight so it opens in a working state.
export function seed() {
  const s = useStore.getState()
  if (Object.keys(s.tasks).length) return
  s.dispatch('listings')
  s.dispatch('pricing')
  s.dispatch('photos')
}

export const buildingBusy = (s: State): Set<BuildingId> => {
  const out = new Set<BuildingId>()
  for (const a of Object.values(s.agents)) {
    if (a.activity !== 'working' && a.activity !== 'blocked') continue
    const t = a.taskId ? s.tasks[a.taskId] : null
    const step = t?.steps[t.stepIndex]
    if (step && (step.kind === 'tool' || step.kind === 'hiccup')) out.add(step.building)
  }
  return out
}

// Debug handle for poking the sim from the console: agentville.useStore.getState()
if (typeof window !== 'undefined') (window as unknown as { agentville: unknown }).agentville = { useStore, runtime }
