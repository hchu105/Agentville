"""Blockout stations and hangouts. Swap a builder's contents for imported AI
meshes (bpy.ops.import_scene.gltf, parented to `g`) and nothing else changes.

The room comes from art/layout.json, exported from src/sim/data.ts by
scripts/export-layout.ts, so furniture always sits where the sim walks.
Station builders put their open side at local -z (turned by rot + 180 deg);
hangout builders put their front at local +z, as data.ts does.
"""
import json
import math
import os
import bpy
from common import *

LAYOUT = json.load(open(os.path.join(os.path.dirname(__file__), 'layout.json')))

FABRIC = lambda c: mat(c, 0.85, 'fabric')
WOOD = lambda c: mat(c, 0.5, 'wood')
PAINT = lambda c: mat(c, 0.55)
INK = '#2A2826'
SIGNAL = '#FF5A1F'



class Reg:
    """Which objects belong to which layer."""
    def __init__(self):
        self.groups = {}   # name -> [solid objects]
        self.flat = []     # rugs and floor: stay in the plate
        self.lit = {}      # name -> emissive materials


def mark(root, name, reg):
    def walk(o):
        yield o
        for c in o.children:
            yield from walk(c)
    reg.groups[name] = [o for o in walk(root)]


def lamp(g, pos, shade, reg, name, emit='#FFD9A8', h=1.25):
    x, _, z = pos
    cyl(0.12, 0.15, 0.03, (x, 0.02, z), PAINT(INK), g)
    cyl(0.012, 0.012, h, (x, h / 2, z), PAINT(INK), g, seg=10)
    m = mat(shade, 0.5, 'matte', emit=emit)
    ball(0.15, (x, h + 0.08, z), m, g)
    reg.lit.setdefault(name, []).append(m)


def plant(g, pos, s=1.0, pot='#D9C7AE'):
    x, y, z = pos
    cyl(0.14 * s, 0.19 * s, 0.26 * s, (x, y + 0.13 * s, z), mat(pot, 0.4), g)
    leaf = mat('#4F7350', 0.5)
    for i in range(14):
        a = i * 2.4
        r = 0.05 + 0.024 * i
        ball(0.12 * s, (x + math.cos(a) * r * s, y + (0.32 + i * 0.038) * s, z + math.sin(a) * r * s), leaf, g, (1.3, 0.28, 0.6))


def rug(reg, pos, sz, color, round_=False):
    x, z = pos
    if round_:
        o = cyl(sz, sz, 0.02, (x, 0.012, z), FABRIC(color), seg=64)
    else:
        o = box((sz[0], 0.02, sz[1]), (x, 0.012, z), FABRIC(color), r=0.008)
    reg.flat.append(o)
    return o


def desk(g, reg):
    top = WOOD('#C2946A')
    box((2.1, 0.07, 0.9), (0, 0.62, 0.2), top, 0.03, g)
    for x in (-0.95, 0.95):
        for z in (-0.18, 0.58):
            cyl(0.03, 0.022, 0.6, (x, 0.3, z), WOOD('#8A6444'), g, seg=12)
    # paper tray and approval stamp: the place you say yes
    box((0.34, 0.05, 0.26), (-0.55, 0.685, 0.15), PAINT('#F4EDE0'), 0.012, g)
    box((0.72, 0.42, 0.04), (0.2, 0.92, 0.42), PAINT(INK), 0.02, g)
    m = mat('#203040', 0.3, 'matte', emit='#FFB98A')
    box((0.66, 0.36, 0.01), (0.2, 0.92, 0.395), m, 0, g)
    reg.lit.setdefault('desk', []).append(m)
    cyl(0.05, 0.1, 0.2, (0.2, 0.75, 0.42), PAINT(INK), g, seg=16)
    cyl(0.045, 0.04, 0.1, (0.72, 0.71, 0.1), mat(SIGNAL, 0.35), g, seg=20)
    box((0.62, 0.1, 0.6), (0, 0.42, 0.98), FABRIC('#4F6D8A'), 0.05, g)
    box((0.62, 0.62, 0.1), (0, 0.76, 1.26), FABRIC('#4F6D8A'), 0.05, g)
    cyl(0.04, 0.05, 0.38, (0, 0.19, 0.98), PAINT(INK), g, seg=12)
    plant(g, (1.45, 0, 0.75), 1.25)
    lamp(g, (-1.4, 0, 0.8), '#F7EFE3', reg, 'desk')


