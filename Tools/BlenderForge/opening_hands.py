# Run by render.cjs: blender -b --factory-startup --python opening_hands.py -- <poses.json> <out dir> <gbuffer|preview|verts> [part:i|part:all,...]
# Renders both forearms+hands: the MakeHuman CC0 mesh (makehuman/) already posed and skinned frame by
# frame in story/handRig.cjs (game coords: x right, y toward the viewer, z up; Blender y = -game y).
# Blender only builds the mesh from those vertices (+ subdivision) and renders it.
# gbuffer: the passes story/blenderHands.cjs reads. preview: a plain lit render with stand-in tin, 3x.
# verts: the mesh as Blender holds it (no subdivision), every frame, for Tools/BlenderForge/handChecks.cjs.
import bpy, json, sys, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
POSES, OUT, MODE = argv[:3]
FRAMES = argv[3] if len(argv) > 3 else 'hand:19'
G2B = lambda p: Vector((p[0], -p[1], p[2]))

def build_arm(side, mesh):
    co = mesh['co']
    me = bpy.data.meshes.new('arm' + side)
    me.from_pydata([(co[i], -co[i + 1], co[i + 2]) for i in range(0, len(co), 3)], [], mesh['faces'])
    me.shade_smooth()
    ob = bpy.data.objects.new('arm' + side, me)
    bpy.context.scene.collection.objects.link(ob)
    s = ob.modifiers.new('sub', 'SUBSURF'); s.levels = 1; s.render_levels = 2
    return ob

def pose(ob, h):
    co = h['co']
    flat = [0.0] * len(co)
    flat[0::3] = co[0::3]; flat[1::3] = [-y for y in co[1::3]]; flat[2::3] = co[2::3]
    ob.data.vertices.foreach_set('co', flat)
    ob.data.update()
    return h['joints']

def sleeve_obj(h, name):
    a, b, r = G2B(h['sleeve'][0]), G2B(h['sleeve'][1]), h['sleeve'][2]
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=r, radius2=r * 1.15, depth=(b - a).length, end_fill_type='NGON')
    ob = bpy.context.object; ob.name = name
    d = (b - a).normalized()
    ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    ob.location = (a + b) / 2
    bv = ob.modifiers.new('bev', 'BEVEL'); bv.width = r * .35; bv.segments = 4
    bpy.ops.object.shade_smooth()
    return ob

# ---------------------------------------------------------------- scene
def mat(name, col, rough=.6, sss=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*col, 1); p.inputs['Roughness'].default_value = rough
    if sss: p.inputs['Subsurface Weight'].default_value = sss; p.inputs['Subsurface Scale'].default_value = 2
    return m

def setup_view(k):
    sc = bpy.context.scene
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 480; cam.data.clip_end = 3000
    n = math.sqrt(1.25)
    cam.matrix_world = Matrix(((1, 0, 0, 240), (0, 1 / n, -.5 / n, -635), (0, .5 / n, 1 / n, 1000), (0, 0, 0, 1)))
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 480 * k, 270 * k, 100
    sc.render.pixel_aspect_x, sc.render.pixel_aspect_y = n, 1
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
    L = Vector((-.7, .18, .69)).normalized()
    sun.rotation_mode = 'QUATERNION'; sun.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(L)
    sun.data.energy = 3; sun.data.angle = math.radians(3)

def preview_props(deg):
    bpy.ops.mesh.primitive_plane_add(size=2000, location=(240, -170, 0)); bpy.context.object.data.materials.append(mat('table', (.25, .16, .1)))
    bpy.ops.mesh.primitive_cube_add(location=(240, -170, 24)); t = bpy.context.object; t.scale = (80, 52, 24)
    t.data.materials.append(mat('tin', (.3, .33, .32), .4))
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0)); l = bpy.context.object; l.scale = (82.5, 54.5, 7)
    hy, hz = -(170 - 52 - 2.5), 52
    l.data.materials.append(mat('lid', (.35, .3, .25), .4))
    # Lid centre in closed-lid coords (u 0, v 0, z 51) rotated about the hinge line by deg.
    th = math.radians(deg); Y, Z = 170 - (170 - 52 - 2.5), 51 - hz
    gy, gz = Y * math.cos(th) - Z * math.sin(th) + (170 - 52 - 2.5), Y * math.sin(th) + Z * math.cos(th) + hz
    l.location = (240, -gy, gz); l.rotation_euler = (th, 0, 0)

