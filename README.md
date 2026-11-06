# Agentville

A game-like interface for running an AI agent team. Agents are dressed 3D residents on an open, catalog-style set; furniture stations are their tools; you approve their work with a physical stamp and get finished work as receipts.

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

- **Send a job** from the job board. The resident walks to each station (tool) it needs, and its posture shows what it's doing.
- **Pin your own job** in the text field. It's routed to a resident by keywords.
- When a resident stands at **Rae's Desk** holding up an orange folder, press **Review** on the deck, read the preview, and **hold Approve** (or send it back).
- **Two clean approvals** in a row earn a resident more trust. Open its card and turn the **autonomy dial**.
- Finished work **prints as a receipt** from the deck. Hover the printer and click a receipt to read it.
- **Drag to pan, scroll to zoom.** Free residents roam: coffee bar, meeting table, record corner, beanbags, pink sofa, bench.
- **Click a resident or its chip** to open its card. It looks up and waves. A busy agent keeps working; a free one stays put until you close the card.
- Flip **Village / Ledger** for the calm list view. Use **1× / 2× / 4×** to speed up time.
- Debug from the console: `agentville.useStore.getState()`.

## Code map

| Path | What it does |
|---|---|
| `src/sim/types.ts` | The event protocol between agent runtime and village |
| `src/sim/data.ts` | The scenario: shop, residents and their looks, stations, jobs |
| `src/sim/places.ts` | Station spots, seats, and walking routes around furniture |
| `src/sim/store.ts` | State (zustand) and the simulated runtime |
| `src/scene/materials.tsx` | Material library: fabric, skin, hair, wood, ceramic, aluminum, rugs |
| `src/scene/Person.tsx` | Procedural people: skeleton, clothing, hair, props, pose blending |
| `src/scene/Stations.tsx` | Furniture islands, lamps, the lounge and job board |
| `src/scene/Village.tsx` | Open floor, daylight, shadows, camera, post-processing |
| `src/ui/*` | Panels, deck, autonomy dial, hold-to-approve, sounds |
| `src/styles.css` | Design tokens and UI styles (light and dark) |

Built with React, three.js via react-three-fiber and drei, @react-three/postprocessing, and zustand.