def library(g, reg):
    shelf = WOOD('#A77C58')
    W, H, D = 2.7, 1.9, 0.42
    z = 0.75
    box((W, H, 0.04), (0, H / 2, z + D / 2), shelf, 0.01, g)
    for x in (-W / 2, -W / 6, W / 6, W / 2):
        box((0.05, H, D), (x, H / 2, z), shelf, 0.012, g)
    cols = ['#B5532F', '#3E5C6E', '#E3B23C', '#7E9A6A', '#EDE3D1', '#8C8FE0', '#D98E62', '#2A2826']
    n = 0
    for lvl in range(4):
        y = 0.04 + lvl * (H - 0.08) / 4
        box((W, 0.04, D), (0, y, z), shelf, 0.01, g)
        for bay in range(3):
            x = -W / 2 + 0.09 + bay * W / 3
            end = x + W / 3 - 0.18
            while x < end:
                n += 1
                t = 0.05 + (n * 7 % 5) * 0.016
                h = 0.26 + (n * 3 % 5) * 0.025
                box((t, h, 0.26), (x + t / 2, y + 0.02 + h / 2, z - 0.02), PAINT(cols[n * 5 % len(cols)]), 0.006, g)
                x += t + 0.006
    box((0.8, 0.36, 0.7), (-0.75, 0.2, -0.38), FABRIC('#7E9A6A'), 0.12, g)
    box((0.8, 0.6, 0.18), (-0.75, 0.56, -0.02), FABRIC('#7E9A6A'), 0.08, g)
    for x in (-1.2, -0.3):
        box((0.14, 0.52, 0.7), (x, 0.28, -0.32), FABRIC('#7E9A6A'), 0.06, g)
    lamp(g, (0.5, 0, -0.1), '#F7EFE3', reg, 'library', h=1.35)
    cyl(0.28, 0.28, 0.035, (1.0, 0.42, -0.45), WOOD('#C2946A'), g)
    cyl(0.02, 0.1, 0.42, (1.0, 0.21, -0.45), WOOD('#8A6444'), g, seg=14)


def lookout(g, reg):
    for a in (0.5, 2.6, 4.7):
        cyl(0.02, 0.028, 1.15, (math.cos(a) * 0.26, 0.58, 0.3 + math.sin(a) * 0.26), WOOD('#7A5638'), g, seg=10,
            rot=(math.sin(a) * 0.22, math.cos(a) * 0.22, 0))
    p = empty((0, 1.14, 0.3), parent=g)
    p.rotation_euler = (math.radians(55), 0, 0)
    cyl(0.1, 0.13, 1.1, (0, 0, 0), PAINT('#EDE3D1'), p, seg=32)
    m = mat('#2A2826', 0.3, 'matte', emit='#FF7A3D')
    cyl(0.135, 0.135, 0.08, (0, 0.56, 0), m, p, seg=32)
    reg.lit.setdefault('lookout', []).append(m)
    cyl(0.06, 0.05, 0.16, (0, -0.6, 0), PAINT(INK), p, seg=20)
    box((0.42, 0.42, 0.42), (-0.9, 0.21, 0.75), WOOD('#B98E63'), 0.04, g)
    box((0.3, 0.05, 0.22), (-0.9, 0.44, 0.75), PAINT('#FAF7F0'), 0.01, g)
    ball(0.24, (0.95, 0.42, 0.55), mat('#6E8FA8', 0.3), g)
    cyl(0.14, 0.17, 0.16, (0.95, 0.08, 0.55), WOOD('#7A5638'), g)
    plant(g, (-1.0, 0, -0.5), 1.0)


