import { useStore } from '../sim/store'
import type { AgentState } from '../sim/types'

export type Status = 'free' | 'progress' | 'complete' | 'needs' | 'blocked'

/** How long a finished resident keeps showing a check, in sim seconds. */
const COMPLETE_FOR = 40

export const STATUS_LABEL: Record<Status, string> = {
  free: 'Free',
  progress: 'In progress',
  complete: 'Complete',
  needs: 'Needs you',
  blocked: 'Stuck',
}

export function statusOf(a: AgentState, clock: number): Status {
  if (a.activity === 'waiting') return 'needs'
  if (a.activity === 'blocked') return 'blocked'
  if (a.taskId) return 'progress'
  if (a.doneAt !== undefined && clock - a.doneAt < COMPLETE_FOR) return 'complete'
  return 'free'
}

function Icon({ status }: { status: Status }) {
  switch (status) {
    case 'progress':
      return (
        <svg viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" />
          <path d="M8 3a5 5 0 0 1 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pin__spin" />
        </svg>
      )
    case 'complete':
      return (
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M4.5 8.4l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'needs':
    case 'blocked':
      return (
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M8 4v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="8" cy="12" r="1.2" fill="currentColor" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="3" fill="currentColor" />
        </svg>
      )
  }
}

/**
 * A small status icon above a resident's head. Hover adds the name;
 * clicking opens the full card, which grows upward so the face stays clear.
 */
export function StatusPin({ agent, selected, hover, onToggle }: { agent: AgentState; selected: boolean; hover: boolean; onToggle: () => void }) {
  const status = useStore((s) => statusOf(s.agents[agent.id], s.clock))
  const task = useStore((s) => (agent.taskId ? s.tasks[agent.taskId] : null))
  const label = STATUS_LABEL[status]
  return (
    <div className={`pin pin--${status} ${selected ? 'is-open' : ''} ${hover ? 'is-hover' : ''}`}>
      <button className="pin__body" onClick={onToggle} aria-label={`${agent.name}: ${label}`} aria-expanded={selected}>
        {selected ? (
          <span className="pin__card">
            <span className="pin__head">
              <span className="pin__icon">
                <Icon status={status} />
              </span>
              <span className="pin__name">{agent.name}</span>
              <span className="pin__status">{label}</span>
            </span>
            {task && <span className="pin__task">{task.title}</span>}
            {agent.bubble && <span className="pin__step">{agent.bubble}</span>}
            {!task && <span className="pin__step">{status === 'complete' ? 'Delivered. Ready for the next job.' : agent.role}</span>}
          </span>
        ) : (
          <>
            <span className="pin__icon">
              <Icon status={status} />
            </span>
            <span className="pin__name">{agent.name}</span>
          </>
        )}
      </button>
    </div>
  )
}
