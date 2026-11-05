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
PLATE_W, PLATE_H = 30.0, 18.75
STATIONS = dict(desk=(0.0, -5.2), lookout=(-5.4, -4.2), library=(5.3, -4.0), studio=(-5.8, 1.6),
                post=(5.8, 1.4), market=(-1.2, 5.6), board=(0.0, 0.0))
CELL_PX, CELL_WORLD, ANCHOR = 256, 3.0, (0.5, 0.26)
CLIPS = dict(walk=(8, 6, 10), idle=(4, 3, 2), working=(4, 3, 6), waiting=(4, 3, 3), blocked=(4, 3, 3), celebrating=(4, 3, 8))
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

# station cutouts
rects = json.load(open(f'{OUT}/rects.json'))
layers = {}
for name, (x0, y0, x1, y1) in rects.items():
    s = STATIONS[name]
    layers[name] = dict(
        u=((x0 + x1) / 2 - 0.5) * PLATE_W, v=((y0 + y1) / 2 - 0.5) * PLATE_H,
        w=(x1 - x0) * PLATE_W, h=(y1 - y0) * PLATE_H, depth=s[0] + s[1],
        idle=f'cut_{name}_idle.webp',
    )
    Image.open(f'{OUT}/cut_{name}_idle.png').save(f'{DST}/cut_{name}_idle.webp', quality=90, method=6)
    if os.path.exists(f'{OUT}/cut_{name}_busy.png'):
        Image.open(f'{OUT}/cut_{name}_busy.png').save(f'{DST}/cut_{name}_busy.webp', quality=90, method=6)
        layers[name]['busy'] = f'cut_{name}_busy.webp'

# resident atlases
clips, n = {}, 0
for c, (dirs, frames, fps) in CLIPS.items():
    clips[c] = dict(start=n, dirs=dirs, frames=frames, fps=fps)
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

json.dump(dict(floor=hexf, plate=dict(file='plate.webp', w=PLATE_W, h=PLATE_H), layers=layers,
               sprites=dict(cellPx=CELL_PX, world=CELL_WORLD, anchor=ANCHOR, cols=cols, rows=rows, clips=clips, sheets=sheets)),
          open(f'{DST}/manifest.json', 'w'), indent=1)
print(hexf, n, 'frames per resident')
