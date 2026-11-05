"""Render the world image, station cutouts, sprites and headshots.

  pip install bpy pillow numpy
  python art/render.py plate [--px 2880] [--samples 48]
  python art/render.py cutouts
  python art/render.py sprites [--only pip]
  python art/render.py heads
  python art/pack.py          # writes src/assets/world/
"""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from common import *
from world import STATIONS, build_world
from resident import CAST, CELL_PX, CELL_WORLD, ANCHOR, CLIPS, HEADINGS, build_resident, pose

OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)


def do_plate(px, samples):
    s = reset()
    s.cycles.samples = samples
    add_light_and_world(s)
    build_world(s)
    add_camera(s, PLATE_W, px, round(px * PLATE_H / PLATE_W))
    s.render.filepath = f'{OUT}/plate.png'
    bpy.ops.render.render(write_still=True)


def crop_of(s, objs):
    """Bounding rect of objects in the frame, as fractions (y up), padded."""
    cam = s.camera
    deps = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for o in objs:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(deps)
        for c in ev.bound_box:
            p = world_to_camera_view(s, cam, ev.matrix_world @ Vector(c))
            xs.append(p.x)
            ys.append(p.y)
    pad = 0.006
    return max(0, min(xs) - pad), max(0, min(ys) - pad), min(1, max(xs) + pad), min(1, max(ys) + pad)


def do_cutouts(px, samples):
    s = reset()
    s.cycles.samples = samples
    add_light_and_world(s)
    reg = build_world(s)
    add_camera(s, PLATE_W, px, round(px * PLATE_H / PLATE_W))
    s.render.film_transparent = True
    s.render.use_border = True
    s.render.use_crop_to_border = True
    for o in reg.flat:
        o.is_holdout = True
    rects = {}
    for name, objs in reg.groups.items():
        for other, group in reg.groups.items():
            for o in group:
                o.hide_render = other != name
        x0, y0, x1, y1 = crop_of(s, objs)
        s.render.border_min_x, s.render.border_min_y = x0, y0
        s.render.border_max_x, s.render.border_max_y = x1, y1
        rects[name] = [x0, y0, x1, y1]
        for state in ('idle', 'busy'):
            if state == 'busy' and name not in reg.lit:
                continue
            for m in reg.lit.get(name, []):
                m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 5 if state == 'busy' else 0
            s.render.filepath = f'{OUT}/cut_{name}_{state}.png'
            bpy.ops.render.render(write_still=True)
    json.dump(rects, open(f'{OUT}/rects.json', 'w'))


def sprite_scene():
    s = reset()
    s.cycles.samples = 14
    s.cycles.max_bounces = 3
    add_light_and_world(s)
    # Feet sit at the anchor; the frame centre is this far above them on screen.
    fwd = (w(*CAM_TARGET) - w(*CAM_POS)).normalized()
    up_b = (Vector((0, 0, 1)) - fwd * fwd.z).normalized()
    du = (0.5 - ANCHOR[1]) * CELL_WORLD
    c = up_b * du
    add_camera(s, CELL_WORLD, CELL_PX, CELL_PX, center=(c.x, c.z, -c.y))
    s.render.film_transparent = True
    # Floor catches the shadow so it arrives baked into the sprite's alpha.
    catcher = cyl(6, 6, 0.01, (0, -0.005, 0), mat(FLOOR, 0.9), seg=24)
    catcher.is_shadow_catcher = True
    return s


def do_sprites(only):
    for rid in CAST:
        if only and rid != only:
            continue
        s = sprite_scene()
        rig = build_resident(rid)
        for clip, spec in CLIPS.items():
            for d, heading in enumerate(HEADINGS[spec['dirs']]):
                for f in range(spec['frames']):
                    pose(rig, clip, f / spec['frames'], heading)
                    bpy.context.view_layer.update()
                    s.render.filepath = f'{OUT}/sprites/{rid}/{clip}_{d}_{f}.png'
                    if os.path.exists(s.render.filepath):
                        continue
                    bpy.ops.render.render(write_still=True)


def do_heads(only):
    for rid in CAST:
        if only and rid != only:
            continue
        s = reset()
        s.cycles.samples = 48
        add_light_and_world(s)
        cam = add_camera(s, 0.5, 192, 192)
        rig = build_resident(rid)
        pose(rig, 'idle', 0, math.radians(45))
        bpy.context.view_layer.update()
        cam.data.ortho_scale = 0.42
        cam.location = Vector((1.5, -1.5, 1.42))
        d = Vector((0, 0, 1.36)) - cam.location
        cam.rotation_euler = (-d).to_track_quat('Z', 'Y').to_euler()
        s.render.film_transparent = True
        s.render.filepath = f'{OUT}/heads/{rid}.png'
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    a = argparse.ArgumentParser()
    a.add_argument('what')
    a.add_argument('--px', type=int, default=2880)
    a.add_argument('--samples', type=int, default=48)
    a.add_argument('--only')
    a = a.parse_args()
    {'plate': lambda: do_plate(a.px, a.samples), 'cutouts': lambda: do_cutouts(a.px, a.samples),
     'sprites': lambda: do_sprites(a.only), 'heads': lambda: do_heads(a.only)}[a.what]()
