import { create } from 'zustand'
import { AGENTS, BUILDINGS, JOBS, planCustomJob } from './data'
import { clearLine, findPath, nearestWalkable, RADIUS, walkable, type Pt } from './nav'
import { approachOf, LEISURE_SPOTS, queueSpot, startSpot, workSpot, type LeisurePlace, type Place } from './places'
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

  select: (id) => {
    set({ selectedAgentId: id })
    if (id) runtime.greet(id)
  },
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
  /** Waypoints. `inside` lets the last step go into a chair or up to a counter. */
  path: (Pt & { inside?: boolean })[]
  /** Where this resident is headed. Holding it keeps two people off one spot. */
  goal: Pt | null
  timer: number
  arrive: (() => void) | null
  stuck: number
  check: number
  /** 1 = walking with purpose, lower = strolling */
  speed: number
  /** The place they're at now: a seat, a work spot, the desk queue. */
  place: Place | null
  /** How the resident holds themselves there. */
  pose: string | null
  /** The hangout spot a free agent is at, if any. */
  leisure: LeisurePlace | null
  /** Seconds left before a free agent wanders somewhere else. */
  dwell: number
  /** Seconds left of a wave at whoever is looking. */
  wave: number
}

export const doorOf = (b: BuildingId) => workSpot(b)

const WALK_SPEED = 1.7
const STROLL = 0.6
const SUBSTEP = 1 / 30
/** Closest two residents' centres may get: shoulder to shoulder. */
const PERSONAL = RADIUS * 2
/** Gap between people waiting at the same station. */
const QUEUE_GAP = 0.8
const LOOK_AHEAD = 1.5

// Deterministic randomness, so the room feels alive but replays the same.
let seedN = 7
const rand = () => {
  seedN = (seedN * 16807) % 2147483647
  return seedN / 2147483647
}

const WORK_POSE: Record<string, string> = { type: 'sit_work', read: 'sit_work', operate: 'working', counter: 'working' }

