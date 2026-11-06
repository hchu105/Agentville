"""Write src/assets/world/nav.json: what residents can't walk through.

Reads the same scene the renders use, so collisions follow the furniture
when blockouts are swapped for real models. Rugs are walkable. Anything
fully above head height, like the stall's awning, is walkable underneath.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import bpy
from mathutils import Vector
from common import reset
from world import build_world

CELL, EXTENT = 0.2, 13.0
HEAD, FLOORISH = 1.7, 0.1

s = reset()
reg = build_world(s)
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
flat = set(reg.flat)


def bounds(o):
    ev = o.evaluated_get(deps)
    pts = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    return (min(p.x for p in pts), max(p.x for p in pts), min(-p.y for p in pts), max(-p.y for p in pts),
            min(p.z for p in pts), max(p.z for p in pts))


solid = {}
for o in s.objects:
    if o.type != 'MESH' or o in flat:
        continue
    b = bounds(o)
    if b[5] < FLOORISH or b[4] > HEAD:
        continue
    solid[o] = b

n = round(EXTENT * 2 / CELL)
grid = [[0] * n for _ in range(n)]


def mark(x, z):
    i, j = int((x + EXTENT) / CELL), int((z + EXTENT) / CELL)
    if 0 <= i < n and 0 <= j < n:
        grid[j][i] = 1


def raster(a, b, c):
    """Fill every cell whose centre lies in the triangle, plus the cells under its corners."""
    for p in (a, b, c):
        mark(*p)
    x0, x1 = min(p[0] for p in (a, b, c)), max(p[0] for p in (a, b, c))
    z0, z1 = min(p[1] for p in (a, b, c)), max(p[1] for p in (a, b, c))
    area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if abs(area) < 1e-9:
        return
    for j in range(max(0, int((z0 + EXTENT) / CELL)), min(n, int((z1 + EXTENT) / CELL) + 1)):
        for i in range(max(0, int((x0 + EXTENT) / CELL)), min(n, int((x1 + EXTENT) / CELL) + 1)):
            x, z = (i + 0.5) * CELL - EXTENT, (j + 0.5) * CELL - EXTENT
            w0 = ((b[0] - x) * (c[1] - z) - (b[1] - z) * (c[0] - x)) / area
            w1 = ((c[0] - x) * (a[1] - z) - (c[1] - z) * (a[0] - x)) / area
            if w0 >= 0 and w1 >= 0 and w0 + w1 <= 1:
                grid[j][i] = 1


# The actual shape seen from above, so round tables stay round.
for o in solid:
    ev = o.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    mw = ev.matrix_world
    vs = [mw @ v.co for v in me.vertices]
    for tri in me.loop_triangles:
        ps = [vs[k] for k in tri.vertices]
        if min(p.z for p in ps) > HEAD:
            continue
        raster(*[(p.x, -p.y) for p in ps])
    ev.to_mesh_clear()

dst = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'world', 'nav.json')
json.dump(dict(cell=CELL, extent=EXTENT, rows=[''.join(map(str, r)) for r in grid]), open(dst, 'w'))
