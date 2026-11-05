import { Suspense, lazy, useEffect, useState } from 'react'
import { seed, useStore } from './sim/store'
import { ApprovalSheet, Deck, DocViewer, JobBoard, Ledger, SidePanel, Toast, TopBar } from './ui/Panels'

const Village = lazy(() => import('./scene/Village').then((m) => ({ default: m.Village })))

type Tab = 'jobs' | 'team'

export function App() {
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selectedAgentId)
  const [tab, setTab] = useState<Tab>('team')

  // The simulated agent runtime ticks independently of the 3D view.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      useStore.getState()._tick((now - last) / 1000)
      last = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    // let the village render a beat before work starts
    const t = setTimeout(seed, 600)
    return () => clearTimeout(t)
  }, [])

  // Escape closes whatever is on top
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useStore.getState()
      if (s.approvalTaskId) s.openApproval(null)
      else if (s.openTaskId) s.openTask(null)
      else if (s.selectedAgentId) s.select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // on phones, selecting a resident jumps to its card
  useEffect(() => {
    if (selected) setTab('team')
  }, [selected])

  return (
    <div className={`app view-${view}`}>
      <TopBar />
      <main className="stage">
        <div className="stage__scene" aria-label="Village of agents">
          <Suspense fallback={<div className="loading">Building the village…</div>}>
            <Village />
          </Suspense>
        </div>
        {view === 'ledger' && <Ledger />}
        <div className="side side--left" data-active={tab === 'jobs'}>
          <JobBoard />
        </div>
        <div className="side side--right" data-active={tab === 'team'}>
          <SidePanel />
        </div>
        <nav className="tabs" aria-label="Panels">
          {(['team', 'jobs'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'is-on' : ''} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'team' ? 'Team' : 'Job board'}
            </button>
          ))}
        </nav>
      </main>
      <Deck />
      <ApprovalSheet />
      <DocViewer />
      <Toast />
    </div>
  )
}