export const runtime = {
  poses: Object.fromEntries(
    AGENTS.map((a) => {
      const h = startSpot(a.id)
      return [
        a.id,
        {
          x: h.x,
          z: h.z,
          heading: h.heading,
          path: [],
          goal: null,
          timer: 0,
          arrive: null,
          stuck: 0,
          check: 0,
          speed: 1,
          place: h,
          pose: h.pose,
          leisure: h,
          dwell: 6 + rand() * 10,
          wave: 0,
        } as Pose,
      ]
    }),
  ) as Record<string, Pose>,
  claims: Object.fromEntries(AGENTS.map((a) => [startSpot(a.id).key, a.id])) as Record<string, string>,
  celebrate: {} as Record<string, number>,

  release(agentId: string) {
    for (const k of Object.keys(this.claims)) if (this.claims[k] === agentId) delete this.claims[k]
    this.poses[agentId].leisure = null
  },

  /** People standing or sitting still, whom a walker must go around. */
  standing(except: string): Pt[] {
    return Object.entries(this.poses)
      .filter(([id, p]) => id !== except && !p.path.length)
      .map(([, p]) => p)
  },

  /** Where everyone else is now or has claimed, so nobody picks the same spot. */
  claimed(except: string): Pt[] {
    return Object.entries(this.poses)
      .filter(([id]) => id !== except)
      .map(([, p]) => p.goal ?? p)
  },

  /**
   * Walk to a place: around furniture and people to just in front of it, then
   * step in and face the right way. If someone already has the spot, wait nearby.
   */
  walk(agentId: string, to: Place, arrive: () => void, speed = 1, pose: string | null = null) {
    const p = this.poses[agentId]
    const taken = this.claimed(agentId).some((o) => Math.hypot(o.x - to.x, o.z - to.z) < PERSONAL)
    const front = approachOf(to, to.approach ?? (to.seat ? 0.75 : 0.35))
    const path: Pose['path'] = []
    // Get up out of a chair the way you came in.
    if (p.place && !walkable(p.x, p.z)) path.push(approachOf(p.place, p.place.approach ?? 0.75))
    const start = path[0] ?? p
    let goal: Pt
    if (taken) {
      goal = nearestWalkable(front, this.claimed(agentId), QUEUE_GAP)
      path.push(...findPath(start, goal, this.standing(agentId)))
    } else {
      goal = to
      path.push(...findPath(start, nearestWalkable(front), this.standing(agentId)), { x: to.x, z: to.z, inside: true })
    }
    p.path = path
    p.goal = goal
    p.place = null
    p.pose = null
    p.speed = speed
    p.stuck = 0
    p.arrive = () => {
      p.place = taken ? { ...goal, heading: Math.atan2(to.x - goal.x, to.z - goal.z) } : to
      p.heading = p.place.heading
      p.pose = taken ? null : pose
      arrive()
    }
  },

  /** Free time: wander to an open seat or spot somewhere else in the room. Status stays Free. */
  roam(agentId: string) {
    const p = this.poses[agentId]
    const here = p.leisure?.island
    this.release(agentId)
    const open = LEISURE_SPOTS.filter((sp) => !this.claims[sp.key])
    const elsewhere = open.filter((sp) => sp.island !== here)
    const pool = elsewhere.length ? elsewhere : open
    if (!pool.length) return
    const spot = pool[Math.floor(rand() * pool.length)]
    this.claims[spot.key] = agentId
    useStore.getState()._patchAgent(agentId, { activity: 'walking' })
    this.walk(
      agentId,
      spot,
      () => {
        p.leisure = spot
        p.dwell = 12 + rand() * 16
        useStore.getState()._patchAgent(agentId, { activity: 'idle' })
      },
      STROLL,
      spot.pose,
    )
  },

  /** Someone opened this resident's card: look up and wave, without stopping work. */
  greet(agentId: string) {
    const p = this.poses[agentId]
    if (!p.path.length && !p.place?.seat) p.wave = 1.6
  },

  /** Start (or continue) the agent's current task at its stepIndex. */
  begin(agentId: string) {
    const s = useStore.getState()
    const ag = s.agents[agentId]
    const task = ag.taskId ? s.tasks[ag.taskId] : null
    if (!task) return
    const step = task.steps[task.stepIndex]
    if (!step) return
    this.release(agentId)
    const next = () => {
      const cur = useStore.getState().tasks[task.id]
      useStore.getState()._patchTask(task.id, { stepIndex: cur.stepIndex + 1 })
      this.begin(agentId)
    }
    const st = useStore.getState()
    const go = (to: Place, arrive: () => void, pose: string | null = null) => {
      st._patchAgent(agentId, { activity: 'walking', bubble: null })
      this.walk(agentId, to, arrive, 1, pose)
    }
    if (step.kind === 'tool') {
      const b = BUILDINGS.find((x) => x.id === step.building)!
      go(
        workSpot(step.building),
        () => {
          const g = useStore.getState()
          g._patchAgent(agentId, { activity: 'working', bubble: step.label })
          g._log(agentId, 'tool_start', step.label, { taskId: task.id, building: step.building })
          this.poses[agentId].timer = step.seconds
          this.poses[agentId].arrive = () => {
            const g2 = useStore.getState()
            g2._log(agentId, 'tool_end', `Finished: ${step.label}`, { taskId: task.id, building: step.building })
            useStore.setState((x) => ({ spent: x.spent + step.cost }))
            g2._patchTask(task.id, { cost: g2.tasks[task.id].cost + step.cost })
            next()
          }
        },
        WORK_POSE[b.work.pose],
      )
    } else if (step.kind === 'hiccup') {
      st._patchAgent(agentId, { activity: 'blocked', bubble: step.label })
      st._log(agentId, 'blocked', step.label, { taskId: task.id, building: step.building })
      this.poses[agentId].pose = null
      this.poses[agentId].timer = step.seconds
      this.poses[agentId].arrive = next
    } else if (step.kind === 'approval') {
      const need = step.risk === 'high' ? ag.autonomy < 3 : ag.autonomy < 2
      if (!need) {
        st._log(agentId, 'auto_approved', `Did it without asking (autonomy ${ag.autonomy}): ${step.label}`, { taskId: task.id })
        next()
        return
      }
      go(queueSpot(agentId), () => {
        const g = useStore.getState()
        g._patchAgent(agentId, { activity: 'waiting', bubble: step.label })
        g._patchTask(task.id, { status: 'waiting' })
        g._log(agentId, 'needs_approval', `Needs your OK: ${step.label}`, { taskId: task.id })
      })
    } else if (step.kind === 'deliver') {
      go(queueSpot(agentId), () => {
        const g = useStore.getState()
        g._patchTask(task.id, { status: 'done', finishedAt: g.clock })
        g._log(agentId, 'done', `Delivered “${task.title}”`, { taskId: task.id })
        useStore.setState((x) => ({ receipts: [task.id, ...x.receipts], unread: x.unread + 1 }))
        g._patchAgent(agentId, { activity: 'celebrating', bubble: null, taskId: null, done: g.agents[agentId].done + 1, doneAt: g.clock })
        this.celebrate[agentId] = 1.4
        this.poses[agentId].timer = 1.4
        this.poses[agentId].arrive = () => {
          useStore.getState()._patchAgent(agentId, { activity: 'idle' })
          this.roam(agentId)
        }
      })
    }
  },

  tick(rawDt: number) {
    const s = useStore.getState()
    const dt = Math.min(rawDt, 0.1) * s.speed
    useStore.setState({ clock: s.clock + dt })

    for (const id of Object.keys(this.poses)) {
      const p = this.poses[id]
      const ag = s.agents[id]
      if (p.wave > 0) p.wave -= dt

      // Looking never pauses work. A free agent you're looking at stays put
      // instead of wandering off mid-conversation.
      const watched = s.selectedAgentId === id && !ag.taskId && ag.activity === 'idle' && !p.path.length

      if (!watched && !ag.taskId && (ag.activity === 'idle' || ag.activity === 'walking')) {
        const queued = Object.values(s.tasks)
          .filter((t) => t.agentId === id && t.status === 'queued')
          .sort((a, b) => a.createdAt - b.createdAt)[0]
        if (queued) {
          s._patchTask(queued.id, { status: 'active', stepIndex: 0 })
          s._patchAgent(id, { taskId: queued.id })
          this.begin(id)
          continue
        }
        if (ag.activity === 'idle' && !p.path.length) {
          if (!p.leisure) this.roam(id)
          else if ((p.dwell -= dt) <= 0) this.roam(id)
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
    // Moving is allowed onto the floor, into a chair on the last step, or out of one.
    const canGo = (p: Pose, x: number, z: number) => walkable(x, z) || !walkable(p.x, p.z) || !!p.path[0]?.inside

    for (const id of ids) {
      const p = this.poses[id]
      if (!p.path.length) continue
      const tgt = p.path[0]
      const toX = tgt.x - p.x
      const toZ = tgt.z - p.z
      const d = Math.hypot(toX, toZ)
      const speed = WALK_SPEED * p.speed
      const stepLen = speed * dt
      const last = p.path.length === 1
      if (d <= Math.max(stepLen, last ? 0.04 : 0.15)) {
        const clear = tgt.inside || ids.every((o) => o === id || Math.hypot(this.poses[o].x - tgt.x, this.poses[o].z - tgt.z) >= PERSONAL)
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
      // The last step into a seat is a precise move: no swerving.
      if (!tgt.inside) {
        for (const o of ids) {
          if (o === id) continue
          const q = this.poses[o]
          const ox = q.x - p.x
          const oz = q.z - p.z
          const od = Math.hypot(ox, oz)
          const ahead = (ox * fx + oz * fz) / (od || 1)
          if (od > LOOK_AHEAD || ahead < 0.2) continue
          const push = (1 - od / LOOK_AHEAD) * 1.6
          // Everyone keeps right to pass. Around someone still, take the nearer side.
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
      }
      const vl = Math.hypot(vx, vz) || 1
      const step = stepLen * Math.max(0, Math.min(1, pace))
      const nx = p.x + (vx / vl) * step
      const nz = p.z + (vz / vl) * step
      if (canGo(p, nx, nz)) {
        p.x = nx
        p.z = nz
      } else if (canGo(p, nx, p.z)) {
        p.x = nx
      } else if (canGo(p, p.x, nz)) {
        p.z = nz
      }
    }

    // Bodies are solid. Walkers yield; someone working, waiting or seated holds their ground.
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
        if (!pm && !qm) continue
        const shift = (o: Pose, id: string, share: number, sx: number) => {
          const nx = o.x + (dx / d) * over * share * sx
          const nz = o.z + (dz / d) * over * share * sx
          if (walkable(nx, nz) || !walkable(o.x, o.z)) {
            o.x = nx
            o.z = nz
          } else {
            // Pinned against furniture: this one stays put and the other gives way.
            const from = prev.get(id)!
            o.x = from.x
            o.z = from.z
          }
        }
        if (pm) shift(p, ids[a], qm ? 0.5 : 1, -1)
        if (qm) shift(q, ids[b], pm ? 0.5 : 1, 1)
      }
    }

    for (const id of ids) {
      const p = this.poses[id]
      if (!p.path.length) continue
      const from = prev.get(id)!
      const mx = p.x - from.x
      const mz = p.z - from.z
      const moved = Math.hypot(mx, mz)
      const expect = WALK_SPEED * p.speed * dt
      // Small shoves don't turn anyone around; only real steps set the facing.
      if (moved > expect * 0.4) p.heading = Math.atan2(mx, mz)
      p.stuck = moved < expect * 0.25 ? p.stuck + dt : Math.max(0, p.stuck - dt)
      p.check += dt
      if (p.path[0].inside || !walkable(p.x, p.z)) continue
      // Pushed off course or boxed in: think again from here.
      const lost = p.check > 0.25 && !clearLine(p, p.path[0])
      if (lost) p.check = 0
      if (lost || p.stuck > 0.7) {
        const others = this.standing(id)
        const inside = p.path[p.path.length - 1].inside ? p.path[p.path.length - 1] : null
        let goal = p.goal ?? p.path[p.path.length - 1]
        // The spot may have been taken by someone standing there now.
        if (!inside && others.some((o) => Math.hypot(o.x - goal.x, o.z - goal.z) < PERSONAL)) {
          goal = p.goal = nearestWalkable(goal, this.claimed(id), QUEUE_GAP)
        }
        const target = inside ? p.path[p.path.length - 2] ?? nearestWalkable(inside) : goal
        p.path = [...findPath(p, target, others), ...(inside ? [inside] : [])]
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
