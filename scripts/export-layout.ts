// Writes art/layout.json from src/sim/data.ts, so Blender builds the room the sim walks in.
// npx tsx scripts/export-layout.ts
import { writeFileSync } from 'node:fs'
import { BUILDINGS, DESK_QUEUE, LEISURE } from '../src/sim/data'

const layout = {
  stations: BUILDINGS.map(({ id, x, z, rot, work }) => ({ id, x, z, rot, work })),
  islands: LEISURE.map(({ id, x, z, rot, spots }) => ({ id, x, z, rot, spots })),
  deskQueue: DESK_QUEUE,
}
writeFileSync(new URL('../art/layout.json', import.meta.url), JSON.stringify(layout, null, 1))
console.log('wrote art/layout.json')
