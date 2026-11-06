# Agentville

A game-like interface for running an AI agent team. Agents live as residents of a rendered village; furnished stations are their tools; you approve their work with a physical stamp and get finished work as receipts.

The concept, design rules and art direction are in [docs/CONCEPT.md](docs/CONCEPT.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # production build in dist/
npm run build:single # one self-contained HTML file in dist-single/agentville.html
```

## What to try

- **Send a job** from the job board. The resident walks to each building (tool) it needs.
- **Pin your own job** in the text field. It's routed to a resident by keywords.
- When a resident walks to **Rae's Desk** holding an orange sign, press **Review** on the deck, read the preview, and **hold Approve** (or send it back).
- **Two clean approvals** in a row earn a resident more trust. Open its card and turn the **autonomy dial**.
- Finished work **prints as a receipt** from the deck. Hover the printer and click a receipt to read it.
- Flip **Village / Ledger** for the calm list view. Use **1× / 2× / 4×** to speed up time.
- Debug from the console: `agentville.useStore.getState()`.

## Code map

| Path | What it does |
|---|---|
| `src/sim/types.ts` | The event protocol between agent runtime and village |
| `src/sim/data.ts` | The scenario: shop, residents, buildings, jobs |
| `src/sim/store.ts` | State (zustand) and the simulated runtime |
| `src/scene/view.ts` | The locked camera, shared with `art/` |
| `src/scene/world.ts` | Loads the rendered assets |
| `src/scene/Village.tsx` | World image, job-board cards, camera fit |
| `src/scene/Stations.tsx` | Furniture cutouts, lit states, station labels |
| `src/scene/pan.ts` | Drag to pan, scroll or pinch to zoom |
| `src/sim/nav.ts` | Collision map and pathfinding |
| `src/sim/places.ts` | Work spots, the desk queue and hangout seats |
| `src/scene/Agent.tsx` | Resident sprites and depth order |
| `art/` | Blender scripts that render everything in `src/assets/world/` |
| `src/ui/*` | Panels, deck, autonomy dial, hold-to-approve, sounds |
| `src/styles.css` | Design tokens and UI styles (light and dark) |

Built with React, three.js via react-three-fiber and drei, and zustand. The world is rendered in Blender Cycles.