def studio(g, reg):
    paper = mat('#D98E62', 0.8)
    box((2.9, 2.0, 0.04), (0, 1.0, 0.95), paper, 0.01, g)
    box((2.9, 0.03, 1.5), (0, 0.03, 0.22), paper, 0.01, g)
    for x in (-1.5, 1.5):
        cyl(0.018, 0.018, 2.2, (x, 1.1, 0.95), PAINT(INK), g, seg=10)
    box((3.2, 0.04, 0.04), (0, 2.18, 0.95), PAINT(INK), 0.01, g)
    # the subject: a mug on a plinth
    box((0.55, 0.46, 0.55), (0, 0.27, 0.35), PAINT('#F4EDE0'), 0.03, g)
    cyl(0.1, 0.09, 0.2, (0, 0.6, 0.35), mat('#3E5C6E', 0.15), g, seg=32)
    # softbox
    cyl(0.02, 0.02, 1.7, (-1.25, 0.85, -0.3), PAINT(INK), g, seg=10)
    cyl(0.2, 0.2, 0.02, (-1.25, 0.03, -0.3), PAINT(INK), g, seg=16)
    m = mat('#FFFFFF', 0.4, 'matte', emit='#FFF3DD')
    box((0.72, 0.56, 0.1), (-1.25, 1.7, -0.3), m, 0.03, g, rot=(0.5, 0, 0.6))
    reg.lit.setdefault('studio', []).append(m)
    # camera on tripod
    for a in (0.5, 2.6, 4.7):
        cyl(0.012, 0.018, 0.95, (math.cos(a) * 0.15, 0.48, -0.8 + math.sin(a) * 0.15), PAINT(INK), g, seg=8,
            rot=(math.sin(a) * 0.2, math.cos(a) * 0.2, 0))
    box((0.26, 0.19, 0.16), (0, 1.02, -0.8), PAINT(INK), 0.03, g)


def post(g, reg):
    box((2.5, 0.72, 0.6), (0, 0.36, 0.1), WOOD('#EDE3D1'), 0.03, g)
    box((2.65, 0.05, 0.72), (0, 0.74, 0.1), WOOD('#B5532F'), 0.02, g)
    wall = WOOD('#A77C58')
    box((2.5, 1.7, 0.3), (0, 0.85, 1.0), wall, 0.02, g)
    pal = ['#EDE3D1', '#D98E62', '#FAF7F0', '#C2946A']
    for r in range(4):
        for c in range(7):
            box((0.26, 0.26, 0.04), (-1.02 + c * 0.34, 0.42 + r * 0.36, 0.84), PAINT('#6E5038'), 0.01, g)
            if (r * 3 + c * 2) % 3:
                box((0.21, 0.13, 0.03), (-1.02 + c * 0.34, 0.37 + r * 0.36, 0.81), PAINT(pal[(r + c) % 4]), 0.005, g)
    for i, (x, sz, c) in enumerate([(-0.75, 0.3, '#C2946A'), (-0.38, 0.24, '#D8B98C'), (0.7, 0.36, '#C2946A')]):
        box((sz * 1.1, sz * 0.7, sz), (x, 0.77 + sz * 0.35, 0.1), PAINT(c), 0.015, g, rot=(0, 0, i * 0.3))
    cyl(0.03, 0.03, 0.8, (-1.7, 0.4, -0.35), PAINT(INK), g, seg=12)
    box((0.38, 0.32, 0.5), (-1.7, 0.95, -0.35), mat(SIGNAL, 0.4), 0.09, g)
    m = mat('#FFFFFF', 0.4, 'matte', emit='#FFC27A')
    ball(0.1, (0.05, 1.82, 0.84), m, g)
    reg.lit.setdefault('post', []).append(m)
    plant(g, (1.65, 0, 0.4), 1.15, '#B5532F')


def market(g, reg):
    wood = WOOD('#8A6444')
    for x in (-1.2, 1.2):
        for z in (-0.5, 0.65):
            cyl(0.03, 0.03, 1.9, (x, 0.95, z), PAINT(INK), g, seg=12)
    n = 9
    for i in range(n):
        c = '#E8664A' if i % 2 else '#FAF3E8'
        b = (2.86 / n)
        box((b, 0.03, 1.6), (-1.43 + b * (i + 0.5), 1.97, 0.07), FABRIC(c), 0.012, g, rot=(0.14, 0, 0))
    box((2.4, 0.62, 0.8), (0, 0.32, 0.28), wood, 0.02, g)
    box((2.5, 0.04, 0.9), (0, 0.65, 0.28), WOOD('#D8B98C'), 0.015, g)
    glaze = ['#3E5C6E', '#7E9A6A', '#EDE3D1', '#B5532F', '#E3B23C', '#8C8FE0']
    for i in range(11):
        x = -1.05 + i * 0.21
        z = 0.1 + (i % 3) * 0.17
        cyl(0.07, 0.06, 0.16, (x, 0.75, z), mat(glaze[i % 6], 0.14), g, seg=24)
    m = mat('#FFFFFF', 0.4, 'matte', emit='#FFC27A')
    for x in (-0.8, 0, 0.8):
        ball(0.055, (x, 1.72, -0.35), m, g)
    reg.lit.setdefault('market', []).append(m)
    stool(g, (-0.2, -0.6), 0.46)
    box((0.5, 0.36, 0.42), (1.75, 0.19, 0.0), WOOD('#C2946A'), 0.02, g)
    box((0.42, 0.3, 0.36), (1.72, 0.52, 0.02), WOOD('#B98E63'), 0.02, g, rot=(0, 0, 0.2))


