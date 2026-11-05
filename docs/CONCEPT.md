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
2. **Stations are tools.** An agent walking to the Post Counter *is* an email tool call. This makes invisible tool use visible.
3. **Friction proportional to consequence.** Low-risk actions just happen. Anything that goes public requires a physical ritual (hold-to-stamp).
4. **Progression = trust.** Agents earn autonomy from a real approval track record. Two clean approvals in a row unlock the next level. You still choose whether to turn the dial up.
5. **Village for noticing, ledger for reading.** One switch flips to a calm table of the same data.
6. **No dark patterns.** No streaks, energy timers, random rewards or daily-login hooks.
7. **Mood comes from real signals.** An avatar's expression reflects confidence, blocked or budget, never a made-up emotion.

## Mechanics map

| In the village | What it really is |
|---|---|
| Resident (dressed figure with signature prop) | An agent: role, memory, track record |
| Station (furniture island) | A connected tool or integration |
| Walking to a station | A live tool call |
| Station lamp on, warm pool on the floor | That tool is in use right now |
| Lounging on the sofa | Free for work |
| Job board by the sofa | The task queue |
| Holding up an orange folder at Rae's Desk | Waiting for your approval |
| Hand on head + yellow bubble | Error or retry |
| Thermal receipt from the deck printer | A finished deliverable, with cost and time |
| Autonomy dial (locked detents) | Permission level, earned through trust |
| Spent counter | Real token or dollar budget |

## Art direction: "the catalog render"

**v2, from reference images.** Minimal environments; the characters carry the scene. Think furniture-catalog isometric renders and a team photo shot top-down on seamless paper: people with real proportions, real clothes and one signature prop each, scattered across an open warm-white floor.

- **No world-building.** No terrain, no plinth. The page color *is* the floor. Each place is a small furniture island (rug, a few pieces of furniture, a lamp, a plant) floating in white space.
- **People first.** Residents are proportioned figures (about 1.75 m) with fabric clothing, skin, hair and a signature prop: Pip's notebook and glasses, Juno's beanie and camera, Scout's bun and backpack, Bea's tote. No faces; posture and silhouette carry identity.
- **Posture is state.** Lounging on the sofa = free. Typing, reading in the armchair, behind the camera, sorting at the counter = working, at that tool. Holding up an orange folder at Rae's desk = needs you. Hand on head = stuck. Arms up = delivered.
- **Lights on = tool in use.** Each station's lamp switches on and throws a warm pool on the floor while an agent works there.
- **Light.** Soft daylight from the upper left, long gentle shadows, strong contact shadows, ambient occlusion. Neutral tone mapping keeps the muted palette true.
- **Palette.** Warm white floor; muted furniture colors (oak, maroon, mocha, sky, sage, mustard, blush); signal orange (`#FF5A1F`) means exactly one thing: *this needs you or is happening now.*

**Materials as tokens.**

| Material | Used for | Meaning |
|---|---|---|
| Woven fabric (sheen) | Clothes, sofa, armchair | People and comfort |
| Skin and hair (soft sheen) | Residents | Identity |
| Oak, maroon and painted wood | Tables, shelves | Tools |
| Woven rugs (checker, stripe, border) | Station footprints | Place |
| Glazed ceramic | The shop's own products | The business itself |
| Frosted acrylic | UI panels, labels | Information |
| Anodized aluminum + rubber | Control deck, keys, dial | Your authority |
| Thermal paper / index cards | Receipts, job cards, documents | Real output |

**UI.** Frosted panels float over the set; the hardware deck (dot-matrix counter, rubber keys, receipt printer) stays as the one industrial object, Rae's control surface. Avatars are tiny portraits matching each resident's clothes, skin and hair.

**Type.** Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono (labels and data), Doto (dot-matrix counters).

**Sound.** Synthesized clicks, detents, a stamp thunk and receipt-printer chatter. Off by default.

## 3D pipeline without Blender

1. **Now: procedural shapes plus real materials and studio lighting** (this prototype). Physically based materials (clearcoat, sheen, transmission, anisotropic metal), procedural noise textures, a code-built softbox environment, ambient occlusion and selective bloom. Quality comes from materials and light, not polygon count.
2. **Next: AI image-to-3D for hero characters.** Art-direct residents as 2D turnaround sheets, generate rigged GLB files with an image-to-3D tool (Meshy, Tripo, Rodin), and drop them into `src/scene/Person.tsx`. The pose system already drives named joints (hips, knees, shoulders, elbows, head), so a rigged model can map onto it. Keep the procedural material system so generated models match the world.
3. **Later: an in-browser path tracer for hero stills** (marketing, onboarding, the "agent minted" moment) using the same scene.

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
6. **Hero characters** via image-to-3D

## What we're testing

1. A non-technical person sets up and runs an agent team faster here than in a list-and-chat tool.
2. People notice a blocked or waiting agent faster than in a list.
