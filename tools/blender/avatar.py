"""
Little Hack House – postavička Toník jako 3D model (procedurálně v Blenderu).
Spuštění: blender -b --factory-startup --python avatar.py -- <out_dir> [glb|preview]

glb     – jen avatar.glb (pro hru: public/assets/character)
preview – navíc avatar.blend a náhledy všech póz (avatar_poses.png) [iso|side]

Postava stojí v počátku, kouká do -Y (= +gy v herní mřížce), 1 jednotka = 1 m, nula = podlaha.
Díly jsou tuhé a visí na kostech (hračkový styl, žádné vážení vrcholů).
Obličej (oči, pusa, tvářičky) je rovina „face“ s UV – hra na ni kreslí výraz z plátna.
Pózy jsou akce: idle, walk, sit, sleep, blanket, read, warm, press, shower, dance, slip, ears, tuck, phone.
Doplňky blanket / book / towel / shower_cap / phone hra zobrazuje jen v příslušné póze.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.dirname(__file__)
MODE = argv[1] if len(argv) > 1 else 'glb'
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
col_root = scene.collection
C_AV = bpy.data.collections.new('avatar')
col_root.children.link(C_AV)


# ---------------------------------------------------------------- materiály
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def mat(name, color, rough=0.5, sheen=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color)
    b.inputs['Roughness'].default_value = rough
    if sheen:
        b.inputs['Sheen Weight'].default_value = sheen
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    m.diffuse_color = srgb(color)
    return m


# barvy drží hra (src/game/scene/three/Avatar3D.ts) – tady jen pro náhled v Blenderu
M = {
    'skin': mat('skin', '#f7d3bf', 0.55, sheen=0.2),
    'hair': mat('hair', '#4b3226', 0.6, sheen=0.3),
    'face': mat('face', '#ffffff', 0.5, alpha=0.0),
    'sweater': mat('sweater', '#3ea998', 0.75, sheen=0.5),
    'sweater_rib': mat('sweater_rib', '#37998a', 0.8, sheen=0.5),
    'pants': mat('pants', '#3f4560', 0.75, sheen=0.3),
    'shoe': mat('shoe', '#f3f3f1', 0.45),
    'sole': mat('sole', '#dcdcd8', 0.6),
    'blanket': mat('blanket', '#f2c46d', 0.9, sheen=0.5),
    'book': mat('book', '#e27d60', 0.6),
    'paper': mat('paper', '#fff2dc', 0.8),
    'towel': mat('towel', '#ffffff', 0.9, sheen=0.4),
    'cap': mat('cap', '#f7a8c4', 0.5),
    'phone': mat('phone', '#2b2f36', 0.4),
    'phone_screen': mat('phone_screen', '#9fd8ff', 0.3),
}


# ---------------------------------------------------------------- geometrie
def to_obj(name, bm, material, angle=180):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    if angle < 180:
        me.set_sharp_from_angle(angle=math.radians(angle))
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    C_AV.objects.link(ob)
    return ob


def ellipsoid(name, c, r, material, rot=(0, 0, 0), subdiv=3):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    Mtx = Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*r, 1))
    bmesh.ops.transform(bm, matrix=Mtx, verts=bm.verts)
    return to_obj(name, bm, material)


def capsule(name, a, b, r1, material, r2=None):
    """Kapsle z bodu a do b, poloměr r1 u a a r2 u b."""
    a, b = Vector(a), Vector(b)
    r2 = r1 if r2 is None else r2
    L = (b - a).length
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1.0)
    for v in bm.verts:
        top = v.co.z > 1e-5
        r = r2 if top else r1
        v.co = Vector((v.co.x * r, v.co.y * r, v.co.z * r + (L if top else 0)))
    rot = Vector((0, 0, 1)).rotation_difference((b - a).normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(a) @ rot, verts=bm.verts)
    return to_obj(name, bm, material)


def rbox(name, c, size, r, material, seg=4, rot=(0, 0, 0)):
    """Zaoblený kvádr (střed, rozměry, poloměr zaoblení)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    r = min(r, 0.49 * min(size))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=r, segments=seg, profile=0.5, affect='EDGES',
                    clamp_overlap=True)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4(), verts=bm.verts)
    return to_obj(name, bm, material, angle=60)