def stool(g, pos, h, color='#C2946A'):
    x, z = pos
    cyl(0.19, 0.19, 0.05, (x, h - 0.025, z), WOOD(color), g)
    for a in (0.4, 2.5, 4.6):
        cyl(0.016, 0.02, h - 0.05, (x + math.cos(a) * 0.12, (h - 0.05) / 2, z + math.sin(a) * 0.12), WOOD('#8A6444'), g, seg=8)


def sofa(g, w, z, color, seat=0.44, depth=0.85):
    """Front faces +z. People sit centred at `z` with the seat top at `seat`."""
    f = FABRIC(color)
    box((w, seat - 0.14, depth), (0, (seat - 0.14) / 2 + 0.06, z + 0.05), f, 0.08, g)
    n = max(1, round(w / 0.8))
    for i in range(n):
        cw = (w - 0.3) / n
        box((cw - 0.02, 0.14, depth - 0.2), (-w / 2 + 0.15 + cw * (i + 0.5), seat - 0.07, z + 0.13), f, 0.06, g)
    box((w, 0.5, 0.24), (0, seat + 0.18, z - depth / 2 + 0.17), f, 0.1, g)
    for x in (-w / 2 + 0.09, w / 2 - 0.09):
        box((0.2, seat + 0.12, depth), (x, (seat + 0.12) / 2, z + 0.05), f, 0.08, g)
    for x in (-w / 2 + 0.1, w / 2 - 0.1):
        for dz in (-depth / 2 + 0.1, depth / 2 - 0.05):
            cyl(0.025, 0.02, 0.06, (x, 0.03, z + 0.05 + dz), PAINT(INK), g, seg=8)


def chair(g, pos, h, yaw, color='#C2946A'):
    """A dining chair whose sitter faces `yaw` (sim heading)."""
    c = empty((pos[0], 0, pos[1]), yaw, g)
    box((0.44, 0.05, 0.42), (0, h - 0.025, 0), WOOD(color), 0.015, c)
    box((0.44, 0.42, 0.04), (0, h + 0.2, -0.2), WOOD(color), 0.015, c)
    for x in (-0.19, 0.19):
        for z in (-0.18, 0.18):
            cyl(0.018, 0.018, h - 0.05, (x, (h - 0.05) / 2, z), WOOD('#8A6444'), c, seg=8)


def lounge(g, reg):
    sofa(g, 3.4, -0.5, '#B3876C', 0.44, 0.95)
    for x, c in ((-1.2, '#E3B23C'), (0.9, '#3E5C6E')):
        box((0.36, 0.34, 0.12), (x, 0.66, -0.78), FABRIC(c), 0.08, g, rot=(0.25, 0, 0.1))
    cyl(0.55, 0.55, 0.05, (0, 0.38, 0.75), WOOD('#C2946A'), g, seg=48)
    cyl(0.05, 0.25, 0.36, (0, 0.18, 0.75), WOOD('#8A6444'), g, seg=20)
    box((0.3, 0.04, 0.22), (0.1, 0.42, 0.7), PAINT('#3E5C6E'), 0.008, g, rot=(0, 0, 0.3))
    cyl(0.05, 0.045, 0.1, (-0.2, 0.46, 0.8), mat('#EDE3D1', 0.2), g, seg=20)
    plant(g, (-2.15, 0, -0.75), 1.5, '#B5532F')
    lamp(g, (2.0, 0, -0.95), '#F7EFE3', reg, 'lounge', h=1.4)


def board_at(g, reg, pos):
    b = empty((pos[0], 0, pos[1]), 0, g)
    box((0.7, 0.06, 0.45), (0, 0.03, 0), WOOD('#EDE3D1'), 0.02, b)
    for x in (-0.55, 0.55):
        cyl(0.03, 0.03, 1.55, (x, 0.8, 0), PAINT(INK), b, seg=12)
    box((1.3, 0.9, 0.06), (0, 1.15, 0), WOOD('#C89B6D'), 0.02, b)
    return b


