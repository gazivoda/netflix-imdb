"""Generate Chrome Web Store icons + promo tile (paper & ink style, no Netflix N)."""
import math, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
INK, PAPER, GOLD, RED = (17, 17, 17), (246, 241, 229), (242, 194, 48), (229, 36, 27)

def star(cx, cy, r, rot=-math.pi / 2):
    pts = []
    for i in range(10):
        a = rot + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.40
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts

def icon(size):
    S = size * 8  # supersample
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    off, m, bw = S * 0.07, S * 0.06, max(S * 0.045, 8)
    box = (m, m, S - m - off, S - m - off)
    d.rectangle((box[0] + off, box[1] + off, box[2] + off, box[3] + off), fill=INK)  # hard shadow
    d.rectangle(box, fill=GOLD, outline=INK, width=int(bw))
    c = ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2 + S * 0.015)
    d.polygon(star(*c, S * 0.30 + bw * 0.9), fill=INK)
    d.polygon(star(*c, S * 0.30), fill=RED)
    return im.resize((size, size), Image.LANCZOS)

for n, name in [(16, 'icon-16.png'), (32, 'icon-32.png'), (48, 'icon-48.png'), (128, 'icon.png')]:
    icon(n).save(os.path.join(ROOT, 'extension', name), optimize=True)

# 440x280 small promo tile
W, H = 440, 280
t = Image.new('RGB', (W, H), PAPER)
d = ImageDraw.Draw(t)
head = ImageFont.truetype(os.path.join(ROOT, 'lib/fonts/Archivo-ExtraCondensed-Black.ttf'), 64)
mono = ImageFont.truetype(os.path.join(ROOT, 'lib/fonts/JetBrainsMono-Bold.ttf'), 15)
d.rectangle((0, 0, W - 1, H - 1), outline=INK, width=4)
d.text((28, 34), 'RATING', font=head, fill=RED)
d.text((28, 96), 'WATCH', font=head, fill=INK)
d.text((30, 190), 'IMDB + ROTTEN TOMATOES', font=mono, fill=INK)
d.text((30, 212), 'ON NETFLIX TITLE CARDS', font=mono, fill=INK)
ic = icon(96)
d.rectangle((W - 120, H - 120, W - 20, H - 20), fill=PAPER)
t.paste(ic, (W - 116, 24), ic)
t.save(os.path.join(ROOT, 'docs/store/promo-tile-440x280.png'))
