import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { AgentState, Autonomy } from '../sim/types'
import { sfx } from './sound'

export const AUTONOMY_LABELS: Record<Autonomy, { short: string; long: string }> = {
  1: { short: 'Ask first', long: 'Asks before anything leaves the village' },
  2: { short: 'Ask for big stuff', long: 'Does small things, asks before publishing or sending' },
  3: { short: 'Just do it', long: 'Works on its own and reports back on a receipt' },
}

/** A little 2D vinyl badge that matches the 3D resident. */
export function Avatar({ agent, size = 36 }: { agent: Pick<AgentState, 'color' | 'accent' | 'name'>; size?: number }) {
  return (
    <span className="avatar" style={{ '--c': agent.color, '--a': agent.accent, width: size, height: size } as CSSProperties} aria-hidden>
      <span className="avatar__eyes" />
    </span>
  )
}

/** Three-detent rotary knob for autonomy. Detents above maxAutonomy are locked until trust is earned. */
export function AutonomyKnob({
  value,
  max,
  onChange,
  id,
}: {
  value: Autonomy
  max: Autonomy
  onChange: (v: Autonomy) => void
  id: string
}) {
  const angle = { 1: -60, 2: 0, 3: 60 }[value]
  const ref = useRef<HTMLDivElement>(null)
  const set = (v: number) => {
    const c = Math.max(1, Math.min(max, v)) as Autonomy
    if (c !== value) {
      sfx.detent()
      onChange(c)
    }
  }
  const onPointer = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const a = (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI
    set(a < -30 ? 1 : a > 30 ? 3 : 2)
  }
  return (
    <div className="knob">
      <div
        ref={ref}
        id={id}
        className="knob__dial"
        role="slider"
        tabIndex={0}
        aria-label="Autonomy"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={value}
        aria-valuetext={AUTONOMY_LABELS[value].short}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(value + 1)
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(value - 1)
        }}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          onPointer(e)
        }}
        onPointerMove={(e) => e.buttons && onPointer(e)}
      >
        <div className="knob__cap" style={{ transform: `rotate(${angle}deg)` }}>
          <span className="knob__mark" />
        </div>
        {[1, 2, 3].map((d) => (
          <span key={d} className={`knob__tick ${d <= max ? '' : 'is-locked'} ${d === value ? 'is-on' : ''}`} style={{ '--r': `${(d - 2) * 60}deg` } as CSSProperties} />
        ))}
      </div>
      <div className="knob__legend">
        {([1, 2, 3] as Autonomy[]).map((d) => (
          <button key={d} className={`knob__opt ${d === value ? 'is-on' : ''}`} disabled={d > max} onClick={() => set(d)}>
            <span className="knob__num">{d}</span>
            {AUTONOMY_LABELS[d].short}
            {d > max && <span className="knob__lock">Locked</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Press and hold to approve. Friction proportional to consequence. */
export function HoldButton({ onDone, label, ms = 700 }: { onDone: () => void; label: string; ms?: number }) {
  const [p, setP] = useState(0)
  const [stamped, setStamped] = useState(false)
  const raf = useRef(0)
  const timer = useRef(0)
  const start = useRef(0)
  const finish = () => {
    cancelAnimationFrame(raf.current)
    setP(1)
    setStamped(true)
    sfx.stamp()
    setTimeout(onDone, 380)
  }
  const stop = () => {
    cancelAnimationFrame(raf.current)
    clearTimeout(timer.current)
    if (!stamped) setP(0)
  }
  // The timer decides completion; animation frames only draw the fill.
  const draw = () => {
    setP(Math.min(1, (performance.now() - start.current) / ms))
    raf.current = requestAnimationFrame(draw)
  }
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      clearTimeout(timer.current)
    },
    [],
  )
  return (
    <button
      className={`hold ${stamped ? 'is-stamped' : ''}`}
      style={{ '--p': p } as CSSProperties}
      onPointerDown={() => {
        if (stamped) return
        start.current = performance.now()
        sfx.click()
        raf.current = requestAnimationFrame(draw)
        timer.current = window.setTimeout(finish, ms)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !stamped) {
          e.preventDefault()
          finish()
        }
      }}
    >
      <span className="hold__fill" />
      <span className="hold__label">{stamped ? 'Approved' : label}</span>
      <span className="hold__hint">{stamped ? '' : 'Hold'}</span>
    </button>
  )
}