def cafe(g, reg):
    box((1.9, 0.98, 0.5), (0, 0.49, -0.15), WOOD('#EDE3D1'), 0.03, g)
    box((2.0, 0.05, 0.58), (0, 1.0, -0.15), WOOD('#8A6444'), 0.02, g)
    box((0.42, 0.42, 0.36), (-0.45, 1.24, -0.25), PAINT('#B5532F'), 0.05, g)
    cyl(0.04, 0.04, 0.12, (-0.45, 1.08, -0.02), PAINT(INK), g, seg=12)
    for i, c in enumerate(('#EDE3D1', '#3E5C6E', '#7E9A6A')):
        cyl(0.045, 0.04, 0.1, (0.25 + i * 0.16, 1.08, -0.1), mat(c, 0.15), g, seg=20)
    box((1.6, 0.8, 0.04), (0, 1.75, -0.42), PAINT('#2A2826'), 0.02, g)
    for r in range(3):
        box((1.1, 0.04, 0.01), (-0.1, 1.95 - r * 0.18, -0.395), PAINT('#EDE3D1'), 0.003, g)
    plant(g, (1.25, 0, -0.3), 1.2)


def meeting(g, reg, spots):
    cyl(0.6, 0.6, 0.05, (0, 0.74, 0), WOOD('#7A3B2E'), g, seg=56)
    cyl(0.07, 0.07, 0.72, (0, 0.36, 0), PAINT(INK), g, seg=16)
    cyl(0.32, 0.36, 0.04, (0, 0.02, 0), PAINT(INK), g, seg=32)
    for s in spots:
        chair(g, (s['x'], s['z']), s['seat'], s['h'])
    box((0.3, 0.03, 0.22), (0.15, 0.78, 0.05), PAINT('#FAF7F0'), 0.006, g, rot=(0, 0, 0.4))
    cyl(0.05, 0.045, 0.1, (-0.2, 0.82, -0.1), mat('#E3B23C', 0.15), g, seg=20)


def records(g, reg, spots):
    box((1.5, 0.72, 0.45), (-0.3, 0.36, -0.15), WOOD('#A77C58'), 0.02, g)
    pal = ['#B5532F', '#3E5C6E', '#E3B23C', '#EDE3D1', '#7E9A6A', '#8C8FE0']
    for i in range(14):
        box((0.02, 0.3, 0.3), (-0.95 + i * 0.05, 0.2, -0.12), PAINT(pal[i % 6]), 0.003, g)
    box((0.5, 0.08, 0.4), (-0.6, 0.76, -0.15), PAINT('#EDE3D1'), 0.015, g)
    cyl(0.17, 0.17, 0.015, (-0.6, 0.81, -0.15), PAINT(INK), g, seg=36)
    box((0.3, 0.3, 0.3), (0.15, 0.87, -0.2), PAINT(INK), 0.05, g)
    s = spots[1]
    a = empty((s['x'], 0, s['z']), s['h'], g)
    box((0.8, 0.3, 0.72), (0, 0.27, 0.0), FABRIC('#D98E62'), 0.12, a)
    box((0.8, 0.55, 0.18), (0, 0.6, -0.32), FABRIC('#D98E62'), 0.08, a)
    for x in (-0.42, 0.42):
        box((0.14, 0.48, 0.72), (x, 0.3, 0.0), FABRIC('#D98E62'), 0.06, a)
    plant(g, (0.9, 0, -0.45), 1.3)


def beanbags(g, reg, spots):
    cols = ['#E3B23C', '#7E9A6A', '#3E5C6E']
    for s, c in zip(spots, cols):
        b = empty((s['x'], 0, s['z']), s['h'], g)
        ball(0.46, (0, 0.2, -0.05), FABRIC(c), b, (1.0, 0.48, 1.0))
        ball(0.38, (0, 0.42, -0.32), FABRIC(c), b, (1.0, 0.75, 0.55))
    cyl(0.28, 0.28, 0.32, (0, 0.16, 0), WOOD('#EDE3D1'), g, seg=32)
    cyl(0.05, 0.045, 0.1, (0.05, 0.37, 0), mat('#B5532F', 0.15), g, seg=20)


