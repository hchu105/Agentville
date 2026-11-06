"""Split each station and hangout into separate pieces of furniture.

A piece is a cluster of objects whose footprints touch: a sofa, a coffee
table, a lamp. Each becomes its own cutout, so a resident can sit on the sofa
and still be hidden behind the coffee table in front of it.
"""
from mathutils import Vector

FLOORISH = 0.1


def bounds(o, deps):
    ev = o.evaluated_get(deps)
    pts = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    return (min(p.x for p in pts), max(p.x for p in pts), min(-p.y for p in pts), max(-p.y for p in pts),
            min(p.z for p in pts), max(p.z for p in pts))


def pieces(reg, deps, gap=0.04):
    flat = set(reg.flat)
    out = {}
    for group, objs in reg.groups.items():
        solid = [(o, bounds(o, deps)) for o in objs if o.type == 'MESH' and o not in flat]
        solid = [(o, b) for o, b in solid if b[5] > FLOORISH]
        if group in ('board',):
            out[group] = solid
            continue
        parent = list(range(len(solid)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        for i, (_, a) in enumerate(solid):
            for j in range(i + 1, len(solid)):
                b = solid[j][1]
                if a[0] - gap <= b[1] and b[0] - gap <= a[1] and a[2] - gap <= b[3] and b[2] - gap <= a[3]:
                    parent[find(i)] = find(j)
        clusters = {}
        for i, item in enumerate(solid):
            clusters.setdefault(find(i), []).append(item)
        # stable names: biggest first
        ranked = sorted(clusters.values(), key=lambda c: -sum((b[1] - b[0]) * (b[3] - b[2]) for _, b in c))
        for k, c in enumerate(ranked):
            out[f'{group}_{k}'] = c
    return out


def footprint(items):
    return [min(b[0] for _, b in items), max(b[1] for _, b in items), min(b[2] for _, b in items), max(b[3] for _, b in items)]
