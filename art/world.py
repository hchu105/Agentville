"""Blockout stations. Swap each builder's contents for imported AI meshes
(bpy.ops.wm.gltf import, parented to `g`) and nothing else needs to change.

Positions match BUILDINGS in src/sim/data.ts. Each builder puts its open side at
local -z. YAW turns that side along an iso axis so it reads from the camera.
"""
import math
import bpy
from common import *

FABRIC = lambda c: mat(c, 0.85, 'fabric')
WOOD = lambda c: mat(c, 0.5, 'wood')
PAINT = lambda c: mat(c, 0.55)
INK = '#2A2826'
SIGNAL = '#FF5A1F'

STATIONS = {
    'desk': (0.0, -5.2), 'lookout': (-5.4, -4.2), 'library': (5.3, -4.0),
    'studio': (-5.8, 1.6), 'post': (5.8, 1.4), 'market': (-1.2, 5.6),
}


# 180 deg opens toward +z (lower left on screen), -90 deg toward +x (lower right).
YAW = dict(desk=180, library=180, lookout=-90, studio=-90, post=180, market=180)


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
    box((1.0, 0.34, 0.8), (-0.75, 0.2, -0.45), FABRIC('#7E9A6A'), 0.12, g)
    box((1.0, 0.54, 0.2), (-0.75, 0.56, -0.08), FABRIC('#7E9A6A'), 0.09, g)
    box((0.3, 0.2, 0.3), (-0.75, 0.46, -0.5), FABRIC('#E3B23C'), 0.09, g, rot=(0.4, 0.2, 0))
    lamp(g, (0.5, 0, -0.1), '#F7EFE3', reg, 'library', h=1.35)
    cyl(0.28, 0.28, 0.035, (1.0, 0.42, -0.45), WOOD('#C2946A'), g)
    cyl(0.02, 0.1, 0.42, (1.0, 0.21, -0.45), WOOD('#8A6444'), g, seg=14)


def lookout(g, reg):
    cyl(1.4, 1.5, 0.16, (0, 0.08, 0.15), WOOD('#D8C3A5'), g, seg=72)
    for a in (0.5, 2.6, 4.7):
        cyl(0.02, 0.028, 1.15, (math.cos(a) * 0.26, 0.74, 0.3 + math.sin(a) * 0.26), WOOD('#7A5638'), g, seg=10,
            rot=(math.sin(a) * 0.22, math.cos(a) * 0.22, 0))
    p = empty((0, 1.3, 0.3), parent=g)
    p.rotation_euler = (math.radians(55), 0, 0)
    cyl(0.1, 0.13, 1.1, (0, 0, 0), PAINT('#EDE3D1'), p, seg=32)
    m = mat('#2A2826', 0.3, 'matte', emit='#FF7A3D')
    cyl(0.135, 0.135, 0.08, (0, 0.56, 0), m, p, seg=32)
    reg.lit.setdefault('lookout', []).append(m)
    cyl(0.06, 0.05, 0.16, (0, -0.6, 0), PAINT(INK), p, seg=20)
    box((0.42, 0.42, 0.42), (-0.9, 0.37, 0.75), WOOD('#B98E63'), 0.04, g)
    box((0.3, 0.05, 0.22), (-0.9, 0.6, 0.75), PAINT('#FAF7F0'), 0.01, g)
    cyl(0.2, 0.2, 0.05, (0.85, 0.42, 0.8), FABRIC('#E3B23C'), g)
    cyl(0.03, 0.03, 0.26, (0.85, 0.28, 0.8), PAINT(INK), g, seg=12)
    ball(0.24, (0.8, 0.42, -0.25), mat('#6E8FA8', 0.3), g)
    cyl(0.14, 0.17, 0.16, (0.8, 0.24, -0.25), WOOD('#7A5638'), g)


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
        cyl(0.012, 0.018, 0.95, (0.7 + math.cos(a) * 0.15, 0.48, -0.55 + math.sin(a) * 0.15), PAINT(INK), g, seg=8,
            rot=(math.sin(a) * 0.2, math.cos(a) * 0.2, 0))
    box((0.26, 0.19, 0.16), (0.7, 1.02, -0.55), PAINT(INK), 0.03, g)


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
    box((0.5, 0.36, 0.42), (1.75, 0.19, 0.0), WOOD('#C2946A'), 0.02, g)
    box((0.42, 0.3, 0.36), (1.72, 0.52, 0.02), WOOD('#B98E63'), 0.02, g, rot=(0, 0, 0.2))


def board(g, reg):
    cyl(1.05, 1.15, 0.2, (0, 0.1, 0), WOOD('#EDE3D1'), g, seg=72)
    for x in (-0.55, 0.55):
        cyl(0.05, 0.05, 1.55, (x, 0.85, 0), PAINT(INK), g, seg=14)
    box((1.3, 0.9, 0.08), (0, 1.15, 0), WOOD('#C89B6D'), 0.025, g)


BUILDERS = dict(desk=desk, library=library, lookout=lookout, studio=studio, post=post, market=market)
RUGS = {
    'desk': ((3.6, 2.4), '#D9D2B8', False), 'library': ((3.5, 2.6), '#8FA57F', False),
    'lookout': (2.1, '#CFC4B4', True), 'studio': ((3.7, 2.8), '#E9DFD2', False),
    'post': ((3.8, 2.3), '#CBB9D8', False), 'market': ((3.9, 2.5), '#E7D9B0', False),
}


def build_world(s):
    reg = Reg()
    floor = cyl(70, 70, 0.02, (0, -0.01, 0), mat(FLOOR, 0.9), seg=8)
    reg.flat.append(floor)
    reg.floor = floor
    for name, (x, z) in STATIONS.items():
        yaw = math.radians(YAW[name])
        g = empty((x, 0, z), yaw)
        BUILDERS[name](g, reg)
        mark(g, name, reg)
        size, color, round_ = RUGS[name]
        rug(reg, (x, z), size, color, round_)
        reg.flat[-1].rotation_euler = (0, 0, yaw)
    g = empty((0, 0, 0), math.pi / 4)
    board(g, reg)
    mark(g, 'board', reg)
    rug(reg, (0, 0), 2.5, '#E9E2D4', True)
    # scattered life, away from the walking routes
    p = empty()
    plant(p, (2.3, 0, 8.3), 1.5, '#7E9A6A')
    plant(p, (-8.3, 0, 5.2), 1.3)
    plant(p, (8.8, 0, -1.8), 1.4, '#B5532F')
    plant(p, (-2.8, 0, -8.6), 1.3)
    box((0.11, 0.03, 0.26), (-5.1, 0.02, 5.8), PAINT('#D98E62'), 0.012, p, rot=(0, 0, 0.3))
    box((0.11, 0.03, 0.26), (-4.8, 0.02, 5.75), PAINT('#D98E62'), 0.012, p, rot=(0, 0, -0.2))
    box((0.44, 0.03, 0.32), (4.0, 0.02, 6.2), PAINT('#3E5C6E'), 0.008, p, rot=(0, 0, 0.5))
    return reg