def nook(g, reg):
    sofa(g, 1.9, -0.3, '#E7A9A0', 0.44, 0.85)
    lamp(g, (1.25, 0, -0.55), '#F7EFE3', reg, 'nook', h=1.35)
    cyl(0.25, 0.25, 0.04, (-1.3, 0.48, 0.0), WOOD('#C2946A'), g, seg=36)
    cyl(0.02, 0.12, 0.48, (-1.3, 0.24, 0.0), WOOD('#8A6444'), g, seg=14)
    plant(g, (0.0, 0, -1.2), 1.4)


def bench(g, reg):
    box((1.55, 0.06, 0.44), (0, 0.42, 0), WOOD('#C2946A'), 0.02, g)
    for x in (-0.65, 0.65):
        box((0.06, 0.4, 0.38), (x, 0.2, 0), WOOD('#8A6444'), 0.01, g)
    plant(g, (-1.15, 0, -0.1), 1.2, '#7E9A6A')
    plant(g, (1.15, 0, -0.15), 1.0)


BUILDERS = dict(desk=desk, library=library, lookout=lookout, studio=studio, post=post, market=market)
ISLANDS = dict(lounge=lounge, cafe=cafe, meeting=meeting, records=records, beanbags=beanbags, nook=nook, bench=bench)
RUGS = {
    'desk': ((3.6, 2.4), '#D9D2B8', False), 'library': ((3.5, 2.6), '#8FA57F', False),
    'lookout': (1.6, '#CFC4B4', True), 'studio': ((3.7, 2.8), '#E9DFD2', False),
    'post': ((3.8, 2.3), '#CBB9D8', False), 'market': ((3.9, 2.5), '#E7D9B0', False),
    'lounge': ((5.0, 3.0), '#E2D6C2', False), 'cafe': ((2.6, 1.8), '#C9D3C0', False),
    'meeting': (1.85, '#E7D9B0', True), 'records': ((2.8, 1.9), '#D9C7AE', False),
    'beanbags': (1.8, '#EDE3D1', True), 'nook': ((2.6, 1.8), '#F0D9CC', False), 'bench': ((2.4, 1.2), '#D9D2B8', False),
}
# Where the job board stands in the lounge (lounge-local x, z). Mirrored in src/scene/Village.tsx.
BOARD_AT = (2.75, -0.35)


def build_world(s):
    reg = Reg()
    floor = cyl(70, 70, 0.02, (0, -0.01, 0), mat(FLOOR, 0.9), seg=8)
    reg.flat.append(floor)
    reg.floor = floor
    for st in LAYOUT['stations']:
        name, x, z = st['id'], st['x'], st['z']
        g = empty((x, 0, z), st['rot'] + math.pi)
        BUILDERS[name](g, reg)
        mark(g, name, reg)
        size, color, round_ = RUGS[name]
        rug(reg, (x, z), size, color, round_)
        reg.flat[-1].rotation_euler = (0, 0, st['rot'])
    for isl in LAYOUT['islands']:
        name, x, z = isl['id'], isl['x'], isl['z']
        g = empty((x, 0, z), isl['rot'])
        fn = ISLANDS[name]
        fn(g, reg, isl['spots']) if fn.__code__.co_argcount == 3 else fn(g, reg)
        mark(g, name, reg)
        if name == 'lounge':
            b = board_at(None, reg, (x + BOARD_AT[0], z + BOARD_AT[1]))
            mark(b, 'board', reg)
        size, color, round_ = RUGS[name]
        rug(reg, (x, z), size, color, round_)
        reg.flat[-1].rotation_euler = (0, 0, isl['rot'])
    p = empty()
    for pos, s_, pot in (((-9.6, 1.6), 1.5, '#7E9A6A'), ((10.6, -0.6), 1.4, '#B5532F'), ((-4.5, -9.4), 1.3, '#D9C7AE'),
                         ((4.4, -9.0), 1.4, '#D9C7AE'), ((-1.6, 10.4), 1.3, '#B5532F')):
        plant(p, (pos[0], 0, pos[1]), s_, pot)
    mark(p, 'props', reg)
    box((0.11, 0.03, 0.26), (0.9, 0.02, 2.4), PAINT('#D98E62'), 0.012, rot=(0, 0, 0.3))
    box((0.11, 0.03, 0.26), (1.2, 0.02, 2.35), PAINT('#D98E62'), 0.012, rot=(0, 0, -0.2))
    box((0.44, 0.03, 0.32), (-1.0, 0.02, -2.6), PAINT('#3E5C6E'), 0.008, rot=(0, 0, 0.5))
    return reg