# ---------------------------------------------------------------- G-buffer (emission overrides, raw 16-bit)
L_B = Vector((-.7, .18, .69)).normalized()
SHADOW = {'centre': Vector((300, -250, 40)), 'scale': 640, 'res': 1280}

def emit_mat(name, build):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs[0])
    nt.links.new(build(nt), em.inputs['Color'])
    return m

def mapped(nt, src, scale, loc):
    mp = nt.nodes.new('ShaderNodeMapping'); mp.vector_type = 'POINT'
    mp.inputs['Scale'].default_value = scale; mp.inputs['Location'].default_value = loc
    nt.links.new(src, mp.inputs['Vector']); return mp.outputs[0]

def pass_pos(nt):    # x/512, game y/512, (z+64)/320
    return mapped(nt, nt.nodes.new('ShaderNodeNewGeometry').outputs['Position'], (1 / 512, -1 / 512, 1 / 320), (0, 0, .2))
def pass_nrm(nt):    # game normal * .5 + .5
    return mapped(nt, nt.nodes.new('ShaderNodeNewGeometry').outputs['Normal'], (.5, -.5, .5), (.5, .5, .5))
def pass_idao(nt):   # R: object pass index / 10, G: ambient occlusion among the hands
    oi = nt.nodes.new('ShaderNodeObjectInfo'); dv = nt.nodes.new('ShaderNodeMath'); dv.operation = 'DIVIDE'
    dv.inputs[1].default_value = 10; nt.links.new(oi.outputs['Object Index'], dv.inputs[0])
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 14; ao.samples = 16
    cc = nt.nodes.new('ShaderNodeCombineColor')
    nt.links.new(dv.outputs[0], cc.inputs[0]); nt.links.new(ao.outputs['AO'], cc.inputs[1])
    return cc.outputs[0]
def pass_depth(nt):  # distance toward the light: (P . L + 600) / 1200
    dp = nt.nodes.new('ShaderNodeVectorMath'); dp.operation = 'DOT_PRODUCT'; dp.inputs[1].default_value = L_B
    nt.links.new(nt.nodes.new('ShaderNodeNewGeometry').outputs['Position'], dp.inputs[0])
    ma = nt.nodes.new('ShaderNodeMath'); ma.operation = 'MULTIPLY_ADD'
    ma.inputs[1].default_value = 1 / 1200; ma.inputs[2].default_value = .5
    nt.links.new(dp.outputs['Value'], ma.inputs[0])
    cc = nt.nodes.new('ShaderNodeCombineColor')
    for k in range(3): nt.links.new(ma.outputs[0], cc.inputs[k])
    return cc.outputs[0]

def shadow_cam():
    cam = bpy.data.objects.new('lightcam', bpy.data.cameras.new('lightcam')); bpy.context.scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = SHADOW['scale']; cam.data.clip_end = 4000
    z = L_B; x = Vector((0, 0, 1)).cross(z).normalized(); y = z.cross(x)
    o = SHADOW['centre'] + z * 1500
    cam.matrix_world = Matrix(((x.x, y.x, z.x, o.x), (x.y, y.y, z.y, o.y), (x.z, y.z, z.z, o.z), (0, 0, 0, 1)))
    # Game-coord axes of the light image, so the forge can project a point into it.
    g = lambda v: [v.x, -v.y, v.z]
    return cam, {'x': g(x), 'y': g(y), 'centre': g(SHADOW['centre']), 'scale': SHADOW['scale'], 'res': SHADOW['res'], 'L': g(L_B), 'enc': [1200, -600]}

