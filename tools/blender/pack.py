"""
Z Blender exportu udělá herní assety:
  scene.webp       – barevný podklad (ořezaný na obsah, s alfou)
  scene_depth.png  – hloubka 16 bit zabalená do R (horní bajt) a G (dolní bajt)
  scene.json       – rozměry a mapování do prostoru kamery
Použití: python -I pack.py <export_dir> <out_dir>
"""
import json, os, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
cam = json.load(open(os.path.join(src, 'camera.json')))

color = Image.open(os.path.join(src, 'raw_color.png')).convert('RGBA')
W, H = color.size
dimg = Image.open(os.path.join(src, 'raw_depth.png'))
if dimg.mode not in ('I', 'I;16', 'I;16B'):
    raise SystemExit(f'depth is not 16-bit ({dimg.mode})')

pad = 4
bx0, by0, bx1, by1 = color.getchannel('A').getbbox()
x0, y0 = max(0, bx0 - pad), max(0, by0 - pad)
x1, y1 = min(W, bx1 + pad), min(H, by1 + pad)

alpha = color.getchannel('A').crop((x0, y0, x1, y1)).tobytes()
depth = list(dimg.crop((x0, y0, x1, y1)).get_flattened_data())
out = bytearray(len(depth) * 3)
for i, d in enumerate(depth):
    if alpha[i] == 0 or d == 0:
        d = 65535  # prázdné pixely (i průhledy oknem) = nejdál
    out[i * 3] = d >> 8
    out[i * 3 + 1] = d & 255
Image.frombytes('RGB', (x1 - x0, y1 - y0), bytes(out)).save(os.path.join(dst, 'scene_depth.png'), optimize=True)

crop = color.crop((x0, y0, x1, y1))
crop.save(os.path.join(dst, 'scene.webp'), quality=90, method=6)

ow = cam['orthoScale']
oh = ow * H / W
left = cam['centerX'] - ow / 2
top = cam['centerY'] + oh / 2
info = {
    'width': x1 - x0,
    'height': y1 - y0,
    # obdélník obrázku v souřadnicích kamery (metry)
    'x0': left + x0 / W * ow,
    'x1': left + x1 / W * ow,
    'y0': top - y1 / H * oh,
    'y1': top - y0 / H * oh,
    'depthMin': cam['depthMin'],
    'depthRange': cam['depthRange'],
    'depthOffset': cam['depthOffset'],
    'tile': cam['tile'],
}
json.dump(info, open(os.path.join(dst, 'scene.json'), 'w'), indent=2)
print(info)
for f in ('scene.webp', 'scene_depth.png'):
    print(f, os.path.getsize(os.path.join(dst, f)) // 1024, 'kB')
