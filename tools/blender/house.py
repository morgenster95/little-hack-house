"""
Little Hack House – izometrický dům v Blenderu (procedurálně).
Spuštění: blender -b --factory-startup --python house.py -- <out_dir> [preview|final]

Souřadnice: herní mřížka (gx, gy) z src/config/layout.ts, 1 dlaždice = S metrů.
Blender X = gx*S, Blender Y = -gy*S, Z = metry.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.dirname(__file__)
MODE = argv[1] if len(argv) > 1 else 'preview'
os.makedirs(OUT, exist_ok=True)

S = 0.65
W, D = 12.0, 7.0
WALL_H = 2.5
FRONT_H = 0.42
WT = 0.3          # tloušťka zdi v dlaždicích
PX0, PX1 = 4.5, 4.7  # příčka
PART_H = 1.15
FLOOR_Z = 0.06

# ---------------------------------------------------------------- scéna
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col_root = scene.collection


def coll(name):
    c = bpy.data.collections.new(name)
    col_root.children.link(c)
    return c


C_HOUSE = coll('house')
C_FURN = coll('furniture')
C_DEV = coll('devices')
C_OUT = coll('outdoor')


# ---------------------------------------------------------------- materiály
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


_mats = {}


def mat(name, color='#ffffff', rough=0.5, metal=0.0, emit=None, emit_str=0.0, trans=0.0,
        sheen=0.0, coat=0.0, alpha=1.0, ior=1.45):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['IOR'].default_value = ior
    if trans:
        b.inputs['Transmission Weight'].default_value = trans
    if sheen:
        b.inputs['Sheen Weight'].default_value = sheen
    if coat:
        b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = srgb(emit)
        b.inputs['Emission Strength'].default_value = emit_str
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    _mats[name] = m
    return m


def brick_mat(name, c1, c2, mortar, w, h, offset=0.5, mortar_size=0.003, axes='XY', rough=0.45,
              grain=True):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = N['Principled BSDF']
    b.inputs['Roughness'].default_value = rough
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(tc.outputs['Object'], sep.inputs[0])
    L.new(sep.outputs[axes[0]], comb.inputs[0])
    L.new(sep.outputs[axes[1]], comb.inputs[1])
    br = N.new('ShaderNodeTexBrick')
    br.offset = offset
    br.inputs['Color1'].default_value = srgb(c1)
    br.inputs['Color2'].default_value = srgb(c2)
    br.inputs['Mortar'].default_value = srgb(mortar)
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = mortar_size
    br.inputs['Mortar Smooth'].default_value = 0.3
    br.inputs['Bias'].default_value = 0.0
    br.inputs['Brick Width'].default_value = w
    br.inputs['Row Height'].default_value = h
    L.new(comb.outputs[0], br.inputs['Vector'])
    out = br.outputs['Color']
    if grain:
        mp = N.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (0.4, 9.0, 1.0)
        L.new(comb.outputs[0], mp.inputs['Vector'])
        nz = N.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = 6.0
        nz.inputs['Detail'].default_value = 6.0
        L.new(mp.outputs[0], nz.inputs['Vector'])
        rp = N.new('ShaderNodeMapRange')
        rp.inputs['To Min'].default_value = 0.9
        rp.inputs['To Max'].default_value = 1.05
        L.new(nz.outputs['Fac'], rp.inputs['Value'])
        mix = N.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        L.new(out, mix.inputs[6])
        L.new(rp.outputs[0], mix.inputs[7])
        out = mix.outputs[2]
    L.new(out, b.inputs['Base Color'])
    # jemné spáry i v reliéfu
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    bump.inputs['Distance'].default_value = 0.002
    L.new(br.outputs['Fac'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def noisy_mat(name, color, rough=0.8, scale=8.0, var=0.12, bump=0.3, sheen=0.0):
    m = mat(name, color, rough=rough, sheen=sheen)
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = N['Principled BSDF']
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 8.0
    rp = N.new('ShaderNodeMapRange')
    rp.inputs['To Min'].default_value = 1 - var
    rp.inputs['To Max'].default_value = 1 + var
    L.new(nz.outputs['Fac'], rp.inputs['Value'])
    rgb = N.new('ShaderNodeRGB')
    rgb.outputs[0].default_value = srgb(color)
    mix = N.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    L.new(rgb.outputs[0], mix.inputs[6])
    L.new(rp.outputs[0], mix.inputs[7])
    L.new(mix.outputs[2], b.inputs['Base Color'])
    if bump:
        bp = N.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = bump
        L.new(nz.outputs['Fac'], bp.inputs['Height'])
        L.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


M = dict(
    wall=mat('wall', '#f6f4f0', 0.85),
    wall_cut=mat('wall_cut', '#ebe8e2', 0.9),
    plinth=mat('plinth', '#e9e6e0', 0.8),
    white=mat('white_gloss', '#fbfbfa', 0.25, coat=0.3),
    ceramic=mat('ceramic', '#fdfdfc', 0.12, coat=0.6),
    chrome=mat('chrome', '#d6dadf', 0.18, metal=1.0),
    black=mat('black_matte', '#2b2d31', 0.55),
    graphite=mat('graphite', '#45484e', 0.4),
    screen=mat('screen', '#15171c', 0.08, coat=1.0),
    glass=mat('glass', '#eef6f8', 0.02, trans=1.0),
    mirror=mat('mirror', '#e8eef0', 0.02, metal=1.0),
    oak=noisy_mat('oak', '#d8b98f', rough=0.55, scale=3.0, var=0.08, bump=0.05),
    oak_dark=noisy_mat('oak_dark', '#a27a55', rough=0.5, scale=3.0, var=0.08, bump=0.05),
    walnut=noisy_mat('walnut', '#6e4c36', rough=0.5, scale=3.0, var=0.08, bump=0.05),
    fabric=noisy_mat('fabric_sofa', '#ddd6cb', rough=0.95, scale=60, var=0.05, bump=0.15, sheen=0.4),
    fabric_sage=noisy_mat('fabric_sage', '#9fb39a', rough=0.95, scale=60, var=0.05, bump=0.15, sheen=0.4),
    fabric_orange=noisy_mat('fabric_orange', '#e9a640', rough=0.95, scale=60, var=0.05, bump=0.15, sheen=0.4),
    fabric_cream=noisy_mat('fabric_cream', '#f1ece2', rough=0.95, scale=60, var=0.04, bump=0.1, sheen=0.4),
    rug=noisy_mat('rug', '#e7dfd1', rough=1.0, scale=120, var=0.06, bump=0.25, sheen=0.5),
    rug_border=noisy_mat('rug_border', '#cfc3ad', rough=1.0, scale=120, var=0.06, bump=0.25),
    linen=mat('linen', '#f4ede0', 0.9, trans=0.25, sheen=0.3),
    curtain=noisy_mat('curtain', '#efe8dc', rough=0.95, scale=40, var=0.04, bump=0.05, sheen=0.4),
    leaf=noisy_mat('leaf', '#5f8f55', rough=0.6, scale=12, var=0.12, bump=0.1),
    leaf2=noisy_mat('leaf2', '#7aa66a', rough=0.6, scale=12, var=0.12, bump=0.1),
    pot=mat('pot', '#efe9df', 0.7),
    pot_terra=mat('pot_terra', '#c98e6a', 0.8),
    soil_pot=mat('soil_pot', '#4b3a2e', 1.0),
    rattan=noisy_mat('rattan', '#cfa974', rough=0.8, scale=80, var=0.15, bump=0.4),
    grass=noisy_mat('grass', '#8fb36a', rough=0.95, scale=25, var=0.08, bump=0.2),
    soil=noisy_mat('soil', '#7b5a44', rough=1.0, scale=10, var=0.1, bump=0.3),
    concrete=noisy_mat('concrete', '#dedbd4', rough=0.9, scale=30, var=0.05, bump=0.1),
    hedge=noisy_mat('hedge', '#6f9a5c', rough=0.9, scale=35, var=0.18, bump=0.8),
    bush=noisy_mat('bush', '#7ea865', rough=0.9, scale=30, var=0.18, bump=0.8),
    tree=noisy_mat('tree', '#7c9f68', rough=0.9, scale=14, var=0.12, bump=0.5),
    bark=mat('bark', '#6b5141', 0.9),
    led_blue=mat('led_blue', '#4d86ff', 0.3, emit='#4d86ff', emit_str=12.0),
    led_orange=mat('led_orange', '#f0a020', 0.3, emit='#f5a623', emit_str=10.0),
    disp_blue=mat('disp_blue', '#8fd0ff', 0.3, emit='#8fd0ff', emit_str=5.0),
    warm_glow=mat('warm_glow', '#fff1d6', 0.5, emit='#ffdca6', emit_str=6.0),
    mirror_led=mat('mirror_led', '#fff4e2', 0.5, emit='#fff1dc', emit_str=8.0),
    art_cream=mat('art_cream', '#f6efe2', 0.9),
    art_sage=mat('art_sage', '#9cb39a', 0.9),
    art_orange=mat('art_orange', '#eaa43f', 0.9),
    art_terra=mat('art_terra', '#d58f72', 0.9),
    books=[mat('book1', '#c9765a', 0.8), mat('book2', '#8aa6b8', 0.8), mat('book3', '#e7d2a8', 0.8)],
)
M['floor_wood'] = brick_mat('floor_wood', '#d9b588', '#cda677', '#a9845d', 1.25, 0.2)
M['floor_tile'] = brick_mat('floor_tile', '#e6e4df', '#dedbd5', '#c9c4bc', 0.6, 0.6, offset=0.0,
                            mortar_size=0.004, rough=0.3, grain=False)
M['tile_wall_x'] = brick_mat('tile_wall_x', '#eef0ee', '#e6e9e7', '#cfd3d0', 0.3, 0.6, offset=0.0,
                             mortar_size=0.003, axes='XZ', rough=0.15, grain=False)
M['tile_wall_y'] = brick_mat('tile_wall_y', '#eef0ee', '#e6e9e7', '#cfd3d0', 0.3, 0.6, offset=0.0,
                             mortar_size=0.003, axes='YZ', rough=0.15, grain=False)


# ---------------------------------------------------------------- geometrie
def to_obj(name, bm, material, coll, smooth=True, angle=35):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(angle))
    if isinstance(material, (list, tuple)):
        for m in material:
            me.materials.append(m)
    else:
        me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def bevel_sharp(bm, r, seg, min_angle=50):
    if r <= 0:
        return
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(min_angle)]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=r, segments=seg, profile=0.5, affect='EDGES',
                        clamp_overlap=True)


def box_m(name, x0, y0, z0, x1, y1, z1, material, coll, r=0.008, seg=3):
    """Kvádr v metrech (Blender souřadnice)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
    c = Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz)) + c
    r = min(r, 0.45 * min(sx, sy, sz))
    bevel_sharp(bm, r, seg)
    return to_obj(name, bm, material, coll)