def gbuffer(data, rigs):
    sc = bpy.context.scene; vl = bpy.context.view_layer
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    sc.cycles.filter_width = .01; sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 0; sc.cycles.use_adaptive_sampling = False
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Raw'; sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
    im = sc.render.image_settings; im.file_format = 'PNG'; im.color_mode = 'RGBA'; im.color_depth = '16'; im.compression = 90
    sc.world = None
    mats = {k: emit_mat(k, f) for k, f in [('pos', pass_pos), ('nrm', pass_nrm), ('idao', pass_idao), ('depth', pass_depth)]}
    setup_view(1)
    main_cam = sc.camera; lcam, lmeta = shadow_cam()
    meta = {'shadow': lmeta, 'frames': {}}
    for item in FRAMES.split(','):
        part, i = item.split(':')
        for idx in ([int(i)] if i != 'all' else range(len(data[part]))):
            fr = data[part][idx]; joints = []
            for side in 'RL': rigs[side].hide_render = True
            for h in fr['hands']:
                ob = rigs['L' if h['left'] else 'R']; ob.hide_render = False
                ob.pass_index = len(joints) + 1
                joints.append(pose(ob, h))
            meta['frames']['%s_%d' % (part, idx)] = joints
            for key, cam, res, spp in [('pos', main_cam, (480, 270), 1), ('nrm', main_cam, (480, 270), 1), ('idao', main_cam, (480, 270), 64), ('depth', lcam, (SHADOW['res'],) * 2, 1)]:
                sc.camera = cam; sc.render.resolution_x, sc.render.resolution_y = res
                sc.render.pixel_aspect_x = math.sqrt(1.25) if cam is main_cam else 1
                sc.cycles.samples = spp; vl.material_override = mats[key]
                sc.render.filepath = '%s/%s_%d_%s.png' % (OUT, part, idx, key)
                bpy.ops.render.render(write_still=True)
    json.dump(meta, open(OUT + '/meta.json', 'w'))

# verts: the mesh Blender renders (no subdivision) of every frame, read back from Blender, for the checks.
def dump_verts(data, rigs):
    out = {}
    for side in 'RL': rigs[side].modifiers['sub'].show_viewport = False
    for part in ('hand', 'lid'):
        for idx, fr in enumerate(data[part]):
            hands = []
            for h in fr['hands']:
                ob = rigs['L' if h['left'] else 'R']
                pose(ob, h)
                bpy.context.view_layer.update()
                ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh(); M = ob.matrix_world
                hands.append([round(c, 3) for v in me.vertices for c in (lambda w: (w.x, -w.y, w.z))(M @ v.co)])
                ev.to_mesh_clear()
            out['%s_%d' % (part, idx)] = hands
    json.dump(out, open(OUT + '/verts.json', 'w'))

def main():
    data = json.load(open(POSES))
    sc = bpy.context.scene
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    rigs = {side: build_arm(side, data['meshes'][side]) for side in 'RL'}
    if MODE == 'gbuffer': return gbuffer(data, rigs)
    if MODE == 'verts': return dump_verts(data, rigs)
    skin = mat('skin', (.62, .45, .37), .55, .15); wool = mat('wool', (.05, .06, .08), .9)
    for side in 'RL': rigs[side].data.materials.append(skin)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.device = 'CPU'
    sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = .6
    sc.view_settings.view_transform = 'Standard'
    setup_view(3)
    for item in FRAMES.split(','):
        part, i = item.split(':'); fr = data[part][int(i)]
        for o in [o for o in bpy.data.objects if o.name.startswith(('slv', 'Plane', 'Cube'))]: bpy.data.objects.remove(o)
        preview_props(fr['deg'])
        for side in 'RL': rigs[side].hide_render = True
        for k, h in enumerate(fr['hands']):
            ob = rigs['L' if h['left'] else 'R']; ob.hide_render = False
            pose(ob, h)
            sleeve_obj(h, 'slv%d' % k).data.materials.append(wool)
        sc.render.filepath = '%s/%s_%s.png' % (OUT, part, i)
        bpy.ops.render.render(write_still=True)

main()
