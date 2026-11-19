"""Лавка (067 Т12): вырезки вещей для карточек из кадров макета → public/art/shop/<id>.webp.

Запуск: python3 tools/shop-cut/shop_cut.py
Рамки и источники — tools/shop-cut/shop-cut.json. Новых картинок не рисует: только режет готовые кадры макета
(docs/mockups/map-yard/img) и ужимает бутсы из docs/mockups/collection/img/kit.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
cfg = json.loads((ROOT / 'tools/shop-cut/shop-cut.json').read_text(encoding='utf8'))
src_dir = ROOT / 'docs/mockups/map-yard/img'
out_dir = ROOT / 'public/art/shop'
out_dir.mkdir(parents=True, exist_ok=True)
fw, fh = cfg['frame']


def widen(rect, asp):
    """Рамка вещи, расширенная вокруг центра до соотношения asp и не выходящая за кадр (как в макете)."""
    x0, y0, x1, y1 = rect
    w, h = x1 - x0, y1 - y0
    if w / h < asp:
        nw = h * asp
        x0 -= (nw - w) / 2
        w = nw
    else:
        nh = w / asp
        y0 -= (nh - h) / 2
        h = nh
    x0 = min(max(0, x0), fw - w)
    y0 = min(max(0, y0), fh - h)
    return round(x0), round(y0), round(x0 + w), round(y0 + h)


for item, c in cfg['cut'].items():
    im = Image.open(src_dir / f"{c['src']}.webp").convert('RGB')
    box = tuple(c['rect']) if c.get('whole') else widen(c['rect'], cfg['aspect'])  # whole — кадр целиком, без выравнивания
    # рамки заданы в px кадра 1920×1080; источник поменьше (kid-mid-22 — 886×509) — пересчёт по ширине
    k = im.width / fw
    crop = im.crop(tuple(round(v * k) for v in box))
    w = c.get('width', cfg['width'])
    crop = crop.resize((w, round(w / (box[2] - box[0]) * (box[3] - box[1]))), Image.LANCZOS)
    crop.save(out_dir / f'{item}.webp', quality=84, method=6)
    print(item, box, crop.size)

for item, name in cfg['boots'].items():
    im = Image.open(ROOT / f'docs/mockups/collection/img/kit/{name}.png').convert('RGBA')
    im = im.resize((330, round(330 * im.height / im.width)), Image.LANCZOS)
    im.save(out_dir / f'{item}.webp', quality=88, method=6)
    print(item, im.size)
