// The protocol between "agent runtime" and "village".
// The village is only a view over these types — swap the simulated runtime
// for a real one (e.g. Claude + tool use) and the scene keeps working.

export type BuildingId = 'desk' | 'library' | 'studio' | 'post' | 'market' | 'lookout'

export type Risk = 'low' | 'high'

export type Step =
  | { kind: 'tool'; building: BuildingId; label: string; seconds: number; cost: number }
  | { kind: 'approval'; label: string; risk: Risk; preview: string[] }
  | { kind: 'hiccup'; building: BuildingId; label: string; seconds: number }
  | { kind: 'deliver' }

export type Activity = 'idle' | 'walking' | 'working' | 'waiting' | 'blocked' | 'celebrating'

/** 1 = ask me first · 2 = ask for big stuff · 3 = just do it */
export type Autonomy = 1 | 2 | 3

export interface AgentDef {
  id: string
  name: string
  role: string
  blurb: string
  /** UI color (matches their top) */
  color: string
  accent: string
  look: Look
}

export type HairStyle = 'curly' | 'short' | 'bun' | 'long' | 'beanie'
export type Pose = 'stand' | 'walk' | 'lounge' | 'sit' | 'browse' | 'sip' | 'type' | 'read' | 'operate' | 'counter' | 'present' | 'scratch' | 'cheer'

/** How a resident is dressed. Every field is a material choice. */
export interface Look {
  skin: string
  hair: string
  hairStyle: HairStyle
  hat?: string
  top: string
  sleeves: 'long' | 'short'
  bottom: string
  shoes: string
  glasses?: boolean
  prop: 'notebook' | 'camera' | 'backpack' | 'tote'
  propColor: string
  height: number
}

export interface AgentState extends AgentDef {
  activity: Activity
  bubble: string | null
  taskId: string | null
  autonomy: Autonomy
  maxAutonomy: Autonomy
  streak: number
  done: number
}

export interface Deliverable {
  title: string
  kind: string
  body: string[]
}

export interface JobTemplate {
  id: string
  title: string
  agentId: string
  steps: Step[]
  deliverable: Deliverable
}

export type TaskStatus = 'queued' | 'active' | 'waiting' | 'done'

export interface Task {
  id: string
  title: string
  agentId: string
  steps: Step[]
  stepIndex: number
  status: TaskStatus
  createdAt: number
  finishedAt?: number
  deliverable: Deliverable
  cost: number
  revisions: number
}

export type EventType =
  | 'assigned'
  | 'tool_start'
  | 'tool_end'
  | 'blocked'
  | 'needs_approval'
  | 'approved'
  | 'auto_approved'
  | 'sent_back'
  | 'done'
  | 'level_up'

export interface AgentEvent {
  id: number
  t: number
  agentId: string
  taskId?: string
  type: EventType
  text: string
  building?: BuildingId
}
