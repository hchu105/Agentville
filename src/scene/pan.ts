import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAM_POS, CAM_TARGET, VIEW_RIGHT, VIEW_UP } from './view'
import { manifest, ROOM } from './world'

/** Shared with click handlers: a drag that moved isn't a click. */
export const pan = { moved: false }

const MAX_ZOOM_OVER_FIT = 2

/**
 * Drag to pan, scroll or pinch to zoom, kept inside the room. The camera only
 * slides along the view plane, so the prerendered world still lines up.
 * Zoom tops out where the world image stops being sharp.
 */
export function usePanZoom(fit: number, offset: { u: number; v: number }) {
  const { camera, gl, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    const el = gl.domElement
    const view = { u: 0, v: 0, zoom: fit }
    const pxPerUnit = (manifest.plate as { px?: number }).px ?? 96
    const maxZoom = Math.max(fit * 1.05, Math.min(fit * MAX_ZOOM_OVER_FIT, (pxPerUnit / window.devicePixelRatio) * 1.25))

    const apply = () => {
      view.zoom = THREE.MathUtils.clamp(view.zoom, fit * 0.9, maxZoom)
      // Keep the room on screen: the view can't slide past its edges.
      const hw = size.width / 2 / view.zoom
      const hh = size.height / 2 / view.zoom
      const clampAxis = (c: number, lo: number, hi: number, half: number) =>
        hi - lo <= half * 2 ? (lo + hi) / 2 : THREE.MathUtils.clamp(c, lo + half, hi - half)
      view.u = clampAxis(view.u, ROOM.u0 + offset.u, ROOM.u1 + offset.u, hw * 0.8)
      view.v = clampAxis(view.v, ROOM.v0 + offset.v, ROOM.v1 + offset.v, hh * 0.8)
      const shift = VIEW_RIGHT.clone().multiplyScalar(view.u - offset.u).add(VIEW_UP.clone().multiplyScalar(view.v - offset.v))
      cam.position.copy(CAM_POS).add(shift)
      cam.lookAt(CAM_TARGET.clone().add(shift))
      cam.zoom = view.zoom
      cam.updateProjectionMatrix()
    }
    view.u = (ROOM.u0 + ROOM.u1) / 2 + offset.u
    view.v = (ROOM.v0 + ROOM.v1) / 2 + offset.v
    apply()

    const pts = new Map<number, { x: number; y: number }>()
    let start = { x: 0, y: 0 }
    let pinch = 0
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 1) {
        start = { x: e.clientX, y: e.clientY }
        pan.moved = false
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const last = pts.get(e.pointerId)
      if (!last) return
      const cur = { x: e.clientX, y: e.clientY }
      pts.set(e.pointerId, cur)
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) view.zoom *= d / pinch
        pinch = d
        pan.moved = true
        apply()
        return
      }
      if (!pan.moved && Math.hypot(cur.x - start.x, cur.y - start.y) < 5) return
      pan.moved = true
      view.u -= (cur.x - last.x) / view.zoom
      view.v += (cur.y - last.y) / view.zoom
      el.style.cursor = 'grabbing'
      apply()
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch = 0
      el.style.cursor = ''
      // Let this pointerup's click see `moved`, then reset.
      setTimeout(() => (pan.moved = false), 0)
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      // Zoom toward the cursor: the point under it stays put.
      const mx = e.clientX - rect.left - rect.width / 2
      const my = e.clientY - rect.top - rect.height / 2
      const before = view.zoom
      view.zoom *= Math.exp(-e.deltaY * 0.0015)
      view.zoom = THREE.MathUtils.clamp(view.zoom, fit * 0.9, maxZoom)
      view.u += mx / before - mx / view.zoom
      view.v -= my / before - my / view.zoom
      apply()
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.style.touchAction = 'none'
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [camera, gl, size, fit, offset.u, offset.v])
}
