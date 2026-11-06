# World art

Everything in `src/assets/world/` is rendered from here. Current art is a blockout at final scale.

```bash
pip install bpy pillow numpy   # Blender as a Python module; no Blender install needed
npx tsx scripts/export-layout.ts  # room layout from src/sim/data.ts → art/layout.json
python art/render.py plate --px 2880 --samples 48
python art/render.py cutouts --px 2880 --samples 32
python art/render.py heads
python art/render.py sprites
python art/pack.py
python art/navmap.py           # collision map; rerun whenever furniture moves
```

Delete `art/out/sprites` first if residents changed: finished frames are skipped so a stopped render can resume.

## Replacing the blockout

- **Stations and hangouts:** In `world.py`, replace a builder's contents with an imported GLB parented to `g`. Stations open toward local -z; hangouts face local +z, like `data.ts`. Seats must sit where `data.ts` puts each spot. Add a glowing material to `reg.lit[name]` to get a lit "busy" state.
- **Residents:** In `resident.py`, replace `build_resident()` and `pose()` with a rigged character and its actions. Each clip's direction and frame counts live in `CLIPS`, mirrored in `pack.py`.
- **Height:** Residents stand 1.5 units tall. Everything is scaled to that.
- **Moving furniture:** Edit `src/sim/data.ts`, rerun `export-layout.ts`, then rerun every render step and `navmap.py`.
- **Camera:** `CAM_POS` and `CAM_TARGET` in `common.py` must match `src/scene/view.ts`.

## Output

| File | Use |
|---|---|
| `plate.webp` | Whole world, including floor shadows |
| `cut_<piece>_idle.webp` | One piece of furniture, drawn over residents behind it. `pieces.py` splits furniture wherever footprints don't touch |
| `cut_<piece>_busy.webp` | Same with its lights on, crossfaded while its station is in use |
| `resident_<id>.webp` | Sprite sheet, with baked shadows |
| `head_<id>.webp` | Avatar for the panels |
| `manifest.json` | Where each goes, and the sprite grid |
| `nav.json` | Furniture seen from above, for collisions and depth order |