def tube(name, pts, r, material, cyclic=False):
    """Trubka po lomené čáře (límec) – převedená na mesh."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY' if cyclic else 'NURBS')
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1.0)
    sp.use_cyclic_u = cyclic
    tmp = bpy.data.objects.new(name + '_crv', cu)
    C_AV.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    me.name = name
    me.shade_smooth()
    me.materials.clear()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    C_AV.objects.link(ob)
    return ob


parts = []  # (objekt, kost)


def part(ob, bone):
    parts.append((ob, bone))
    return ob


# ================================================================ TĚLO
# rozměry odměřené z předlohy (výška ~1,6 m)
HX, HY, HZ, HC = 0.136, 0.128, 0.142, 1.395   # hlava: poloosy a výška středu
SH_X, EL_X, WR_X = 0.172, 0.205, 0.218        # ramena / lokty / zápěstí (x)
LEG_X = 0.08
# obličejové plátno: 1 jednotka kresby = FACE_K m, plátno pokrývá ±FACE_U jednotek kolem středu
FACE_K = HX / 16
FACE_U = 20
FACE_ZC = HC - 2 * FACE_K

# --- trup
part(rbox('m_sweater', (0, 0, 0.975), (0.32, 0.20, 0.47), 0.075, M['sweater']), 'spine')
part(rbox('m_sweater_hem', (0, 0, 0.765), (0.325, 0.205, 0.06), 0.03, M['sweater_rib']), 'spine')
part(tube('m_collar', [(0.068 * math.cos(a), 0.062 * math.sin(a) - 0.005, 1.208)
                       for a in [i * 2 * math.pi / 20 for i in range(20)]], 0.014, M['sweater_rib'], cyclic=True),
     'spine')
part(capsule('m_neck', (0, 0, 1.17), (0, 0, 1.29), 0.045, M['skin']), 'neck')

# --- kalhoty a boty
part(rbox('m_pants_hip', (0, 0, 0.70), (0.27, 0.18, 0.17), 0.07, M['pants']), 'pelvis')
for s, side in ((1, 'L'), (-1, 'R')):
    x = s * LEG_X
    part(capsule(f'm_thigh.{side}', (x, 0, 0.70), (x, 0, 0.43), 0.068, M['pants'], 0.062), f'thigh.{side}')
    part(capsule(f'm_shin.{side}', (x, 0, 0.45), (x, 0, 0.20), 0.061, M['pants'], 0.063), f'shin.{side}')
    part(capsule(f'm_cuff.{side}', (x, 0, 0.15), (x, 0, 0.20), 0.068, M['pants']), f'shin.{side}')
    part(rbox(f'm_shoe.{side}', (x, -0.035, 0.07), (0.115, 0.255, 0.11), 0.05, M['shoe']), f'foot.{side}')
    part(rbox(f'm_sole.{side}', (x, -0.035, 0.018), (0.112, 0.25, 0.036), 0.016, M['sole']), f'foot.{side}')

# --- ruce (svěšené podél těla)
for s, side in ((1, 'L'), (-1, 'R')):
    sh = Vector((s * SH_X, 0, 1.13))
    el = Vector((s * EL_X, 0, 0.93))
    wr = Vector((s * WR_X, 0, 0.75))
    part(capsule(f'm_sleeve_up.{side}', sh, el, 0.058, M['sweater'], 0.054), f'upper_arm.{side}')
    part(capsule(f'm_sleeve_lo.{side}', el + Vector((0, 0, 0.02)), wr + Vector((0, 0, 0.03)), 0.054,
                 M['sweater'], 0.051), f'forearm.{side}')
    part(capsule(f'm_sleeve_cuff.{side}', wr + Vector((0, 0, 0.035)), wr, 0.058, M['sweater_rib']),
         f'forearm.{side}')
    part(ellipsoid(f'm_hand.{side}', (s * (WR_X + 0.008), -0.004, 0.68), (0.032, 0.048, 0.068), M['skin'],
                   rot=(0, s * 0.08, 0)), f'hand.{side}')
    part(ellipsoid(f'm_thumb.{side}', (s * (WR_X - 0.012), -0.038, 0.705), (0.017, 0.017, 0.032), M['skin'],
                   rot=(0.35, 0, 0)), f'hand.{side}')

# ================================================================ HLAVA
part(ellipsoid('m_head', (0, 0, HC), (HX, HY, HZ), M['skin'], subdiv=4), 'head')
for s, side in ((1, 'L'), (-1, 'R')):
    part(ellipsoid(f'm_ear.{side}', (s * (HX - 0.005), 0.008, HC - 0.02), (0.022, 0.03, 0.038), M['skin']), 'head')
nose_z = HC - 0.03
nose_y = -HY * math.sqrt(1 - ((nose_z - HC) / HZ) ** 2)
part(ellipsoid('m_nose', (0, nose_y + 0.003, nose_z), (0.017, 0.014, 0.015), M['skin']), 'head')

# --- obličejová rovina: přední část hlavy těsně nad kůží, UV = pravoúhlý průmět do XZ
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=5, radius=1.0)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -0.3 or v.co.z > 0.62 or v.co.z < -0.9],
                 context='VERTS')
bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((0, 0, HC))
                    @ Matrix.Diagonal((HX + 0.0015, HY + 0.0015, HZ + 0.0015, 1)))
uv = bm.loops.layers.uv.new('UVMap')
span = 2 * FACE_U * FACE_K
for f in bm.faces:
    for lp in f.loops:
        co = lp.vert.co
        lp[uv].uv = (0.5 + co.x / span, 0.5 + (co.z - FACE_ZC) / span)
part(to_obj('face', bm, M['face']), 'head')

# --- vlasy: čepice přes hlavu s vyříznutým obličejem + účes (patka nahoru)
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
kill = [v for v in bm.verts
        if (v.co.z < 0.30 and v.co.y < -0.42)       # obličej
        or (v.co.z < -0.02 and v.co.y < 0.35)       # boky pod spánky (uši zůstanou vidět)
        or (v.co.z < -0.42)]                        # zátylek
bmesh.ops.delete(bm, geom=kill, context='VERTS')
bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((0, 0.006, HC + 0.008))
                    @ Matrix.Diagonal((HX + 0.013, HY + 0.014, HZ + 0.016, 1)))
hair = part(to_obj('hair', bm, M['hair']), 'head')
sol = hair.modifiers.new('solid', 'SOLIDIFY')
sol.thickness = 0.014
sol.offset = 1.0
for i, (c, r, rot) in enumerate((
        ((0.03, -0.065, HC + 0.118), (0.09, 0.066, 0.05), (0.35, 0.15, 0.25)),
        ((-0.048, -0.054, HC + 0.126), (0.072, 0.066, 0.048), (0.3, -0.2, -0.2)),
        ((0.0, 0.0, HC + 0.142), (0.114, 0.102, 0.054), (0.1, 0, 0)),
        ((0.084, -0.012, HC + 0.108), (0.06, 0.084, 0.054), (0.0, 0.3, 0)),
        ((0.102, -0.072, HC + 0.072), (0.036, 0.048, 0.048), (0.2, 0.2, 0)),
        ((-0.108, -0.048, HC + 0.066), (0.036, 0.06, 0.048), (0.2, -0.2, 0)),
)):
    part(ellipsoid(f'hair_tuft{i}', c, r, M['hair']), 'head')

# ================================================================ DOPLŇKY (hra je zapíná podle pózy)
# deka – tvarovaná na sed (pánev se při sedu neotáčí, jen klesne)
part(rbox('blanket', (0, 0.01, 0.9), (0.42, 0.29, 0.54), 0.13, M['blanket']), 'pelvis')
part(rbox('blanket_lap', (0, -0.16, 0.715), (0.41, 0.40, 0.21), 0.1, M['blanket']), 'pelvis')
part(capsule('blanket_roll', (-0.19, 0.0, 1.13), (0.19, 0.0, 1.13), 0.07, M['blanket']), 'pelvis')
part(rbox('towel', (0, 0, 0.655), (0.315, 0.22, 0.19), 0.07, M['towel']), 'pelvis')
# mobil v pravé dlani (displej ke tváři, když ruku zvedne)
part(rbox('phone', (-(WR_X - 0.01), -0.05, 0.655), (0.014, 0.078, 0.15), 0.006, M['phone']), 'hand.R')
part(rbox('phone_screen', (-(WR_X - 0.019), -0.05, 0.655), (0.004, 0.066, 0.13), 0.002, M['phone_screen']), 'hand.R')
part(ellipsoid('shower_cap', (0, 0.006, HC + 0.055), (HX + 0.03, HY + 0.03, HZ * 0.78), M['cap'], subdiv=4), 'head')

# ================================================================ KOSTRA
arm_d = bpy.data.armatures.new('rig')
arm = bpy.data.objects.new('avatar', arm_d)
C_AV.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
BONES = [
    # jméno, hlava, ocas, rodič
    ('root', (0, 0, 0), (0, 0, 0.12), None),
    ('pelvis', (0, 0, 0.68), (0, 0, 0.80), 'root'),
    ('spine', (0, 0, 0.80), (0, 0, 1.17), 'pelvis'),
    ('neck', (0, 0, 1.17), (0, 0, 1.28), 'spine'),
    ('head', (0, 0, 1.28), (0, 0, 1.62), 'neck'),
]
for s, side in ((1, 'L'), (-1, 'R')):
    BONES += [
        (f'upper_arm.{side}', (s * SH_X, 0, 1.13), (s * EL_X, 0, 0.93), 'spine'),
        (f'forearm.{side}', (s * EL_X, 0, 0.93), (s * WR_X, 0, 0.75), f'upper_arm.{side}'),
        (f'hand.{side}', (s * WR_X, 0, 0.75), (s * (WR_X + 0.01), 0, 0.62), f'forearm.{side}'),
        (f'thigh.{side}', (s * LEG_X, 0, 0.70), (s * LEG_X, 0, 0.44), 'pelvis'),
        (f'shin.{side}', (s * LEG_X, 0, 0.44), (s * LEG_X, 0, 0.13), f'thigh.{side}'),
        (f'foot.{side}', (s * LEG_X, 0, 0.13), (s * LEG_X, -0.15, 0.06), f'shin.{side}'),
    ]
for name, h, t, par in BONES:
    eb = arm_d.edit_bones.new(name)
    eb.head, eb.tail = h, t
    eb.roll = 0
    if par:
        eb.parent = arm_d.edit_bones[par]
        eb.use_connect = Vector(h) == arm_d.edit_bones[par].tail
bpy.ops.object.mode_set(mode='OBJECT')


def attach(ob, bn):
    b = arm_d.bones[bn]
    ob.parent = arm
    ob.parent_type = 'BONE'
    ob.parent_bone = bn
    ob.matrix_parent_inverse = (arm.matrix_world @ b.matrix_local
                                @ Matrix.Translation((0, b.length, 0))).inverted()


for ob, bn in parts:
    attach(ob, bn)

# ================================================================ POZY
P = arm.pose.bones
for pb in P:
    pb.rotation_mode = 'XYZ'
vl = bpy.context.view_layer
vl.update()

# která lokální osa (a znaménko) kosti odpovídá otočení kolem světové osy X / Y / Z
AXES = {}
for pb in P:
    rest = pb.matrix.to_3x3().copy()
    AXES[pb.name] = {}
    for W in 'XYZ':
        exp = Matrix.Rotation(0.3, 3, W) @ rest
        best = None
        for i in range(3):
            for sg in (1, -1):
                e = [0.0, 0.0, 0.0]
                e[i] = 0.3 * sg
                pb.rotation_euler = e
                vl.update()
                m = pb.matrix.to_3x3()
                err = sum((m[r][c] - exp[r][c]) ** 2 for r in range(3) for c in range(3))
                if best is None or err < best[0]:
                    best = (err, i, sg)
        pb.rotation_euler = (0, 0, 0)
        vl.update()
        AXES[pb.name][W] = best[1:]
ROOT_UP = arm_d.bones['root'].matrix_local.to_3x3().inverted() @ Vector((0, 0, 1))
SOLE = {side: [Vector((s * LEG_X + dx, y, 0.0)) for dx in (-0.05, 0.05) for y in (0.09, -0.16)]
        for s, side in ((1, 'L'), (-1, 'R'))}
SIDES = (('L', 1), ('R', -1))


def rot(name, W, a):
    """Přičte otočení kosti kolem světové osy W (v klidové póze)."""
    i, sg = AXES[name][W]
    P[name].rotation_euler[i] += sg * a


def fwd(name, a):
    """Kost visící dolů: + = konec jde dopředu (−Y). Kost mířící nahoru: + = předklon."""
    up = (arm_d.bones[name].tail_local - arm_d.bones[name].head_local).z > 0
    rot(name, 'X', a if up else -a)


def abduct(side, s, a):
    """Upažení paže o úhel a (+ = od těla)."""
    rot(f'upper_arm.{side}', 'Y', -s * a)


def lift(dz):
    P['root'].location = P['root'].location + ROOT_UP * dz


def reset():
    for pb in P:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)


def ground():
    """Posune root tak, aby se nejnižší bod podrážky dotýkal země."""
    vl.update()
    lo = min((P[f'foot.{sd}'].matrix @ arm_d.bones[f'foot.{sd}'].matrix_local.inverted() @ p).z
             for sd in 'LR' for p in SOLE[sd])
    lift(-lo)
    vl.update()


# sed: kyčle 0,49 m nad podlahou (sedák gauče 0,42 m), holeně svisle, chodidla na zemi
SIT_HIP = 0.49
SIT_THIGH = math.pi / 2 - math.asin((SIT_HIP - 0.13 - 0.31) / 0.26)


def sit_base():
    for sd, s in SIDES:
        fwd(f'thigh.{sd}', SIT_THIGH)
        fwd(f'shin.{sd}', -SIT_THIGH)
    lift(SIT_HIP - 0.70)


def p_idle(p):
    b = math.sin(p)
    fwd('spine', 0.015 * b)
    fwd('head', 0.02 * math.sin(p + 0.6))
    for sd, s in SIDES:
        fwd(f'upper_arm.{sd}', 0.03 - 0.02 * b)
        fwd(f'forearm.{sd}', 0.12 + 0.02 * b)
        abduct(sd, s, 0.04)
    ground()
    lift(0.004 * b)


def p_walk(p):
    fwd('spine', 0.05)
    fwd('head', -0.03)
    rot('pelvis', 'Z', 0.10 * math.sin(p))
    rot('spine', 'Z', -0.16 * math.sin(p))
    for sd, ph in (('L', 0.0), ('R', math.pi)):
        q = p + ph
        f = 0.42 * math.sin(q)                                   # stehno dopředu
        k = 0.08 + 0.75 * max(0.0, math.cos(q)) ** 1.6          # koleno při švihu
        fwd(f'thigh.{sd}', f)
        fwd(f'shin.{sd}', -k)
        toe = 0.25 * max(0.0, -math.sin(q - 0.9)) * (math.sin(q) < 0)
        fwd(f'foot.{sd}', k - f - toe)
        fwd(f'upper_arm.{sd}', -0.38 * math.sin(q))              # ruka proti noze
        fwd(f'forearm.{sd}', 0.22 + 0.25 * max(0.0, -math.sin(q)))
        abduct(sd, 1 if sd == 'L' else -1, 0.05)
    ground()
    lift(0.012 * math.cos(2 * p))


def p_sit(p):
    sit_base()
    fwd('spine', -0.16 + 0.012 * math.sin(p))
    fwd('head', 0.06)
    for sd, s in SIDES:
        fwd(f'upper_arm.{sd}', 0.35)
        fwd(f'forearm.{sd}', 0.85)
        abduct(sd, s, 0.08)


def p_sleep(p):
    sit_base()
    fwd('spine', -0.22 + 0.02 * math.sin(p))
    fwd('neck', 0.25)
    fwd('head', 0.3)
    rot('head', 'Y', 0.3)
    for sd, s in SIDES:
        fwd(f'upper_arm.{sd}', 0.15)
        fwd(f'forearm.{sd}', 0.7)
        abduct(sd, s, 0.12)


def p_blanket(p):
    sit_base()
    fwd('spine', -0.04 + 0.01 * math.sin(p))
    fwd('head', 0.05)
    for sd, s in SIDES:
        fwd(f'upper_arm.{sd}', 0.5)
        fwd(f'forearm.{sd}', 1.4)
        abduct(sd, s, -0.2)


def p_read(p):
    sit_base()
    fwd('spine', 0.02)
    fwd('neck', 0.12)
    fwd('head', 0.28 + 0.02 * math.sin(p))
    for sd, s in SIDES:
        fwd(f'upper_arm.{sd}', 0.55)
        fwd(f'forearm.{sd}', 1.5)
        abduct(sd, s, -0.1)


def p_warm(p):
    # ruce natažené k radiátoru, lehce je mne
    fwd('spine', 0.08)
    for sd, s in SIDES:
        fwd(f'upper_arm.{sd}', 0.95)
        fwd(f'forearm.{sd}', 0.45 + 0.12 * math.sin(p + (0 if s > 0 else math.pi)))
        fwd(f'hand.{sd}', 0.9)
        abduct(sd, s, -0.18)
    ground()


def p_press(p):
    # pravou rukou mačká vypínač / tlačítko
    k = 0.5 + 0.5 * math.sin(p)
    fwd('spine', 0.04)
    fwd('upper_arm.R', 1.25 + 0.12 * k)
    fwd('forearm.R', 0.35 - 0.25 * k)
    abduct('R', -1, -0.12)
    fwd('upper_arm.L', 0.02)
    fwd('forearm.L', 0.15)
    abduct('L', 1, 0.05)
    ground()


def p_shower(p):
    # ruce nad hlavou, myje si vlasy
    fwd('head', -0.12)
    for sd, s in SIDES:
        abduct(sd, s, 1.9)
        rot(f'forearm.{sd}', 'Y', -s * (1.75 + 0.12 * math.sin(2 * p + (0 if s > 0 else 1.5))))
        fwd(f'upper_arm.{sd}', 0.3)
    ground()


def p_dance(p):
    b = math.sin(p)
    bend = 0.18 + 0.14 * abs(math.sin(p))
    for sd, s in SIDES:
        fwd(f'thigh.{sd}', bend)
        fwd(f'shin.{sd}', -2 * bend)
        fwd(f'foot.{sd}', bend)
        abduct(sd, s, 1.3 + 0.8 * b * s)
        fwd(f'upper_arm.{sd}', 0.3)
        fwd(f'forearm.{sd}', 0.7)
    rot('pelvis', 'Z', 0.22 * b)
    rot('spine', 'Y', 0.1 * b)
    rot('head', 'Y', -0.12 * b)
    ground()


def p_slip(p):
    # uklouzl a sedí na zemi, opírá se o ruce
    for sd, s in SIDES:
        fwd(f'thigh.{sd}', 1.45)
        rot(f'thigh.{sd}', 'Y', -s * 0.18)
        fwd(f'shin.{sd}', -0.1)
        fwd(f'upper_arm.{sd}', -0.55)
        abduct(sd, s, 0.35)
        fwd(f'forearm.{sd}', 0.1)
    fwd('spine', -0.3)
    fwd('head', 0.15)
    rot('head', 'Y', 0.12 * math.sin(p))
    lift(0.075 - 0.70)


def p_ears(p):
    # zakrývá si uši a vrtí hlavou
    fwd('spine', 0.06)
    for sd, s in SIDES:
        abduct(sd, s, 1.4)
        fwd(f'upper_arm.{sd}', 0.3)
        rot(f'forearm.{sd}', 'Y', -s * 2.6)
    rot('head', 'Z', 0.18 * math.sin(p))
    ground()


def p_tuck(p):
    # na gauči s koleny u brady
    sit_base()
    for sd, s in SIDES:
        fwd(f'thigh.{sd}', 2.35 - SIT_THIGH)
        fwd(f'shin.{sd}', -(2.35 - SIT_THIGH) - 0.25)
        fwd(f'upper_arm.{sd}', 0.85)
        fwd(f'forearm.{sd}', 0.95)
        abduct(sd, s, -0.05)
    fwd('spine', 0.18 + 0.015 * math.sin(p))
    fwd('head', -0.05)


def p_phone(p):
    # kouká do mobilu v pravé ruce, levou má volně
    fwd('upper_arm.R', 0.35)
    fwd('forearm.R', 1.35)
    abduct('R', -1, -0.22)
    rot('hand.R', 'Z', -0.6)
    fwd('upper_arm.L', 0.05)
    fwd('forearm.L', 0.2)
    abduct('L', 1, 0.05)
    fwd('neck', 0.15)
    fwd('head', 0.25 + 0.03 * math.sin(p))
    ground()


# jméno: (funkce, snímků cyklu)
ANIMS = {
    'idle': (p_idle, 72), 'walk': (p_walk, 24),
    'sit': (p_sit, 96), 'sleep': (p_sleep, 120), 'blanket': (p_blanket, 72), 'read': (p_read, 96),
    'warm': (p_warm, 36), 'press': (p_press, 24), 'shower': (p_shower, 30), 'dance': (p_dance, 24),
    'slip': (p_slip, 48), 'ears': (p_ears, 24), 'tuck': (p_tuck, 96), 'phone': (p_phone, 72),
}
KEY_EVERY = {'walk': 1, 'dance': 1, 'press': 2, 'shower': 2, 'warm': 3, 'ears': 2, 'slip': 4}


def pose(name, i, n):
    reset()
    ANIMS[name][0](2 * math.pi * i / n)
    vl.update()


# kniha do rukou podle pózy read (kniha visí na páteři, ta se při sedu jen posune)
pose('read', 0, 1)
hands = [P[f'hand.{sd}'].matrix @ Vector((0, 0.05, 0)) for sd in 'LR']
c = (hands[0] + hands[1]) / 2 + Vector((0, -0.04, 0.02)) - ROOT_UP * 0 - Vector((0, 0, SIT_HIP - 0.70))
book = rbox('book', c, (0.24, 0.035, 0.17), 0.006, M['book'], rot=(-0.6, 0, 0))
pages = rbox('book_pages', c + Vector((0, -0.006, 0.004)), (0.225, 0.03, 0.16), 0.004, M['paper'], rot=(-0.6, 0, 0))
for ob in (book, pages):
    attach(ob, 'spine')
reset()
vl.update()

# akce (cyklické: poslední klíč = první)
arm.animation_data_create()
for an, (fn, n) in ANIMS.items():
    act = bpy.data.actions.new(an)
    act.use_fake_user = True
    arm.animation_data.action = act
    step = KEY_EVERY.get(an, 6)
    for i in list(range(0, n, step)) + [n]:
        pose(an, i % n, n)
        for pb in P:
            pb.keyframe_insert('rotation_euler', frame=i + 1)
            pb.keyframe_insert('location', frame=i + 1)
arm.animation_data.action = None
reset()
vl.update()

# ================================================================ VÝSTUP
if MODE == 'preview':
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'avatar.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'avatar.glb'), use_selection=False,
                          export_animations=True, export_animation_mode='ACTIONS',
                          export_apply=True, export_yup=True)
print('GLB DONE')

if MODE == 'preview':
    import numpy as np
    sun_d = bpy.data.lights.new('sun', 'SUN')
    sun_d.energy = 4.6
    sun_d.angle = math.radians(9)
    sun = bpy.data.objects.new('sun', sun_d)
    col_root.objects.link(sun)
    sun.rotation_euler = (math.radians(40), 0, math.radians(-22))
    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = srgb('#dfe9f2')
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55
    cam_d = bpy.data.cameras.new('cam')
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = 2.0
    cam = bpy.data.objects.new('cam', cam_d)
    col_root.objects.link(cam)
    scene.camera = cam
    VIEW = argv[2] if len(argv) > 2 else 'iso'
    rotc = Euler((math.radians(60), 0, math.radians(45))) if VIEW == 'iso' else Euler((math.radians(90), 0, math.radians(90)))
    cam.rotation_euler = rotc
    cam.location = Vector((0, 0, 0.75)) - (rotc.to_matrix() @ Vector((0, 0, -1))) * 20
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in {
        e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items} else 'BLENDER_EEVEE'
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = 320, 400
    scene.view_settings.view_transform = 'AgX'
    PROPS = {'blanket': ('blanket', 'blanket_lap', 'blanket_roll'), 'read': ('book', 'book_pages'),
             'shower': ('towel', 'shower_cap'), 'phone': ('phone', 'phone_screen')}
    allprops = [n for v in PROPS.values() for n in v]
    tiles = []
    arm.rotation_euler.z = math.radians(25) if VIEW == 'iso' else 0
    for an, (fn, n) in ANIMS.items():
        for nm in allprops:
            bpy.data.objects[nm].hide_render = nm not in PROPS.get(an, ())
        pose(an, n // 4, n)
        path = os.path.join(OUT, f'_pose_{an}.png')
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path)
        px = np.empty(320 * 400 * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        tiles.append(px.reshape(400, 320, 4))
        bpy.data.images.remove(img)
        os.remove(path)
    while len(tiles) % 5:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.concatenate(tiles[i:i + 5], axis=1) for i in range(0, len(tiles), 5)]
    sheet = np.concatenate(rows[::-1], axis=0)
    out = bpy.data.images.new('poses', sheet.shape[1], sheet.shape[0], alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = os.path.join(OUT, 'avatar_poses.png')
    out.file_format = 'PNG'
    out.save()
    print('PREVIEW DONE')
