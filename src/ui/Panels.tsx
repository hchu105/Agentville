import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AGENTS, BUILDINGS, SHOP } from '../sim/data'
import { useStore } from '../sim/store'
import type { AgentEvent, AgentState, Step, Task } from '../sim/types'
import { AUTONOMY_LABELS, Avatar, AutonomyKnob, HoldButton } from './Controls'
import { sfx } from './sound'

// 1 simulated second = 1 minute of shop time, starting Thursday 9:41 AM.
export const shopTime = (t: number) => {
  const mins = 9 * 60 + 41 + Math.floor(t)
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const duration = (mins: number) => (mins < 60 ? `${Math.max(1, Math.round(mins))} min` : `${(mins / 60).toFixed(1)} hr`)
const money = (n: number) => `$${n.toFixed(2)}`
const agentById = (id: string) => AGENTS.find((a) => a.id === id)!
const buildingName = (id: string) => BUILDINGS.find((b) => b.id === id)?.name ?? id

const ACTIVITY_LABEL: Record<AgentState['activity'], string> = {
  idle: 'Free',
  walking: 'On the way',
  working: 'Working',
  waiting: 'Needs you',
  blocked: 'Stuck',
  celebrating: 'Delivered',
}

function StatusPill({ a }: { a: AgentState['activity'] }) {
  return <span className={`pill pill--${a}`}>{ACTIVITY_LABEL[a]}</span>
}

function stepLabel(s: Step) {
  if (s.kind === 'tool') return `${buildingName(s.building)}: ${s.label}`
  if (s.kind === 'approval') return `Your OK: ${s.label}`
  if (s.kind === 'hiccup') return s.label
  return 'Deliver to your desk'
}

// ───────────── Top bar ─────────────
export function TopBar() {
  const clock = useStore((s) => s.clock)
  const spent = useStore((s) => s.spent)
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="brand__word">Agentville</span>
      </div>
      <div className="topbar__shop">
        <strong>{SHOP.name}</strong>
        <span>{SHOP.tagline}</span>
      </div>
      <div className="topbar__meta">
        <span className="meta">
          <span className="meta__k">Today</span>
          <span className="meta__v">Thu {shopTime(clock)}</span>
        </span>
        <span className="meta">
          <span className="meta__k">Spent</span>
          <span className="meta__v">{money(spent + 1.84)}</span>
        </span>
      </div>
    </header>
  )
}

// ───────────── Job board ─────────────
export function JobBoard() {
  const board = useStore((s) => s.board)
  const dispatch = useStore((s) => s.dispatch)
  const addCustom = useStore((s) => s.addCustom)
  const [text, setText] = useState('')
  return (
    <section className="panel jobs" aria-labelledby="jobs-h">
      <header className="panel__head">
        <h2 id="jobs-h">Job board</h2>
        <span className="count">{board.length}</span>
      </header>
      <form
        className="newjob"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          addCustom(text)
          setText('')
          sfx.click()
        }}
      >
        <input id="newjob" value={text} onChange={(e) => setText(e.target.value)} placeholder="Pin a new job, e.g. “Write an Instagram caption”" aria-label="New job" />
        <button type="submit" className="key key--small" aria-label="Pin job">
          Pin
        </button>
      </form>
      <ul className="joblist">
        {board.map((j) => {
          const a = agentById(j.agentId)
          const tools = [...new Set(j.steps.flatMap((s) => (s.kind === 'tool' ? [s.building] : [])))]
          const asks = j.steps.some((s) => s.kind === 'approval')
          return (
            <li key={j.id} className="jobcard">
              <p className="jobcard__title">{j.title}</p>
              <div className="jobcard__meta">
                <span className="chip">
                  <Avatar agent={a} size={18} />
                  {a.name}
                </span>
                <span className="jobcard__tools">{tools.map(buildingName).join(' → ')}</span>
                {asks && <span className="jobcard__ask">Needs your OK</span>}
              </div>
              <button
                className="key key--go"
                onClick={() => {
                  sfx.click()
                  dispatch(j.id)
                }}
              >
                Send {a.name}
              </button>
            </li>
          )
        })}
        {!board.length && <li className="empty">All jobs are out. Pin a new one above.</li>}
      </ul>
    </section>
  )
}

