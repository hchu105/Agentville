# World art

Everything in `src/assets/world/` is rendered from here. Current art is a blockout at final scale.

```bash
pip install bpy pillow numpy   # Blender as a Python module; no Blender install needed
python art/render.py plate --px 2880 --samples 48
python art/render.py cutouts --px 2880 --samples 32
python art/render.py heads
python art/render.py sprites
python art/pack.py
python art/navmap.py           # collision map; rerun whenever furniture moves
```

Delete `art/out/sprites` first if residents changed: finished frames are skipped so a stopped render can resume.

## Replacing the blockout

- **Stations:** In `world.py`, replace a builder's contents with an imported GLB parented to `g`. Keep the open side at local -z. Add any glowing material to `reg.lit[name]` to get a lit "busy" state.
- **Residents:** In `resident.py`, replace `build_resident()` and `pose()` with a rigged character and its actions. Each clip's direction and frame counts live in `CLIPS`, mirrored in `pack.py`.
- **Height:** Residents stand 1.5 units tall. Everything is scaled to that.
- **Moving a station:** Update `STATIONS` here, `STATIONS` in `pack.py`, and `x`, `z` and `stop` in `src/sim/data.ts`. Then rerun `navmap.py`.
- **Camera:** `CAM_POS` and `CAM_TARGET` in `common.py` must match `src/scene/view.ts`.

## Output

| File | Use |
|---|---|
| `plate.webp` | Whole world, including floor shadows |
| `cut_<station>_idle.webp` | Station alone, drawn over residents who stand behind it |
| `cut_<station>_busy.webp` | Same with its lights on, crossfaded while in use |
| `resident_<id>.webp` | Sprite sheet, with baked shadows |
| `head_<id>.webp` | Avatar for the panels |
| `manifest.json` | Where each goes, and the sprite grid |
| `nav.json` | Furniture seen from above, for collisions and depth order |
