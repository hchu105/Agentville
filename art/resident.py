"""Placeholder residents: person-scaled mannequins in the agreed cast's outfits.
Swap for rigged Meshy characters by replacing build_resident() and pose()
with an imported armature and its actions; the frame grid stays the same.
"""
import math
import random
from common import *

CELL_PX = 256
CELL_WORLD = 3.0
ANCHOR = (0.5, 0.26)  # feet position in the cell, from bottom-left

# Headings use the sim's convention: atan2(dx, dz), so 0 faces +z.
HEADINGS = {
    8: [i * math.pi / 4 for i in range(8)],
    4: [i * math.pi / 2 for i in range(4)],
}
CLIPS = {
    'walk': dict(dirs=8, frames=6, fps=7),  # matches stride to WALK_SPEED
    'idle': dict(dirs=4, frames=3, fps=2),
    'working': dict(dirs=4, frames=3, fps=6),
    'waiting': dict(dirs=4, frames=3, fps=3),
    'blocked': dict(dirs=4, frames=3, fps=3),
    'celebrating': dict(dirs=4, frames=3, fps=8),
}

CAST = {
    'pip': dict(skin='#8D5B3F', top='#E8664A', inner='#F3EBDD', legs='#27324A', shoe='#EDE7DC', hair='#17120F', style='curls'),
    'juno': dict(skin='#5B3A29', top='#3E9C93', inner='#3E9C93', legs='#3A3A3E', shoe='#F4F1EA', hair='#17120F', style='locs'),
    'scout': dict(skin='#E2B89A', top='#E3B23C', inner='#EDE3D1', legs='#5F6B46', shoe='#6B4630', hair='#B9B6B0', style='bob'),
    'bea': dict(skin='#C99372', top='#8C8FE0', inner='#F3EEE3', legs='#C9AE86', shoe='#6E4A33', hair='#3A2A20', style='beard'),
}


def build_resident(rid):
    c = CAST[rid]
    random.seed(rid)
    top, legs, skin = mat(c['top'], 0.85, 'fabric'), mat(c['legs'], 0.85, 'fabric'), mat(c['skin'], 0.5)
    shoe, inner, hair = mat(c['shoe'], 0.6), mat(c['inner'], 0.85, 'fabric'), mat(c['hair'], 0.65)
    r = {}
    r['root'] = root = empty()
    r['hips'] = hips = empty((0, 0.76, 0), parent=root)
    ball(0.135, (0, 0, 0), legs, hips, (1.05, 0.72, 0.8))
    r['chest'] = chest = empty((0, 0.03, 0), parent=hips)
    ball(0.165, (0, 0.3, 0), top, chest, (1.0, 1.28, 0.68))
    ball(0.15, (0, 0.12, 0), top, chest, (0.92, 1.0, 0.66))
    box((0.09, 0.26, 0.02), (0, 0.33, 0.107), inner, 0.006, chest)
    cyl(0.045, 0.05, 0.1, (0, 0.5, 0), skin, chest, seg=16)
    r['head'] = head = empty((0, 0.55, 0), parent=chest)
    ball(0.1, (0, 0.08, 0.005), skin, head, (0.92, 1.12, 1.0))
    for x in (-0.034, 0.034):
        ball(0.009, (x, 0.09, 0.09), mat('#1B1613', 0.3), head)
    s = c['style']
    if s == 'curls':
        for _ in range(26):
            a, e = random.uniform(0, 6.28), random.uniform(0.15, 1.5)
            ball(0.04, (math.cos(a) * math.cos(e) * 0.1, 0.1 + math.sin(e) * 0.105, -0.012 + math.sin(a) * math.cos(e) * 0.1), hair, head)
    elif s == 'locs':
        ball(0.103, (0, 0.105, -0.008), hair, head, (0.96, 0.96, 1.0))
        for _ in range(16):
            a = random.uniform(1.6, 7.6)
            ball(0.022, (math.cos(a) * 0.1, 0.13 - random.random() * 0.06, -0.015 + math.sin(a) * 0.1), hair, head, (1, 2.2, 1))
    elif s == 'bob':
        ball(0.122, (0, 0.085, -0.02), hair, head, (0.98, 1.1, 0.92))
        box((0.15, 0.03, 0.05), (0, 0.15, 0.08), hair, 0.012, head)
    else:
        ball(0.11, (0, 0.122, -0.014), hair, head, (0.95, 0.8, 1.0))
        ball(0.076, (0, 0.03, 0.03), hair, head, (1.05, 0.78, 0.95))
        ball(0.018, (0, 0.05, 0.102), skin, head)
        for x in (-0.036, 0.036):
            cyl(0.024, 0.024, 0.004, (x, 0.09, 0.098), mat('#1B1613', 0.3), head, seg=16, rot=(math.pi / 2, 0, 0))
    for k, x in (('l', -0.2), ('r', 0.2)):
        r[f'sh{k}'] = sh = empty((x, 0.42, 0), parent=chest)
        limb(0.056, 0.045, 0.27, top, sh)
        r[f'el{k}'] = el = empty((0, -0.27, 0), parent=sh)
        limb(0.045, 0.034, 0.24, top, el)
        ball(0.04, (0, -0.27, 0.005), skin, el, (0.8, 1.1, 0.7))
        hx = x * 0.46
        r[f'hip{k}'] = hp = empty((hx, 0, 0), parent=hips)
        limb(0.082, 0.06, 0.37, legs, hp)
        r[f'kn{k}'] = kn = empty((0, -0.37, 0), parent=hp)
        limb(0.06, 0.05, 0.34, legs, kn)
        box((0.09, 0.07, 0.21), (0, -0.335, 0.04), shoe, 0.03, kn)
    # the orange "needs you" sign keeps its meaning from the old residents
    r['sign'] = sg = empty((0.3, 0, 0.1), parent=root)
    cyl(0.011, 0.011, 1.75, (0, 0.98, 0), mat('#8A8784', 0.3, metal=1.0), sg, seg=8)
    box((0.46, 0.4, 0.025), (0, 1.76, 0), mat('#FF5A1F', 0.4), 0.014, sg)
    box((0.055, 0.17, 0.01), (0, 1.8, 0.016), mat('#FFFFFF', 0.4), 0.004, sg)
    box((0.055, 0.055, 0.01), (0, 1.65, 0.016), mat('#FFFFFF', 0.4), 0.004, sg)
    return r