// ───────────── Team / inspector ─────────────
function TeamRoster() {
  const agents = useStore(useShallow((s) => Object.values(s.agents)))
  const tasks = useStore((s) => s.tasks)
  const select = useStore((s) => s.select)
  return (
    <section className="panel team" aria-labelledby="team-h">
      <header className="panel__head">
        <h2 id="team-h">Your team</h2>
        <span className="hint">Tap a resident to inspect</span>
      </header>
      <ul className="roster">
        {agents.map((a) => {
          const t = a.taskId ? tasks[a.taskId] : null
          return (
            <li key={a.id}>
              <button className="roster__row" onClick={() => select(a.id)}>
                <Avatar agent={a} />
                <span className="roster__who">
                  <strong>{a.name}</strong>
                  <span>{t ? t.title : a.role}</span>
                </span>
                <StatusPill a={a.activity} />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Progress({ task }: { task: Task }) {
  return (
    <ol className="steps">
      {task.steps.map((s, i) => (
        <li key={i} className={i < task.stepIndex ? 'is-done' : i === task.stepIndex ? 'is-now' : ''}>
          <span className="steps__dot" />
          {stepLabel(s)}
        </li>
      ))}
    </ol>
  )
}

function EventLine({ e }: { e: AgentEvent }) {
  return (
    <li className={`ev ev--${e.type}`}>
      <time>{shopTime(e.t)}</time>
      <span>{e.text}</span>
    </li>
  )
}

function Inspector({ id }: { id: string }) {
  const a = useStore((s) => s.agents[id])
  const task = useStore((s) => (a.taskId ? s.tasks[a.taskId] : null))
  const events = useStore(useShallow((s) => s.events.filter((e) => e.agentId === id).slice(0, 6)))
  const setAutonomy = useStore((s) => s.setAutonomy)
  const select = useStore((s) => s.select)
  const openApproval = useStore((s) => s.openApproval)
  return (
    <section className="panel inspector" aria-labelledby="insp-h">
      <header className="inspector__head">
        <Avatar agent={a} size={52} />
        <div>
          <h2 id="insp-h">{a.name}</h2>
          <p>{a.role}</p>
        </div>
        <StatusPill a={a.activity} />
        <button className="close" onClick={() => select(null)} aria-label="Close">
          ×
        </button>
      </header>
      <p className="paused">
        <span className="paused__dot" />
        {a.taskId
          ? `${a.name} keeps working while you look.`
          : `${a.name} stays put while you look. Close this card and ${a.name} wanders off again.`}
      </p>
      <p className="inspector__blurb">{a.blurb}</p>

      <div className="stats">
        <div>
          <span className="stats__v">{a.done}</span>
          <span className="stats__k">Jobs done</span>
        </div>
        <div>
          <span className="stats__v">{a.streak}</span>
          <span className="stats__k">OK streak</span>
        </div>
        <div>
          <span className="stats__v">{a.maxAutonomy}/3</span>
          <span className="stats__k">Trust level</span>
        </div>
      </div>

      {task ? (
        <div className="block">
          <h3>Now: {task.title}</h3>
          <Progress task={task} />
          {task.status === 'waiting' && (
            <button className="key key--signal" onClick={() => openApproval(task.id)}>
              Review and approve
            </button>
          )}
        </div>
      ) : (
        <div className="block">
          <h3>Free</h3>
          <p className="muted">Wandering the room between jobs. Send {a.name} one from the board.</p>
        </div>
      )}

      <div className="block">
        <h3>Autonomy</h3>
        <AutonomyKnob id={`knob-${a.id}`} value={a.autonomy} max={a.maxAutonomy} onChange={(v) => setAutonomy(a.id, v)} />
        <p className="muted small">
          {AUTONOMY_LABELS[a.autonomy].long}.{' '}
          {a.maxAutonomy < 3 ? `Approve ${2 - a.streak} more without changes to unlock the next level.` : 'Fully trusted.'}
        </p>
      </div>

      <div className="block">
        <h3>Recent</h3>
        <ul className="evlist">
          {events.map((e) => (
            <EventLine key={e.id} e={e} />
          ))}
        </ul>
      </div>
    </section>
  )
}

export function SidePanel() {
  const sel = useStore((s) => s.selectedAgentId)
  return sel ? <Inspector id={sel} /> : <TeamRoster />
}

// ───────────── Approval sheet ─────────────
export function ApprovalSheet() {
  const id = useStore((s) => s.approvalTaskId)
  const task = useStore((s) => (id ? s.tasks[id] : null))
  const approve = useStore((s) => s.approve)
  const sendBack = useStore((s) => s.sendBack)
  const close = useStore((s) => s.openApproval)
  if (!task || task.status !== 'waiting') return null
  const step = task.steps[task.stepIndex]
  if (step.kind !== 'approval') return null
  const a = agentById(task.agentId)
  return (
    <div className="scrim" onClick={() => close(null)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="appr-h" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <Avatar agent={a} size={44} />
          <div>
            <p className="eyebrow">
              {a.name} · {a.role}
            </p>
            <h2 id="appr-h">{step.label}</h2>
          </div>
          <span className={`risk risk--${step.risk}`}>{step.risk === 'high' ? 'Goes public' : 'Small change'}</span>
        </header>
        <div className="paper">
          {step.preview.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <p className="muted small">
          For “{task.title}”. {task.revisions ? `Revision ${task.revisions + 1}. ` : ''}Cost so far {money(task.cost)}.
        </p>
        <div className="sheet__actions">
          <button
            className="key"
            onClick={() => {
              sfx.click()
              sendBack(task.id)
            }}
          >
            Send back
          </button>
          <HoldButton label="Approve" onDone={() => approve(task.id)} />
        </div>
      </div>
    </div>
  )
}

// ───────────── Receipt + document ─────────────
function Receipt({ task, n, fresh }: { task: Task; n: number; fresh: boolean }) {
  const a = agentById(task.agentId)
  const open = useStore((s) => s.openTask)
  const tools = task.steps.filter((s) => s.kind === 'tool').length
  return (
    <button className={`receipt ${fresh ? 'is-fresh' : ''}`} onClick={() => open(task.id)}>
      <span className="receipt__row receipt__shop">
        {SHOP.name.toUpperCase()} · No. {String(n).padStart(4, '0')}
      </span>
      <span className="receipt__title">{task.deliverable.title}</span>
      <span className="receipt__row">
        <span>{a.name}</span>
        <span>{task.deliverable.kind}</span>
      </span>
      <span className="receipt__row">
        <span>{tools} tool runs</span>
        <span>{duration((task.finishedAt ?? 0) - task.createdAt)}</span>
      </span>
      <span className="receipt__row receipt__total">
        <span>Cost</span>
        <span>{money(task.cost)}</span>
      </span>
    </button>
  )
}

export function Printer() {
  const receipts = useStore((s) => s.receipts)
  const tasks = useStore((s) => s.tasks)
  const unread = useStore((s) => s.unread)
  const markRead = useStore((s) => s.markRead)
  const last = useRef(receipts.length)
  useEffect(() => {
    if (receipts.length > last.current) {
      sfx.print()
      setTimeout(sfx.chime, 450)
    }
    last.current = receipts.length
  }, [receipts.length])
  return (
    <div className="printer" onMouseEnter={markRead}>
      <div className="printer__slot">
        <span className="printer__label">Receipts</span>
        {unread > 0 && <span className="printer__badge">{unread}</span>}
      </div>
      <div className="printer__paper">
        {receipts.slice(0, 3).map((id, i) => (
          <Receipt key={id} task={tasks[id]} n={receipts.length - i} fresh={i === 0} />
        ))}
        {!receipts.length && <p className="printer__empty">Finished work prints here</p>}
      </div>
    </div>
  )
}

export function DocViewer() {
  const id = useStore((s) => s.openTaskId)
  const task = useStore((s) => (id ? s.tasks[id] : null))
  const close = useStore((s) => s.openTask)
  const events = useStore(useShallow((s) => s.events.filter((e) => e.taskId === id).reverse()))
  if (!task) return null
  const a = agentById(task.agentId)
  return (
    <div className="scrim" onClick={() => close(null)}>
      <article className="doc" role="dialog" aria-modal="true" aria-labelledby="doc-h" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={() => close(null)} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">
          {task.deliverable.kind} · by {a.name}
        </p>
        <h2 id="doc-h">{task.deliverable.title}</h2>
        <div className="doc__body">
          {task.deliverable.body.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <h3>How it got made</h3>
        <ul className="evlist">
          {events.map((e) => (
            <EventLine key={e.id} e={e} />
          ))}
        </ul>
      </article>
    </div>
  )
}

// ───────────── Toast (hero moment) ─────────────
export function Toast() {
  const toast = useStore((s) => s.toast)
  const dismiss = useStore((s) => s.dismissToast)
  const select = useStore((s) => s.select)
  useEffect(() => {
    if (!toast) return
    sfx.levelUp()
    const t = setTimeout(dismiss, 7000)
    return () => clearTimeout(t)
  }, [toast, dismiss])
  if (!toast) return null
  const a = agentById(toast.agentId)
  return (
    <div className="toast" role="status">
      <span className="toast__avatar">
        <Avatar agent={a} size={48} />
      </span>
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.body}</p>
      </div>
      <button
        className="key key--small"
        onClick={() => {
          select(a.id)
          dismiss()
        }}
      >
        Open dial
      </button>
    </div>
  )
}

// ───────────── Ledger (the calm list view) ─────────────
export function Ledger() {
  const tasks = useStore(useShallow((s) => Object.values(s.tasks).sort((a, b) => b.createdAt - a.createdAt)))
  const events = useStore((s) => s.events)
  const openTask = useStore((s) => s.openTask)
  const openApproval = useStore((s) => s.openApproval)
  return (
    <div className="ledger">
      <section className="panel">
        <header className="panel__head">
          <h2>Work</h2>
          <span className="count">{tasks.length}</span>
        </header>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Who</th>
                <th>Status</th>
                <th>Step</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const a = agentById(t.agentId)
                return (
                  <tr
                    key={t.id}
                    onClick={() => (t.status === 'done' ? openTask(t.id) : t.status === 'waiting' ? openApproval(t.id) : null)}
                    className={t.status === 'done' || t.status === 'waiting' ? 'is-link' : ''}
                  >
                    <td>{t.title}</td>
                    <td>
                      <span className="chip">
                        <Avatar agent={a} size={18} />
                        {a.name}
                      </span>
                    </td>
                    <td>
                      <span className={`pill pill--t-${t.status}`}>{t.status === 'waiting' ? 'Needs you' : t.status}</span>
                    </td>
                    <td className="muted">
                      {t.status === 'done' ? 'Delivered' : t.stepIndex >= 0 ? `${t.stepIndex + 1} of ${t.steps.length}` : 'Queued'}
                    </td>
                    <td className="num">{money(t.cost)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <header className="panel__head">
          <h2>Log</h2>
          <span className="count">{events.length}</span>
        </header>
        <ul className="evlist evlist--full">
          {events.slice(0, 60).map((e) => (
            <li key={e.id} className={`ev ev--${e.type}`}>
              <time>{shopTime(e.t)}</time>
              <span className="chip">
                <Avatar agent={agentById(e.agentId)} size={16} />
                {agentById(e.agentId).name}
              </span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ───────────── Control deck ─────────────
export function Deck() {
  const counts = useStore(
    useShallow((s) => {
      const ag = Object.values(s.agents)
      return {
        working: ag.filter((a) => ['working', 'walking', 'blocked'].includes(a.activity) && a.taskId).length,
        waiting: Object.values(s.tasks).filter((t) => t.status === 'waiting').length,
        done: s.receipts.length,
      }
    }),
  )
  const firstWaiting = useStore((s) => Object.values(s.tasks).find((t) => t.status === 'waiting')?.id ?? null)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  const muted = useStore((s) => s.muted)
  const toggleMute = useStore((s) => s.toggleMute)
  const openApproval = useStore((s) => s.openApproval)
  const prevWaiting = useRef(0)
  useEffect(() => {
    if (counts.waiting > prevWaiting.current) sfx.chime()
    prevWaiting.current = counts.waiting
  }, [counts.waiting])

  const lcd = useMemo(
    () => [
      { k: 'WORKING', v: counts.working },
      { k: 'NEED YOU', v: counts.waiting },
      { k: 'DONE', v: counts.done },
    ],
    [counts],
  )

  return (
    <footer className="deck">
      <div className="lcd" aria-live="polite">
        {lcd.map((x) => (
          <span key={x.k} className={`lcd__cell ${x.k === 'NEED YOU' && x.v ? 'is-alert' : ''}`}>
            <span className="lcd__v">{String(x.v).padStart(2, '0')}</span>
            <span className="lcd__k">{x.k}</span>
          </span>
        ))}
      </div>

      <button
        className={`bigkey ${counts.waiting ? 'is-live' : ''}`}
        disabled={!firstWaiting}
        onClick={() => {
          sfx.click()
          if (firstWaiting) openApproval(firstWaiting)
        }}
      >
        <span className="bigkey__led" />
        <span className="bigkey__label">{counts.waiting ? `Review ${counts.waiting}` : 'All clear'}</span>
      </button>

      <Printer />

      <div className="deck__controls">
        <div className="switch" role="group" aria-label="View">
          {(['village', 'ledger'] as const).map((v) => (
            <button
              key={v}
              className={view === v ? 'is-on' : ''}
              aria-pressed={view === v}
              onClick={() => {
                sfx.click()
                setView(v)
              }}
            >
              {v === 'village' ? 'Village' : 'Ledger'}
            </button>
          ))}
        </div>
        <div className="switch" role="group" aria-label="Speed">
          {([1, 2, 4] as const).map((v) => (
            <button
              key={v}
              className={speed === v ? 'is-on' : ''}
              aria-pressed={speed === v}
              onClick={() => {
                sfx.click()
                setSpeed(v)
              }}
            >
              {v}×
            </button>
          ))}
        </div>
        <button
          className={`key key--small ${muted ? '' : 'is-on'}`}
          aria-pressed={!muted}
          onClick={() => {
            toggleMute()
            setTimeout(sfx.click, 10)
          }}
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </div>
    </footer>
  )
}
