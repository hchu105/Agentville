"""Shared Blender setup: camera, light, materials, primitives.

Coordinates in this folder are three.js world units (x, y-up, z) so they read
the same as src/sim/data.ts. `w()` converts to Blender's Z-up space.
1 unit is about 1.17 m: a resident stands 1.5 units tall.
"""
import math
import bmesh
import bpy
from mathutils import Vector

# Must match src/scene/view.ts.
CAM_POS = (22.0, 20.0, 22.0)
CAM_TARGET = (0.0, 0.6, 0.0)
PLATE_W, PLATE_H = 36.0, 22.5  # world units covered by the world image
FLOOR = '#F4F1EC'


def w(x, y, z):
    return Vector((x, -z, y))


def hexcol(h):
    h = h.lstrip('#')
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.use_denoising = True
    s.cycles.denoiser = 'OPENIMAGEDENOISE'
    s.cycles.max_bounces = 5
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.03
    s.view_settings.view_transform = 'Standard'
    s.view_settings.look = 'None'
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.render.film_transparent = False
    return s


def add_light_and_world(s):
    world = bpy.data.worlds.new('w')
    s.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = hexcol('#FFFFFF')
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.66
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 1.24
    sun.angle = math.radians(14)
    sun.color = hexcol('#FFFBF6')[:3]
    ob = bpy.data.objects.new('sun', sun)
    s.collection.objects.link(ob)
    # From upper left of screen, so shadows fall to the lower right as in the reference.
    d = w(-7, 15, 3).normalized()
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()


def add_camera(s, scale, resx, resy, center=None):
    """World-matching ortho camera. `center` (three coords) is the point at frame centre."""
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = scale
    ob = bpy.data.objects.new('cam', cam)
    s.collection.objects.link(ob)
    pos, tgt = w(*CAM_POS), w(*CAM_TARGET)
    fwd = (tgt - pos).normalized()
    ob.rotation_euler = (-fwd).to_track_quat('Z', 'Y').to_euler()
    if center is None:
        ob.location = pos
    else:
        ob.location = w(*center) - fwd * (pos - tgt).length
    s.camera = ob
    s.render.resolution_x, s.render.resolution_y = resx, resy
    s.render.resolution_percentage = 100
    return ob


_mats = {}


def mat(color, rough=0.75, kind='matte', metal=0.0, emit=None):
    key = (color, rough, kind, metal, emit)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(f'{kind}{color}')
    m.use_nodes = True
    n = m.node_tree.nodes
    p = n['Principled BSDF']
    p.inputs['Base Color'].default_value = hexcol(color)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = hexcol(emit)
        p.inputs['Emission Strength'].default_value = 0.0
    if kind in ('fabric', 'wood'):
        tex = n.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = 90 if kind == 'fabric' else 14
        bump = n.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.22 if kind == 'fabric' else 0.08
        m.node_tree.links.new(tex.outputs[0], bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs[0], p.inputs['Normal'])
        if kind == 'fabric':
            p.inputs['Sheen Weight'].default_value = 0.6
    _mats[key] = m
    return m


def _finish(me, m, parent, s, smooth=True):
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.materials.append(m)
    ob = bpy.data.objects.new(me.name, me)
    s.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def box(sz, pos, m, r=0.04, parent=None, rot=None):
    """Rounded box. sz = (x, y, z) in three axes, pos = its centre in the parent."""
    s = bpy.context.scene
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    me = bpy.data.meshes.new('box')
    bm.to_mesh(me)
    bm.free()
    ob = _finish(me, m, parent, s)
    ob.scale = (sz[0], sz[2], sz[1])
    ob.location = w(*pos)
    if rot:
        ob.rotation_euler = rot
    if r:
        bpy.context.view_layer.objects.active = ob
        ob.scale = (1, 1, 1)
        me.transform(__import__('mathutils').Matrix.Diagonal((sz[0], sz[2], sz[1], 1)))
        b = ob.modifiers.new('b', 'BEVEL')
        b.width = min(r, min(sz) * 0.49)
        b.segments = 4
        b.limit_method = 'NONE'
        ob.modifiers.new('w', 'WEIGHTED_NORMAL')
    return ob


def cyl(r1, r2, h, pos, m, parent=None, seg=40, rot=None):
    s = bpy.context.scene
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h)
    me = bpy.data.meshes.new('cyl')
    bm.to_mesh(me)
    bm.free()
    ob = _finish(me, m, parent, s)
    ob.location = w(*pos)
    if rot:
        ob.rotation_euler = rot
    return ob


def ball(r, pos, m, parent=None, scale=None):
    s = bpy.context.scene
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=r)
    me = bpy.data.meshes.new('ball')
    bm.to_mesh(me)
    bm.free()
    ob = _finish(me, m, parent, s)
    ob.location = w(*pos)
    if scale:
        ob.scale = (scale[0], scale[2], scale[1])
    return ob


def limb(r1, r2, length, m, parent=None):
    """Capsule hanging from its origin, down -Z."""
    s = bpy.context.scene
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=r2, radius2=r1, depth=length)
    bmesh.ops.translate(bm, vec=(0, 0, -length / 2), verts=bm.verts)
    me = bpy.data.meshes.new('limb')
    bm.to_mesh(me)
    bm.free()
    ob = _finish(me, m, parent, s)
    ball(r1, (0, 0, 0), m, ob)
    ball(r2, (0, -length, 0), m, ob)
    return ob


def empty(pos=(0, 0, 0), yaw=0.0, parent=None):
    ob = bpy.data.objects.new('e', None)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = w(*pos)
    ob.rotation_euler = (0, 0, yaw)
    if parent:
        ob.parent = parent
    return ob