def pose(r, clip, t, heading):
    """t is 0..1 through the clip. Positive leg angle swings forward."""
    r['root'].rotation_euler = (0, 0, heading)
    p = t * math.tau
    bob = lean = 0.0
    sl = sr = -0.0
    el = er = 0.2
    hl = hr = 0.0
    kl = kr = 0.0
    zl, zr = 0.08, -0.08
    r['sign'].hide_render = clip != 'waiting'
    for o in r['sign'].children:
        o.hide_render = clip != 'waiting'
    if clip == 'walk':
        hl, hr = math.sin(p) * 0.55, -math.sin(p) * 0.55
        kl, kr = max(0, -math.sin(p + 0.9)) * 0.9 + 0.08, max(0, math.sin(p + 0.9)) * 0.9 + 0.08
        sl, sr = hr * 0.75, hl * 0.75
        bob, lean = abs(math.cos(p)) * 0.022 - 0.022, 0.05
    elif clip == 'idle':
        bob = math.sin(p) * 0.004
        sl, sr = 0.04, -0.04
    elif clip == 'working':
        sl, sr = 0.5, 0.5
        el = 1.1 + math.sin(p) * 0.15
        er = 1.1 - math.sin(p) * 0.15
        lean = 0.12
    elif clip == 'waiting':
        sr, er, zr = 0.75, 1.0, -0.24
        bob = math.sin(p) * 0.006
    elif clip == 'blocked':
        sl, sr, el, er = 0.5, 2.5, 1.1, 2.0
        zr = -0.3
        lean = -0.04 + math.sin(p) * 0.03
    elif clip == 'celebrating':
        h = abs(math.sin(p / 2))
        bob = h * 0.18
        sl = sr = 2.9
        el = er = 0.25
        zl, zr = 0.3, -0.3
        kl = kr = (1 - h) * 0.3
    # Limbs hang along -Z and the character's front is -Y, so swinging forward
    # is a negative X rotation; knees flex the other way.
    r['hips'].location = w(0, 0.76 + bob, 0)
    r['hipl'].rotation_euler = (-hl, 0, 0)
    r['hipr'].rotation_euler = (-hr, 0, 0)
    r['knl'].rotation_euler = (kl, 0, 0)
    r['knr'].rotation_euler = (kr, 0, 0)
    r['chest'].rotation_euler = (lean, 0, 0)
    r['shl'].rotation_euler = (-sl, zl, 0)
    r['shr'].rotation_euler = (-sr, zr, 0)
    r['ell'].rotation_euler = (-el, 0, 0)
    r['elr'].rotation_euler = (-er, 0, 0)
