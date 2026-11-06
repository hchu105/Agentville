import * as THREE from 'three'

// One locked orthographic view. art/common.py renders from exactly this camera,
// so anything drawn in view space lines up with the prerendered world.
// Panning slides the camera along the view plane; it never turns.
export const CAM_POS = new THREE.Vector3(22, 20, 22)
export const CAM_TARGET = new THREE.Vector3(0, 0.6, 0)

const m = new THREE.Matrix4().lookAt(CAM_POS, CAM_TARGET, new THREE.Vector3(0, 1, 0))
export const VIEW_QUAT = new THREE.Quaternion().setFromRotationMatrix(m)
export const VIEW_RIGHT = new THREE.Vector3(1, 0, 0).applyQuaternion(VIEW_QUAT)
export const VIEW_UP = new THREE.Vector3(0, 1, 0).applyQuaternion(VIEW_QUAT)

/** World point to (u, v) in view space, relative to the camera target. */
export function toView(x: number, y: number, z: number) {
  const p = new THREE.Vector3(x, y, z).sub(CAM_TARGET)
  return { u: p.dot(VIEW_RIGHT), v: p.dot(VIEW_UP) }
}

/** Draw order: the back of the world is low, the front is high. */
export const LAYER = { plate: 0, base: 100 }
export const orderOf = (depth: number) => LAYER.base + (depth + 30) * 10
