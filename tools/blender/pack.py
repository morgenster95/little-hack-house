"""
Z Blender exportu udělá herní assety:
  scene.webp       – barevný podklad (ořezaný na obsah, s alfou)
  scene_depth.png  – hloubka 16 bit zabalená do R (horní bajt) a G (dolní bajt)
  scene.json       – rozměry a mapování do prostoru kamery
Použití: python -I pack.py <export_dir> <out_dir>
"""
import json, os, sys
from PIL import Image, ImageChops

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

# 16bit hloubka → R (horní bajt) + G (dolní bajt); prázdné pixely (i průhledy oknem) = nejdál
alpha = color.getchannel('A').crop((x0, y0, x1, y1))
raw = dimg.crop((x0, y0, x1, y1)).tobytes('raw', 'I;16')
size = (x1 - x0, y1 - y0)
hi = Image.frombytes('L', size, raw[1::2])
lo = Image.frombytes('L', size, raw[0::2])
empty = ImageChops.lighter(
    alpha.point(lambda v: 255 if v == 0 else 0),
    ImageChops.lighter(hi, lo).point(lambda v: 255 if v == 0 else 0),
)
full = Image.new('L', size, 255)
hi = Image.composite(full, hi, empty)
lo = Image.composite(full, lo, empty)
Image.merge('RGB', (hi, lo, Image.new('L', size, 0))).save(os.path.join(dst, 'scene_depth.png'), optimize=True)

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
