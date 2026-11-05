import { useStore } from '../sim/store'

let ctx: AudioContext | null = null
const ac = () => {
  if (useStore.getState().muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.05, slide = 0) {
  const a = ac()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, a.currentTime)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur)
  g.gain.setValueAtTime(gain, a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
  o.connect(g).connect(a.destination)
  o.start()
  o.stop(a.currentTime + dur)
}

function noise(dur: number, gain = 0.04, hp = 2000) {
  const a = ac()
  if (!a) return
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const s = a.createBufferSource()
  s.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = hp
  const g = a.createGain()
  g.gain.value = gain
  s.connect(f).connect(g).connect(a.destination)
  s.start()
}

export const sfx = {
  click: () => {
    blip(1800, 0.03, 'square', 0.03)
    noise(0.02, 0.03, 4000)
  },
  detent: () => blip(2600, 0.015, 'square', 0.02),
  stamp: () => {
    blip(140, 0.18, 'sine', 0.25, -80)
    noise(0.08, 0.12, 300)
  },
  print: () => {
    for (let i = 0; i < 9; i++) setTimeout(() => noise(0.03, 0.03, 3000), i * 45)
  },
  chime: () => {
    blip(880, 0.18, 'triangle', 0.05)
    setTimeout(() => blip(1320, 0.28, 'triangle', 0.05), 110)
  },
  levelUp: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.05), i * 90)),
}
