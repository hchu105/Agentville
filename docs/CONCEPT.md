# Agentville: concept brief

## Thesis

Chat is built for one person and one assistant taking turns. Agent teams are many workers running in parallel and mostly unattended, and you need to know at a glance who is busy, who is stuck, and who needs you. Strategy, farm and idle games have solved "many units working in parallel, glanceable status, interrupt when needed" for 30 years. Agentville borrows that grammar so a small business can run an agent team without reading logs.

## Who it's for (v1)

**Small businesses.** The reference user is **Rae**, who runs website and branding at **Moss & Kiln**, a five-person ceramics shop on Etsy. Rae runs four agents:

| Resident | Role | Typical jobs |
|---|---|---|
| Pip | Copywriter | Listings, product stories, SEO titles |
| Juno | Photo editor | Retouching, banners, consistent shop look |
| Scout | Researcher | Competitor pricing, trends, search terms |
| Bea | Mail & social | Newsletter, customer replies, posts |

Later this extends to larger businesses (multiple villages = teams, a region map = org).

## Design rules

1. **Every game element maps to a real agent state or action.** No idle animations that pretend work is happening.
2. **Buildings are tools.** An agent walking to the Post Office *is* an email tool call. This makes invisible tool use visible.
3. **Friction proportional to consequence.** Low-risk actions just happen. Anything that goes public requires a physical ritual (hold-to-stamp).
4. **Progression = trust.** Agents earn autonomy from a real approval track record. Two clean approvals in a row unlock the next level. You still choose whether to turn the dial up.
5. **Village for noticing, ledger for reading.** One switch flips to a calm table of the same data.
6. **No dark patterns.** No streaks, energy timers, random rewards or daily-login hooks.
7. **Mood comes from real signals.** An avatar's expression reflects confidence, blocked or budget, never a made-up emotion.

## Mechanics map

| In the village | What it really is |
|---|---|
| Resident (a person dressed in their color) | An agent: role, memory, track record |
| Building | A connected tool or integration |
| Walking to a building | A live tool call |
| Pulsing orange LED on a building | That tool is in use right now |
| Job board in the town square | The task queue |
| Resident holding an orange sign at Rae's Desk | Waiting for your approval |
| Yellow "stuck" bubble | Error or retry |
| Thermal receipt from the deck printer | A finished deliverable, with cost and time |
| Autonomy dial (locked detents) | Permission level, earned through trust |
| Spent counter | Real token or dollar budget |

## Art direction: "a calm studio inside a precision instrument"

The world is **warm and lived-in**: realistic people among soft furniture on a seamless off-white floor, photographed like a design catalogue. The controls are **precise and industrial**: anodized aluminum, rubber keys, a dot-matrix display, one signal orange. The split carries meaning: human agents, serious consequences.

**Materials as tokens.** Each has one job:

| Material | Used for | Meaning |
|---|---|---|
| Woven fabric and everyday clothes | Residents | Personality |
| Rugs, soft furnishings, plants | Stations and floor | The world |
| Oak and painted wood | Station furniture | Tools |
| Frosted acrylic with lit edge | Panels, glass, labels | Information |
| Anodized aluminum + rubber | Deck, keys, dial | Your authority |
| Thermal paper / index cards | Receipts, job cards, documents | Real output |
| Glazed ceramic | The shop's own products | The business itself |

**3D for identity and moments, 2D for information.** The rendered world is reserved for the residents, stations and hero moments (delivery, level-up). Dense information is always flat, readable UI.

**Signal orange** (`#FF5A1F`) means exactly one thing: *this needs you or is happening now.*

**Type.** Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono (labels and data), Doto (dot-matrix counters).

**Sound.** Synthesized clicks, detents, a stamp thunk and receipt-printer chatter. Off by default.

## World pipeline

The world is prerendered, not rendered live. Blender Cycles renders one locked orthographic view and the browser composites the results, so soft light, shadows and fabric look the same on every device.

1. **`art/` renders the world.** `render.py` builds stations and residents, and `pack.py` writes web assets and `manifest.json` to `src/assets/world/`. See [art/README.md](../art/README.md).
2. **Current art is a blockout.** Stations are Blender primitives and residents are mannequins, at final scale and in final positions, so the engine is real while the art is not.
3. **Next: AI-generated meshes.** Generate stations with Tripo or Rodin and residents with Meshy, then replace the matching builders in `art/world.py` and `art/resident.py`. Use shared Blender materials instead of AI textures, so the set looks like one world.

Nothing in `src/sim` depends on this. Each station's position, stop and gate live in `src/sim/data.ts`.

## Architecture

```
Agent runtime ──events──▶ store (event log + state) ──▶ village (3D) + panels (2D)
```

- `src/sim/types.ts` is the protocol: steps (`tool`, `approval`, `hiccup`, `deliver`), activities and events.
- `src/sim/store.ts` holds state and a **simulated runtime**. Replacing it with a real runtime (Claude with tool use, one tool per building) only needs to emit the same events.
- `src/scene/*` renders; it never decides anything.

## Roadmap

1. **Diorama + simulated agents** ✅ (this prototype)
2. **Real agent:** wire Pip to Claude with three tools (read brand guide, keyword research, draft listing; publishing stays mocked behind approval)
3. **Hire flow:** a capsule machine where you dial in role, tone and starting autonomy, with a 3D "minting" moment
4. **Build flow:** connecting an integration = placing a building
5. **Overnight mode:** real day/night; lit windows mean work in progress; morning receipt roll as the daily digest
6. **Final art:** AI-generated stations and residents in place of the blockout

## What we're testing

1. A non-technical person sets up and runs an agent team faster here than in a list-and-chat tool.
2. People notice a blocked or waiting agent faster than in a list.
