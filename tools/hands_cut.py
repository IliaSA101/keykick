#!/usr/bin/env python3
"""Руки в позе печати: снять белый фон заливкой от края и собрать public/art/hands.webp (017-Т3).

Только PIL, без numpy. Запуск:
  python3 tools/hands_cut.py art-src/hands/hands-typing.png public/art/hands.webp [--width 1600]
Печатает размер исходника, рамку обрезки (в пикселях исходника) и итоговый размер.
Рамка нужна, чтобы пересчитать точки ногтей (src/art/hands.ts): они считаются на итоговой картинке.
"""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

MARK = (255, 0, 255)
THRESH = 28  # допуск «почти белого» при заливке от края
# Карманы фона между сомкнутыми пальцами края не касаются — для них свои затравки (пиксели исходника).
POCKETS = [(896, 428), (2273, 428)]


def cut(src: str, dst: str, width: int) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    flood = im.copy()
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)] + POCKETS:
        if flood.getpixel(seed) != MARK:
            ImageDraw.floodfill(flood, seed, MARK, thresh=THRESH)
    # фон = пиксели цвета метки; рука = всё остальное (внутренние светлые блики не тронуты)
    bg = flood.point(lambda v: 0).convert("L")
    r, g, b = flood.split()
    is_bg = ImageChops.multiply(ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0),
                                                    g.point(lambda v: 255 if v == 0 else 0)),
                                b.point(lambda v: 255 if v == 255 else 0))
    alpha = ImageChops.invert(is_bg)
    # край: съесть 1 пиксель белой каймы и смягчить
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    out = out.crop(box)
    scale = min(1.0, width / out.width)
    if scale < 1:
        out = out.resize((round(out.width * scale), round(out.height * scale)), Image.LANCZOS)
    out.save(dst, "WEBP", quality=80, method=6)
    print(f"источник {w}x{h}, рамка {box}, итог {out.width}x{out.height}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    width = int(sys.argv[sys.argv.index("--width") + 1]) if "--width" in sys.argv else 1600
    args = [a for a in args if a != str(width)]
    cut(args[0], args[1], width)
