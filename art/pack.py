"""Turn art/out/ renders into web assets in src/assets/world/ plus manifest.json."""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f'{HERE}/out'
DST = f'{HERE}/../src/assets/world'
PLATE_W, PLATE_H = 36.0, 22.5
CELL_PX, CELL_WORLD, ANCHOR = 256, 3.0, (0.5, 0.26)
import bpy  # noqa: F401  (bmesh needs bpy loaded first)
from resident import CLIPS as SPEC
CLIPS = {k: (v['dirs'], v['frames'], v['fps']) for k, v in SPEC.items()}
OFFSET = {k: v.get('offset', 0) for k, v in SPEC.items()}
SEAT = 0.44
CAST = ['pip', 'juno', 'scout', 'bea']
os.makedirs(DST, exist_ok=True)

# world image: blend the edges into one flat floor colour so it meets the stage
im = np.asarray(Image.open(f'{OUT}/plate.png').convert('RGB')).astype(np.float32)
h, w, _ = im.shape
edge = np.concatenate([im[:20].reshape(-1, 3), im[-20:].reshape(-1, 3), im[:, :20].reshape(-1, 3), im[:, -20:].reshape(-1, 3)])
floor = np.median(edge, axis=0)
yy, xx = np.mgrid[0:h, 0:w]
d = np.minimum.reduce([xx / w, 1 - xx / w, yy / h, 1 - yy / h])
m = np.clip(d / 0.12, 0, 1)[..., None]
m = m * m * (3 - 2 * m)
Image.fromarray((im * m + floor * (1 - m)).round().astype(np.uint8)).save(f'{DST}/plate.webp', quality=88, method=6)
hexf = '#%02x%02x%02x' % tuple(int(round(c)) for c in floor)

# furniture cutouts, one per piece
info = json.load(open(f'{OUT}/pieces.json'))
layers = {}
for name, p in info.items():
    x0, y0, x1, y1 = p['rect']
    fx0, fx1, fz0, fz1 = p['footprint']
    layers[name] = dict(
        u=((x0 + x1) / 2 - 0.5) * PLATE_W, v=((y0 + y1) / 2 - 0.5) * PLATE_H,
        w=(x1 - x0) * PLATE_W, h=(y1 - y0) * PLATE_H, group=p['group'],
        footprint=p['footprint'], depth=(fx0 + fx1 + fz0 + fz1) / 2,
        idle=f'cut_{name}_idle.webp',
    )
    Image.open(f'{OUT}/cut/{name}_idle.png').save(f'{DST}/cut_{name}_idle.webp', quality=90, method=6)
    if p['busy']:
        Image.open(f'{OUT}/cut/{name}_busy.png').save(f'{DST}/cut_{name}_busy.webp', quality=90, method=6)
        layers[name]['busy'] = f'cut_{name}_busy.webp'

# resident atlases
clips, n = {}, 0
for c, (dirs, frames, fps) in CLIPS.items():
    clips[c] = dict(start=n, dirs=dirs, frames=frames, fps=fps, offset=OFFSET[c])
    n += dirs * frames
cols = math.ceil(math.sqrt(n))
rows = math.ceil(n / cols)
sheets = {}
for rid in CAST:
    sheet = Image.new('RGBA', (cols * CELL_PX, rows * CELL_PX), (0, 0, 0, 0))
    for c, (dirs, frames, _) in CLIPS.items():
        for d in range(dirs):
            for f in range(frames):
                i = clips[c]['start'] + d * frames + f
                sheet.paste(Image.open(f'{OUT}/sprites/{rid}/{c}_{d}_{f}.png'), ((i % cols) * CELL_PX, (i // cols) * CELL_PX))
    sheet.save(f'{DST}/resident_{rid}.webp', quality=86, method=6)
    sheets[rid] = f'resident_{rid}.webp'
    Image.open(f'{OUT}/heads/{rid}.png').resize((128, 128), Image.LANCZOS).save(f'{DST}/head_{rid}.webp', quality=88)

json.dump(dict(floor=hexf, plate=dict(file='plate.webp', w=PLATE_W, h=PLATE_H, px=w / PLATE_W), layers=layers,
               sprites=dict(seat=SEAT, cellPx=CELL_PX, world=CELL_WORLD, anchor=ANCHOR, cols=cols, rows=rows, clips=clips, sheets=sheets)),
          open(f'{DST}/manifest.json', 'w'), indent=1)
print(hexf, n, 'frames per resident')