def gbox(name, gx0, gy0, gx1, gy1, z0, z1, material, coll=None, r=0.008, seg=3):
    """Kvádr v herní mřížce (z v metrech)."""
    return box_m(name, gx0 * S, -gy1 * S, z0, gx1 * S, -gy0 * S, z1, material, coll or C_FURN, r, seg)


def cyl(name, gx, gy, z0, z1, r1, material, coll=None, r2=None, seg=40, bev=0.004, axis='Z',
        center=None):
    """Válec/kužel. Pro axis X/Y je center (gx, gy, z) střed a z0..z1 je délka podél osy."""
    bm = bmesh.new()
    r2 = r1 if r2 is None else r2
    depth = z1 - z0
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2,
                          depth=depth)
    bevel_sharp(bm, min(bev, 0.4 * min(r1, r2 if r2 > 0 else r1, depth)), 2, min_angle=40)
    if axis == 'Z':
        T = Matrix.Translation((gx * S, -gy * S, (z0 + z1) / 2))
    else:
        rot = Matrix.Rotation(math.radians(90), 4, 'Y' if axis == 'X' else 'X')
        cx, cy, cz = center
        T = Matrix.Translation((cx * S, -cy * S, cz)) @ rot
    bmesh.ops.transform(bm, matrix=T, verts=bm.verts)
    return to_obj(name, bm, material, coll or C_FURN, angle=40)


def ellipsoid(name, cx, cy, cz, rx, ry, rz, material, coll=None, rot=(0, 0, 0), subdiv=3, smooth=True):
    """Elipsoid; cx, cy v mřížce, cz a poloměry v metrech."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    Mtx = (Matrix.Translation((cx * S, -cy * S, cz)) @ Euler(rot).to_matrix().to_4x4()
           @ Matrix.Diagonal((rx, ry, rz, 1)))
    bmesh.ops.transform(bm, matrix=Mtx, verts=bm.verts)
    ob = to_obj(name, bm, material, coll or C_FURN, smooth=smooth, angle=180)
    return ob


def text(name, s, gx, gy, z, size, material, coll=None, facing='-Y'):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = s
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = 0.0008
    ob = bpy.data.objects.new(name, cu)
    (coll or C_DEV).objects.link(ob)
    ob.location = (gx * S, -gy * S, z)
    ob.rotation_euler = (math.radians(90), 0, 0) if facing == '-Y' else (math.radians(90), 0, math.radians(90))
    ob.data.materials.append(material)
    return ob


def point_light(name, gx, gy, z, power, color=(1.0, 0.82, 0.6), radius=0.05):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = power
    ld.color = color
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    C_DEV.objects.link(ob)
    ob.location = (gx * S, -gy * S, z)
    return ob


# ================================================================ POZEMEK
gbox('plot_grass', -2.2, -1.8, 14.6, 10.6, -0.07, 0.0, M['grass'], C_OUT, r=0.03)
gbox('plot_soil', -2.17, -1.77, 14.57, 10.57, -0.55, -0.069, M['soil'], C_OUT, r=0.02)
# dlážděný chodník ke dveřím (dveře v přední stěně, gx 5.4–6.6)
for i, gy in enumerate([7.75, 8.75, 9.75]):
    gbox(f'paver_{i}', 5.35, gy, 6.65, gy + 0.8, -0.02, 0.025, M['concrete'], C_OUT, r=0.01)
gbox('doormat', 5.5, 7.32, 6.5, 7.62, 0.0, 0.02, M['rattan'], C_OUT, r=0.004)

# ================================================================ DŮM
# základová deska
gbox('base', -WT, -WT, W + WT, D + WT, -0.12, FLOOR_Z - 0.005, M['plinth'], C_HOUSE, r=0.01)
# podlahy
gbox('floor_bath', 0, 0, PX0 + 0.1, D, FLOOR_Z - 0.01, FLOOR_Z, M['floor_tile'], C_HOUSE, r=0)
gbox('floor_living', PX0 + 0.1, 0, W, D, FLOOR_Z - 0.01, FLOOR_Z, M['floor_wood'], C_HOUSE, r=0)


def wall_along_x(name, gy0, gy1, gx0, gx1, z0, z1, holes=(), material=None):
    """Zeď podél osy x (rovina y = konst.), holes = [(gx_a, gx_b, z_a, z_b)]."""
    material = material or M['wall']
    xs = [gx0]
    for (a, b, za, zb) in sorted(holes):
        if za > z0:
            gbox(f'{name}_h{a}_lo', a, gy0, b, gy1, z0, za, material, C_HOUSE, r=0.004)
        if zb < z1:
            gbox(f'{name}_h{a}_hi', a, gy0, b, gy1, zb, z1, material, C_HOUSE, r=0.004)
        xs += [a, b]
    xs.append(gx1)
    for i in range(0, len(xs), 2):
        if xs[i + 1] - xs[i] > 1e-4:
            gbox(f'{name}_{i}', xs[i], gy0, xs[i + 1], gy1, z0, z1, material, C_HOUSE, r=0.006)


def wall_along_y(name, gx0, gx1, gy0, gy1, z0, z1, holes=(), material=None):
    material = material or M['wall']
    ys = [gy0]
    for (a, b, za, zb) in sorted(holes):
        if za > z0:
            gbox(f'{name}_h{a}_lo', gx0, a, gx1, b, z0, za, material, C_HOUSE, r=0.004)
        if zb < z1:
            gbox(f'{name}_h{a}_hi', gx0, a, gx1, b, zb, z1, material, C_HOUSE, r=0.004)
        ys += [a, b]
    ys.append(gy1)
    for i in range(0, len(ys), 2):
        if ys[i + 1] - ys[i] > 1e-4:
            gbox(f'{name}_{i}', gx0, ys[i], gx1, ys[i + 1], z0, z1, material, C_HOUSE, r=0.006)


WIN_LIV = (9.8, 11.6, 0.8, 2.15)
WIN_BATH = (1.95, 2.85, 1.45, 2.15)
# zadní stěny (plná výška)
wall_along_x('wall_back', -WT, 0, -WT, W + WT, FLOOR_Z - 0.01, WALL_H, holes=[WIN_LIV])
wall_along_y('wall_left', -WT, 0, 0, D + WT, FLOOR_Z - 0.01, WALL_H, holes=[WIN_BATH])
# přední stěny – řez (nízké), s průchodem dveří
DOOR = (5.4, 6.6)
wall_along_x('wall_front_a', D, D + WT, 0, DOOR[0], FLOOR_Z - 0.01, FRONT_H, material=M['wall'])
wall_along_x('wall_front_b', D, D + WT, DOOR[1], W + WT, FLOOR_Z - 0.01, FRONT_H, material=M['wall'])
wall_along_y('wall_right', W, W + WT, 0, D, FLOOR_Z - 0.01, FRONT_H, material=M['wall'])
gbox('door_threshold', DOOR[0], D, DOOR[1], D + WT, FLOOR_Z - 0.01, FLOOR_Z + 0.012, M['graphite'], C_HOUSE, r=0.003)
# příčka s průchodem
wall_along_y('partition', PX0, PX1, 0, D, FLOOR_Z - 0.01, PART_H, holes=[(2.55, 3.65, 0.0, PART_H + 1)])
# soklové lišty v obýváku
gbox('skirt_back', PX1, 0, W, 0.03, FLOOR_Z, FLOOR_Z + 0.07, M['wall_cut'], C_HOUSE, r=0.003)

# okno obývák – rám + sklo
wx0, wx1, wz0, wz1 = WIN_LIV
FR = 0.07
for nm, a, b, c, d in [('l', wx0, wx0 + FR, wz0, wz1), ('r', wx1 - FR, wx1, wz0, wz1),
                       ('b', wx0, wx1, wz0, wz0 + 0.05), ('t', wx0, wx1, wz1 - 0.05, wz1),
                       ('m', (wx0 + wx1) / 2 - 0.03, (wx0 + wx1) / 2 + 0.03, wz0, wz1)]:
    gbox(f'win_liv_frame_{nm}', a, -0.2, b, -0.1, c, d, M['graphite'], C_HOUSE, r=0.004)
gbox('win_liv_glass', wx0, -0.16, wx1, -0.15, wz0, wz1, M['glass'], C_HOUSE, r=0)
gbox('win_liv_sill', wx0 - 0.1, -0.05, wx1 + 0.1, 0.12, wz0 - 0.03, wz0, M['wall'], C_HOUSE, r=0.005)
# okno koupelna
by0, by1, bz0, bz1 = WIN_BATH
for nm, a, b, c, d in [('l', by0, by0 + FR, bz0, bz1), ('r', by1 - FR, by1, bz0, bz1),
                       ('b', by0, by1, bz0, bz0 + 0.05), ('t', by0, by1, bz1 - 0.05, bz1)]:
    gbox(f'win_bath_frame_{nm}', -0.2, a, -0.1, b, c, d, M['graphite'], C_HOUSE, r=0.004)
gbox('win_bath_glass', -0.16, by0, -0.15, by1, bz0, bz1, M['glass'], C_HOUSE, r=0)

# obklad ve sprše (až ke stropu) a za umyvadlem
gbox('tile_shower_back', 0, 0, 1.85, 0.015, FLOOR_Z, 2.3, M['tile_wall_x'], C_HOUSE, r=0)
gbox('tile_shower_left', 0, 0, 0.015, 1.85, FLOOR_Z, 2.3, M['tile_wall_y'], C_HOUSE, r=0)
gbox('tile_sink_back', 2.95, 0, 4.25, 0.015, FLOOR_Z, 1.15, M['tile_wall_x'], C_HOUSE, r=0)

# ================================================================ KOUPELNA
# sprchový kout
gbox('shower_tray', 0.02, 0.02, 1.8, 1.8, FLOOR_Z, FLOOR_Z + 0.04, M['ceramic'], C_FURN, r=0.01)
gbox('shower_drain', 0.6, 1.5, 1.2, 1.56, FLOOR_Z + 0.04, FLOOR_Z + 0.042, M['chrome'], C_FURN, r=0.001)
gbox('shower_glass_a', 0.02, 1.79, 0.8, 1.81, FLOOR_Z + 0.04, 2.05, M['glass'], C_FURN, r=0.002)
gbox('shower_glass_b', 1.79, 0.02, 1.81, 1.8, FLOOR_Z + 0.04, 2.05, M['glass'], C_FURN, r=0.002)
for nm, a in [('a', (0.02, 1.785, 0.82, 1.815)), ('b', (1.785, 0.02, 1.815, 1.815))]:
    gbox(f'shower_frame_{nm}', a[0], a[1], a[2], a[3], 2.03, 2.06, M['black'], C_FURN, r=0.003)
gbox('shower_post', 1.785, 1.785, 1.815, 1.815, FLOOR_Z + 0.04, 2.06, M['black'], C_FURN, r=0.003)
cyl('shower_riser', 0.06, 0.9, 1.0, 2.1, 0.012, M['black'], C_FURN)
cyl('shower_arm', 0, 0, 0, 0.42 * S, 0.012, M['black'], C_FURN, axis='X', center=(0.06 + 0.21, 0.9, 2.1))
cyl('shower_head', 0.5, 0.9, 2.06, 2.09, 0.13, M['black'], C_FURN)
gbox('shower_mixer', 0.02, 0.8, 0.07, 1.0, 1.05, 1.15, M['black'], C_FURN, r=0.01)

# bojler (zařízení)
BX, BY = 2.55, 0.42
BR = 0.23
cyl('boiler_body', BX, BY, 1.1, 2.4, BR, M['white'], C_DEV, bev=0.05, seg=56)
cyl('boiler_pipe_cold', BX - 0.13, 0.12, 0.7, 1.12, 0.012, M['chrome'], C_DEV)
cyl('boiler_pipe_hot', BX + 0.13, 0.12, 0.75, 1.12, 0.012, M['art_terra'], C_DEV)
gbox('boiler_bracket', BX - 0.3, 0, BX + 0.3, 0.06, 2.0, 2.06, M['graphite'], C_DEV, r=0.004)

# umyvadlo – dřevěná skříňka + nádoba + zrcadlo s LED
gbox('vanity', 3.05, 0.0, 4.15, 0.75, 0.42, 0.78, M['oak'], C_FURN, r=0.01)
gbox('vanity_groove', 3.06, 0.75, 4.14, 0.755, 0.6, 0.605, M['oak_dark'], C_FURN, r=0)
cyl('basin', 3.6, 0.38, 0.78, 0.9, 0.2, M['ceramic'], C_FURN, r2=0.17, bev=0.02)
cyl('basin_in', 3.6, 0.38, 0.86, 0.905, 0.16, mat('basin_in', '#eef1f2', 0.1), C_FURN, bev=0.0)
cyl('faucet', 3.6, 0.08, 0.78, 1.02, 0.012, M['chrome'], C_FURN)
cyl('faucet_spout', 0, 0, 0, 0.12, 0.01, M['chrome'], C_FURN, axis='Y', center=(3.6, 0.17, 1.0))
gbox('mirror_back', 3.18, 0.0, 4.02, 0.03, 1.2, 2.0, M['mirror_led'], C_FURN, r=0.02)
gbox('mirror', 3.21, 0.02, 3.99, 0.05, 1.23, 1.97, M['mirror'], C_FURN, r=0.02)

# pračka
gbox('washer', 0.05, 3.05, 0.95, 4.0, FLOOR_Z, 0.9, M['white'], C_FURN, r=0.03)
gbox('washer_panel', 0.951, 3.12, 0.96, 3.93, 0.78, 0.86, mat('panel_grey', '#e4e6e8', 0.4), C_FURN, r=0.003)
cyl('washer_ring', 0, 0, 0, 0.03, 0.2, M['chrome'], C_FURN, axis='X', center=(0.96, 3.52, 0.45))
cyl('washer_door', 0, 0, 0, 0.035, 0.155, mat('washer_glass', '#5a6c78', 0.05, coat=1.0), C_FURN, axis='X', center=(0.97, 3.52, 0.45))
cyl('washer_knob', 0, 0, 0, 0.025, 0.03, M['chrome'], C_FURN, axis='X', center=(0.965, 3.82, 0.82))
# polička nad pračkou
gbox('bath_shelf', 0, 3.1, 0.35, 4.2, 1.55, 1.58, M['oak'], C_FURN, r=0.004)
for i, (y, h, m) in enumerate([(3.3, 0.16, M['art_terra']), (3.6, 0.11, mat('bottle_blue', '#9fc6d6', 0.3)), (3.9, 0.14, M['art_cream'])]):
    cyl(f'bottle_{i}', 0.17, y, 1.58, 1.58 + h, 0.035, m, C_FURN, bev=0.01)
ellipsoid('shelf_plant', 0.17, 4.12, 1.68, 0.06, 0.06, 0.09, M['leaf2'], C_FURN)

# žebříkový radiátor + ručník
for gy in (5.22, 5.93):
    cyl(f'towel_rail_v{gy}', 0.1, gy, 0.45, 1.85, 0.015, M['white'], C_DEV)
for i in range(7):
    z = 0.55 + i * 0.2
    cyl(f'towel_rail_h{i}', 0, 0, 0, 0.71 * S, 0.01, M['white'], C_DEV, axis='Y', center=(0.1, 5.575, z))
gbox('towel', 0.03, 5.3, 0.17, 5.85, 0.95, 1.62, M['fabric_orange'], C_DEV, r=0.03)

# WC (závěsné)
gbox('wc_plate', 0.0, 6.28, 0.03, 6.62, 0.95, 1.12, M['white'], C_FURN, r=0.006)
gbox('wc_bowl', 0.0, 6.25, 0.85, 6.68, 0.28, 0.42, M['ceramic'], C_FURN, r=0.08)
gbox('wc_seat', 0.05, 6.26, 0.86, 6.67, 0.42, 0.44, M['white'], C_FURN, r=0.01)

# předložka, koš, rostlinka
gbox('bath_mat', 1.0, 2.1, 2.2, 2.95, FLOOR_Z, FLOOR_Z + 0.015, M['fabric_cream'], C_FURN, r=0.006)
cyl('basket', 3.9, 6.2, FLOOR_Z, 0.58, 0.21, M['rattan'], C_FURN, r2=0.18, bev=0.02)
cyl('basket_towel', 3.9, 6.2, 0.55, 0.62, 0.17, M['fabric_cream'], C_FURN, bev=0.03)
cyl('bath_stool', 4.15, 0.45, FLOOR_Z, 0.45, 0.12, M['oak'], C_FURN, bev=0.01)
cyl('bath_plant_pot', 4.15, 0.45, 0.45, 0.58, 0.07, M['pot'], C_FURN, r2=0.06, bev=0.01)
for i, (dx, dy, rz) in enumerate([(-0.04, 0.0, 0.3), (0.05, 0.03, -0.35), (0.0, -0.05, 0.05)]):
    ellipsoid(f'bath_leaf_{i}', 4.15 + dx, 0.45 + dy, 0.68, 0.035, 0.035, 0.12, M['leaf'], C_FURN, rot=(rz, 0.3 * (i - 1), 0))

# ================================================================ OBÝVÁK
# koberec
gbox('rug', 6.9, 1.55, 10.4, 4.95, FLOOR_Z, FLOOR_Z + 0.012, M['rug_border'], C_FURN, r=0.005)
gbox('rug_inner', 7.05, 1.7, 10.25, 4.8, FLOOR_Z + 0.012, FLOOR_Z + 0.016, M['rug'], C_FURN, r=0.002)

# gauč (sedí se směrem +gy, k divákovi)
SX0, SX1, SY0, SY1 = 7.05, 10.0, 0.05, 1.3
gbox('sofa_base', SX0, SY0, SX1, SY1, 0.1, 0.36, M['fabric'], C_FURN, r=0.04)
gbox('sofa_back', SX0, SY0, SX1, SY0 + 0.32, 0.36, 0.82, M['fabric'], C_FURN, r=0.06)
gbox('sofa_arm_l', SX0, SY0, SX0 + 0.3, SY1, 0.36, 0.62, M['fabric'], C_FURN, r=0.06)
gbox('sofa_arm_r', SX1 - 0.3, SY0, SX1, SY1, 0.36, 0.62, M['fabric'], C_FURN, r=0.06)
for i, x in enumerate([SX0 + 0.32, SX0 + 0.32 + 1.17]):
    gbox(f'sofa_seat_{i}', x, SY0 + 0.34, x + 1.14, SY1 - 0.02, 0.36, 0.48, M['fabric'], C_FURN, r=0.05)
    gbox(f'sofa_cush_{i}', x + 0.02, SY0 + 0.3, x + 1.12, SY0 + 0.62, 0.48, 0.84, M['fabric'], C_FURN, r=0.08)
for i, x in enumerate([SX0 + 0.4, SX0 + 2.55]):
    gbox(f'sofa_leg_{i}a', x, SY1 - 0.12, x + 0.05, SY1 - 0.07, FLOOR_Z, 0.11, M['walnut'], C_FURN, r=0.005)
gbox('pillow_sage', SX0 + 0.4, SY0 + 0.6, SX0 + 0.95, SY0 + 0.78, 0.46, 0.8, M['fabric_sage'], C_FURN, r=0.07)
gbox('pillow_orange', SX1 - 0.95, SY0 + 0.6, SX1 - 0.4, SY0 + 0.78, 0.46, 0.78, M['fabric_orange'], C_FURN, r=0.07)
gbox('throw', SX1 - 0.32, 0.4, SX1 - 0.02, 1.0, 0.6, 0.64, M['fabric_cream'], C_FURN, r=0.015)

# konferenční stolek
gbox('table_top', 7.8, 2.2, 9.2, 3.0, 0.36, 0.4, M['oak'], C_FURN, r=0.012)
for i, (x, y) in enumerate([(7.88, 2.28), (9.07, 2.28), (7.88, 2.87), (9.07, 2.87)]):
    gbox(f'table_leg_{i}', x, y, x + 0.05, y + 0.05, FLOOR_Z, 0.36, M['walnut'], C_FURN, r=0.006)
cyl('fruit_bowl', 8.2, 2.55, 0.4, 0.46, 0.12, M['ceramic'], C_FURN, r2=0.08, bev=0.01)
for i, (dx, dy) in enumerate([(-0.05, 0.0), (0.06, 0.04), (0.02, -0.07)]):
    ellipsoid(f'fruit_{i}', 8.2 + dx, 2.55 + dy, 0.48, 0.035, 0.035, 0.035, M['leaf2'], C_FURN)
gbox('book_a', 8.65, 2.4, 9.05, 2.75, 0.4, 0.425, M['books'][1], C_FURN, r=0.004)
gbox('book_b', 8.7, 2.45, 9.0, 2.7, 0.425, 0.445, M['books'][2], C_FURN, r=0.004)

# TV skříňka + televize (zády k divákovi)
gbox('tv_unit', 7.5, 5.45, 9.7, 6.05, 0.08, 0.48, M['oak'], C_FURN, r=0.012)
for i, x in enumerate([7.6, 9.55]):
    gbox(f'tv_unit_leg_{i}', x, 5.85, x + 0.06, 5.92, FLOOR_Z, 0.09, M['walnut'], C_FURN, r=0.005)
for i, x in enumerate([8.23, 8.96]):
    gbox(f'tv_unit_groove_{i}', x, 6.05, x + 0.008, 6.055, 0.12, 0.44, M['oak_dark'], C_FURN, r=0)
gbox('tv_stand', 8.4, 5.6, 8.8, 5.85, 0.48, 0.5, M['graphite'], C_DEV, r=0.005)
gbox('tv_neck', 8.55, 5.72, 8.65, 5.78, 0.5, 0.62, M['graphite'], C_DEV, r=0.005)
gbox('tv_panel', 7.75, 5.66, 9.45, 5.78, 0.58, 1.18, M['black'], C_DEV, r=0.01)
gbox('tv_screen', 7.77, 5.655, 9.43, 5.665, 0.6, 1.16, M['screen'], C_DEV, r=0)
cyl('speaker', 9.45, 5.75, 0.48, 0.66, 0.06, mat('speaker_fabric', '#5b5f66', 0.9, sheen=0.3), C_DEV, bev=0.015)
cyl('speaker_ring', 9.45, 5.75, 0.66, 0.67, 0.05, M['led_blue'], C_DEV, bev=0.003)
cyl('tv_plant_pot', 7.75, 5.95, 0.48, 0.6, 0.06, M['pot_terra'], C_FURN, r2=0.05, bev=0.008)
for i, (dx, dy, rx, ry) in enumerate([(-0.05, 0, 0.2, -0.4), (0.05, 0.02, -0.25, 0.4), (0, -0.04, 0.3, 0.0), (0.01, 0.05, -0.3, 0.1)]):
    ellipsoid(f'tv_plant_leaf_{i}', 7.75 + dx, 5.95 + dy, 0.7, 0.03, 0.03, 0.11, M['leaf2'], C_FURN, rot=(rx, ry, 0))

# křeslo (sedí se směrem +gy, k divákovi)
AX0, AX1, AY0, AY1 = 10.85, 11.85, 2.35, 3.45
gbox('chair_base', AX0, AY0, AX1, AY1, 0.12, 0.38, M['fabric_sage'], C_FURN, r=0.05)
gbox('chair_back', AX0, AY0, AX1, AY0 + 0.3, 0.38, 0.86, M['fabric_sage'], C_FURN, r=0.07)
gbox('chair_arm_a', AX0, AY0, AX0 + 0.26, AY1, 0.38, 0.62, M['fabric_sage'], C_FURN, r=0.06)
gbox('chair_arm_b', AX1 - 0.26, AY0, AX1, AY1, 0.38, 0.62, M['fabric_sage'], C_FURN, r=0.06)
gbox('chair_seat', AX0 + 0.27, AY0 + 0.3, AX1 - 0.27, AY1 - 0.02, 0.38, 0.5, M['fabric_sage'], C_FURN, r=0.05)
gbox('chair_pillow', AX0 + 0.4, AY0 + 0.3, AX1 - 0.4, AY0 + 0.48, 0.5, 0.78, M['fabric_cream'], C_FURN, r=0.06)
for i, (x, y) in enumerate([(AX0 + 0.08, AY0 + 0.08), (AX0 + 0.08, AY1 - 0.13), (AX1 - 0.13, AY0 + 0.08), (AX1 - 0.13, AY1 - 0.13)]):
    gbox(f'chair_leg_{i}', x, y, x + 0.05, y + 0.05, FLOOR_Z, 0.13, M['walnut'], C_FURN, r=0.005)

# odkládací stolek + stolní lampa (u okna)
cyl('side_table_top', 11.45, 1.75, 0.52, 0.55, 0.2, M['oak'], C_FURN, bev=0.008)
cyl('side_table_leg', 11.45, 1.75, FLOOR_Z, 0.52, 0.02, M['walnut'], C_FURN)
cyl('side_table_foot', 11.45, 1.75, FLOOR_Z, FLOOR_Z + 0.02, 0.12, M['walnut'], C_FURN, bev=0.006)
ellipsoid('table_lamp_base', 11.45, 1.75, 0.63, 0.08, 0.08, 0.09, M['ceramic'], C_DEV)
cyl('table_lamp_shade', 11.45, 1.75, 0.72, 0.9, 0.13, M['linen'], C_DEV, r2=0.1, bev=0.004)
cyl('table_lamp_glow', 11.45, 1.75, 0.72, 0.725, 0.12, M['warm_glow'], C_DEV, bev=0)

# stojací lampa
FLX, FLY = 6.75, 0.45
cyl('floor_lamp_base', FLX, FLY, FLOOR_Z, FLOOR_Z + 0.03, 0.13, M['graphite'], C_DEV, bev=0.008)
cyl('floor_lamp_pole', FLX, FLY, FLOOR_Z + 0.03, 1.4, 0.012, M['graphite'], C_DEV)
cyl('floor_lamp_shade', FLX, FLY, 1.32, 1.62, 0.21, M['linen'], C_DEV, r2=0.17, bev=0.004)
cyl('floor_lamp_glow', FLX, FLY, 1.32, 1.325, 0.2, M['warm_glow'], C_DEV, bev=0)

# radiátor + termostat (zařízení)
gbox('radiator', 5.0, 0.03, 6.4, 0.2, 0.18, 0.78, M['white'], C_DEV, r=0.015)
for i in range(11):
    x = 5.08 + i * 0.12
    gbox(f'radiator_fin_{i}', x, 0.2, x + 0.05, 0.215, 0.22, 0.74, mat('rad_fin', '#eceeee', 0.3), C_DEV, r=0.004)
# vypínač
gbox('switch', 4.88, 0.0, 5.06, 0.03, 1.05, 1.17, M['white'], C_DEV, r=0.006)

# obraz nad gaučem
gbox('art_frame', 7.75, 0.0, 9.25, 0.05, 1.3, 2.06, M['walnut'], C_FURN, r=0.006)
gbox('art_canvas', 7.82, 0.05, 9.18, 0.055, 1.35, 2.01, M['art_cream'], C_FURN, r=0)
cyl('art_sun', 0, 0, 0, 0.004, 0.14, M['art_orange'], C_FURN, axis='Y', center=(8.7, 0.057, 1.8), bev=0)
gbox('art_hill_a', 7.82, 0.058, 8.9, 0.062, 1.35, 1.6, M['art_sage'], C_FURN, r=0)
gbox('art_hill_b', 8.5, 0.058, 9.18, 0.064, 1.35, 1.52, M['art_terra'], C_FURN, r=0)

# závěsy + garnýž
def curtain(name, gx0, gx1, gy, z0, z1, waves=4, amp=0.035):
    bm = bmesh.new()
    n = waves * 8
    rows = []
    for zi, z in enumerate((z0, z1)):
        row = []
        for i in range(n + 1):
            t = i / n
            x = (gx0 + (gx1 - gx0) * t) * S
            y = -(gy * S) - amp - amp * math.sin(t * waves * 2 * math.pi)
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for i in range(n):
        bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
    ob = to_obj(name, bm, M['curtain'], C_FURN, angle=180)
    sol = ob.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.01
    return ob


curtain('curtain_l', 9.4, 9.95, 0.12, 0.55, 2.3)
curtain('curtain_r', 11.45, 12.0, 0.12, 0.55, 2.3)
cyl('curtain_rod', 0, 0, 0, 2.7 * S, 0.012, M['graphite'], C_FURN, axis='X', center=(10.7, 0.15, 2.32))

# velká rostlina
PLX, PLY = 11.4, 6.3
cyl('big_pot', PLX, PLY, FLOOR_Z, 0.5, 0.2, M['pot'], C_FURN, r2=0.16, bev=0.02)
cyl('big_pot_soil', PLX, PLY, 0.47, 0.49, 0.18, M['soil_pot'], C_FURN, bev=0)
import random
random.seed(4)
for i in range(11):
    a = i / 11 * 2 * math.pi + random.uniform(-0.2, 0.2)
    tilt = random.uniform(0.5, 0.9)
    h = random.uniform(0.85, 1.25)
    L = random.uniform(0.17, 0.24)
    cx = PLX + math.cos(a) * 0.12 / S * 1.6
    cy = PLY + math.sin(a) * 0.12 / S * 1.6
    ellipsoid(f'big_leaf_{i}', cx, cy, h, L * 0.55, 0.012, L, M['leaf' if i % 2 else 'leaf2'], C_FURN,
              rot=(0, tilt, -a), subdiv=3)
    cyl(f'big_stem_{i}', PLX + math.cos(a) * 0.05, PLY + math.sin(a) * 0.05, 0.48, h - 0.1, 0.006, M['leaf'], C_FURN, bev=0)

# dokovací stanice robotického vysavače (vysavač i hlava kamery jsou ve hře živé 3D objekty)
gbox('dock_base', 4.72, 4.7, 4.98, 5.3, FLOOR_Z, FLOOR_Z + 0.012, M['graphite'], C_DEV, r=0.003)
gbox('dock', 4.7, 4.77, 4.84, 5.23, FLOOR_Z, FLOOR_Z + 0.17, M['white'], C_DEV, r=0.025)
gbox('dock_led', 4.84, 4.96, 4.845, 5.04, FLOOR_Z + 0.12, FLOOR_Z + 0.135, M['led_blue'], C_DEV, r=0.001)

# držák kamery v rohu
gbox('cam_mount', 11.75, 0.0, 11.95, 0.06, 2.2, 2.3, M['white'], C_DEV, r=0.01)
cyl('cam_arm', 11.85, 0.08, 2.24, 2.26, 0.018, M['white'], C_DEV, bev=0.004)

# polička nad radiátorem
gbox('wall_shelf', 5.0, 0.0, 6.5, 0.32, 1.72, 1.75, M['oak'], C_FURN, r=0.004)
for i, (x, w, h) in enumerate([(5.1, 0.07, 0.22), (5.19, 0.06, 0.19), (5.27, 0.08, 0.24), (5.37, 0.05, 0.2)]):
    gbox(f'shelf_book_{i}', x, 0.04, x + w, 0.28, 1.75, 1.75 + h, M['books'][i % 3], C_FURN, r=0.006)
cyl('shelf_pot', 6.15, 0.16, 1.75, 1.86, 0.06, M['pot_terra'], C_FURN, r2=0.05, bev=0.008)
for i in range(6):
    a = i / 6 * 2 * math.pi
    ellipsoid(f'shelf_trail_{i}', 6.15 + math.cos(a) * 0.08, 0.16 + abs(math.sin(a)) * 0.12, 1.84 - 0.06 * (i % 3),
              0.035, 0.035, 0.06 + 0.03 * (i % 3), M['leaf2' if i % 2 else 'leaf'], C_FURN)
cyl('shelf_vase', 5.75, 0.16, 1.75, 1.9, 0.045, M['ceramic'], C_FURN, r2=0.03, bev=0.01)

# rostlina v koupelně v rohu
cyl('bath_big_pot', 3.95, 4.6, FLOOR_Z, 0.36, 0.14, M['pot'], C_FURN, r2=0.12, bev=0.015)
for i in range(7):
    a = i / 7 * 2 * math.pi
    ellipsoid(f'bath_big_leaf_{i}', 3.95 + math.cos(a) * 0.12, 4.6 + math.sin(a) * 0.12, 0.62, 0.03, 0.03, 0.26,
              M['leaf'], C_FURN, rot=(math.sin(a) * 0.35, -math.cos(a) * 0.35, 0))

# ================================================================ VENKU
def tree(name, gx, gy, h, r):
    cyl(f'{name}_trunk', gx, gy, 0, h * 0.45, 0.06, M['bark'], C_OUT, r2=0.045, bev=0.01)
    ellipsoid(f'{name}_crown', gx, gy, h * 0.68, r, r, h * 0.36, M['tree'], C_OUT, subdiv=4)


def bush(name, gx, gy, r, n=4, seed=0):
    rnd = random.Random(seed)
    for i in range(n):
        dx, dy = rnd.uniform(-0.45, 0.45), rnd.uniform(-0.45, 0.45)
        rr = r * rnd.uniform(0.6, 1.0)
        ellipsoid(f'{name}_{i}', gx + dx, gy + dy, rr * 0.75, rr, rr, rr * 0.85, M['bush'], C_OUT, subdiv=3)


def hedge(name, gx0, gy0, gx1, gy1, h=0.5):
    gbox(name, gx0, gy0, gx1, gy1, 0.0, h, M['hedge'], C_OUT, r=0.12, seg=4)


def bollard(name, gx, gy):
    cyl(f'{name}', gx, gy, 0, 0.42, 0.035, M['black'], C_OUT, bev=0.005)
    cyl(f'{name}_light', gx, gy, 0.34, 0.39, 0.033, M['warm_glow'], C_OUT, bev=0)


tree('tree_a', -1.3, 5.3, 3.3, 0.8)
tree('tree_b', -1.1, 8.9, 2.6, 0.65)
tree('tree_c', 13.5, -0.6, 3.0, 0.75)
hedge('hedge_front', 0.3, 7.8, 4.6, 8.5)
hedge('hedge_right', 12.75, 1.5, 13.45, 6.5, 0.45)
bush('bush_a', 7.8, 8.2, 0.32, 4, 1)
bush('bush_b', 10.5, 8.0, 0.3, 4, 2)
bush('bush_c', -1.4, 2.0, 0.3, 3, 3)
bush('bush_d', 13.5, 8.6, 0.32, 4, 4)
bollard('bollard_a', 4.95, 8.5)
bollard('bollard_b', 7.05, 9.6)
bollard('bollard_c', 7.05, 7.6)

# ================================================================ SVĚTLA
point_light('L_floor_lamp', FLX, FLY, 1.42, 35)
point_light('L_table_lamp', 11.45, 1.75, 0.78, 15)
point_light('L_mirror', 3.6, 0.35, 1.6, 12, color=(1.0, 0.9, 0.78), radius=0.2)

sun_d = bpy.data.lights.new('sun', 'SUN')
sun_d.energy = 4.6
sun_d.angle = math.radians(9)
sun_d.color = (1.0, 0.93, 0.83)
sun = bpy.data.objects.new('sun', sun_d)
col_root.objects.link(sun)
sun.rotation_euler = (math.radians(40), 0, math.radians(-22))

world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
bgn = world.node_tree.nodes['Background']
bgn.inputs['Color'].default_value = srgb('#dfe9f2')
bgn.inputs['Strength'].default_value = 0.55

# ================================================================ KAMERA
cam_d = bpy.data.cameras.new('cam')
cam_d.type = 'ORTHO'
cam_d.ortho_scale = 14.4
cam = bpy.data.objects.new('cam', cam_d)
col_root.objects.link(cam)
cam.rotation_euler = (math.radians(60), 0, math.radians(45))
target = Vector((6.2 * S, -4.2 * S, 0.7))
view = cam.rotation_euler.to_matrix() @ Vector((0, 0, -1))
cam.location = target - view * 40
cam_d.clip_end = 200
scene.camera = cam

# ================================================================ RENDER
scene.render.engine = 'CYCLES'
cy = scene.cycles
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
        try:
            prefs.compute_device_type = t
            prefs.get_devices()
            devs = [d for d in prefs.devices if d.type == t]
            if devs:
                for d in prefs.devices:
                    d.use = d.type == t
                cy.device = 'GPU'
                print('GPU:', t, [d.name for d in devs])
                break
        except TypeError:
            pass
except Exception as e:
    print('GPU init failed', e)

ASPECT = 1062 / 1500
cy.use_denoising = True
cy.max_bounces = 6
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'


def color_look():
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    scene.view_settings.exposure = 0.15


def render_color(width, samples, path):
    color_look()
    cy.samples = samples
    scene.render.resolution_x = width
    scene.render.resolution_y = round(width * ASPECT)
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# objekty, které nesmí zakrývat postavu (průhledné sklo a tenké rámy)
NO_DEPTH = ('shower_glass', 'shower_frame', 'shower_post', 'win_liv_glass', 'win_bath_glass')
DEPTH_MIN, DEPTH_RANGE = 20.0, 40.0


def render_depth(width, path):
    """Hloubka podél osy kamery, normalizovaná do 16bit šedotónového PNG."""
    for ob in scene.objects:
        if ob.name.startswith(NO_DEPTH):
            ob.hide_render = True
    m = bpy.data.materials.new('depth_override')
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    N.clear()
    camd = N.new('ShaderNodeCameraData')
    mr = N.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = DEPTH_MIN
    mr.inputs['From Max'].default_value = DEPTH_MIN + DEPTH_RANGE
    mr.clamp = True
    em = N.new('ShaderNodeEmission')
    out = N.new('ShaderNodeOutputMaterial')
    L.new(camd.outputs['View Z Depth'], mr.inputs['Value'])
    L.new(mr.outputs['Result'], em.inputs['Color'])
    L.new(em.outputs['Emission'], out.inputs['Surface'])
    scene.view_layers[0].material_override = m
    scene.view_settings.view_transform = 'Raw'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.render.dither_intensity = 0.0
    cy.samples = 1
    cy.use_denoising = False
    cy.filter_width = 0.01
    scene.render.resolution_x = width
    scene.render.resolution_y = round(width * ASPECT)
    scene.render.image_settings.color_mode = 'BW'
    scene.render.image_settings.color_depth = '16'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def camera_info():
    mw = cam.matrix_world
    r = Vector(mw.col[0][:3])
    u = Vector(mw.col[1][:3])
    view = -Vector(mw.col[2][:3])
    T = target
    return {
        'tile': S,
        'orthoScale': cam_d.ortho_scale,
        'aspect': ASPECT,
        'centerX': T.dot(r),
        'centerY': T.dot(u),
        # P·view = zc + depthOffset (zc = hloubka z Cycles)
        'depthOffset': T.dot(view) - (cam.location - T).length,
        'depthMin': DEPTH_MIN,
        'depthRange': DEPTH_RANGE,
        'right': list(r), 'up': list(u), 'view': list(view),
    }


bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'house.blend'))
if MODE == 'export':
    import json
    W_EXPORT = int(argv[2]) if len(argv) > 2 else 3072
    render_color(W_EXPORT, 256, os.path.join(OUT, 'raw_color.png'))
    render_depth(W_EXPORT, os.path.join(OUT, 'raw_depth.png'))
    with open(os.path.join(OUT, 'camera.json'), 'w') as f:
        json.dump(camera_info(), f, indent=2)
    print('EXPORT DONE')
else:
    final = MODE == 'final'
    render_color(2400 if final else 1500, 256 if final else 64, os.path.join(OUT, f'house_{MODE}.png'))
    print('RENDER DONE', scene.render.filepath)
