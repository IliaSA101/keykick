#!/usr/bin/env python3
"""Облики тренера: снять белый фон заливкой от края, дефриндж, лицо 320×320 (020-Т2).

Только PIL, без numpy (020-Р6). Запуск:
  python3 -I tools/coach_cut.py <папка исходников> <папка результата> [--thresh 244] [id ...]
Исходники: <id>-1.png (белый фон). Результат: <id>-full.png (RGBA, обрезка по фигуре с полем),
<id>-face.png (320×320, «голова и плечи»), crops.json (рамки в пикселях исходника и full).
Рамки лица — таблица FACES ниже (подобраны глазами, в пикселях full).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageMath

THRESH = 244        # «почти белое»: все три канала не ниже порога
MARK = 128
MIN_POCKET = 1500   # белый карман внутри фигуры (между рукой и боком) крупнее — это фон, мельче — блик
PAD = 24            # поле вокруг фигуры в full
FACE = 320
DARK = (16, 20, 42)      # #10142a
LIGHT = (244, 241, 232)  # светлая тема
# Квадрат лица в пикселях full (после обрезки): (левый, верхний, сторона, y подбородка).
# Подбирается глазами; подбородок нужен только для замера высоты головы (макушка — верх фигуры).
FACES = {
    "young": (123, 0, 620, 516),
    "veteran": (137, 0, 640, 530),
    "ponytail": (170, 0, 620, 492),
    "bigbeard": (196, 0, 640, 541),
}


def candidate_mask(im: Image.Image, thresh: int) -> Image.Image:
    r, g, b = im.split()
    low = ImageChops.darker(ImageChops.darker(r, g), b)
    return low.point(lambda v: 255 if v >= thresh else 0)


def background(im: Image.Image, thresh: int) -> Image.Image:
    """Маска фона: 255 — фон. Заливка от края плюс крупные белые карманы внутри."""
    w, h = im.size
    m = candidate_mask(im, thresh)
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    seeds += [(x, 0) for x in range(0, w, 64)] + [(x, h - 1) for x in range(0, w, 64)]
    seeds += [(0, y) for y in range(0, h, 64)] + [(w - 1, y) for y in range(0, h, 64)]
    for s in seeds:
        if m.getpixel(s) == 255:
            ImageDraw.floodfill(m, s, MARK)
    # карманы: остаток белого, связные области ≥ MIN_POCKET
    for y in range(0, h, 8):
        for x in range(0, w, 8):
            if m.getpixel((x, y)) == 255:
                before = m.histogram()[255]
                ImageDraw.floodfill(m, (x, y), 64)
                if before - m.histogram()[255] >= MIN_POCKET:
                    ImageDraw.floodfill(m, (x, y), MARK)
                else:
                    ImageDraw.floodfill(m, (x, y), 32)  # блик: остаётся фигурой
    return m.point(lambda v: 255 if v == MARK else 0)


def defringe(im: Image.Image, fg: Image.Image) -> Image.Image:
    """Цвет каймы — из глубины фигуры (белая подмешанная кайма уходит), альфа — мягкая."""
    core = fg.filter(ImageFilter.MinFilter(5))                 # фигура без 2 px у края
    alpha = fg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    den = core.filter(ImageFilter.GaussianBlur(3)).convert("F")
    chans = []
    for c in im.split():
        num = ImageChops.multiply(c, core).filter(ImageFilter.GaussianBlur(3)).convert("F")
        # в mode F значения 0..255; ImageMath делит поэлементно
        bleed = ImageMath.eval("convert(min(num / max(den, 1.0) * 255.0, 255.0), 'L')", num=num, den=den)
        chans.append(Image.composite(c, bleed, core))
    out = Image.merge("RGB", chans).convert("RGBA")
    out.putalpha(alpha.point(lambda v: 255 if v > 224 else v))
    return out


def cut_one(src: Path, name: str, thresh: int):
    im = Image.open(src).convert("RGB")
    bg = background(im, thresh)
    fg = ImageChops.invert(bg)
    out = defringe(im, fg)
    box = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    l, t, r, b = box
    frame = (max(0, l - PAD), max(0, t - PAD), min(im.width, r + PAD), min(im.height, b + PAD))
    return out, box, frame


def on_bg(im: Image.Image, color) -> Image.Image:
    bg = Image.new("RGBA", im.size, color + (255,))
    bg.alpha_composite(im)
    return bg.convert("RGB")


def contact(full: Image.Image) -> Image.Image:
    """Контакт-лист Т-6: фигура целиком, лицо и обувь 1:1 — на тёмном и светлом фоне."""
    cells = []
    for color in (DARK, LIGHT):
        bg = on_bg(full, color)
        fig = bg.resize((round(bg.width * 0.42), round(bg.height * 0.42)), Image.LANCZOS)
        head = bg.crop((0, 0, min(bg.width, 760), 620))
        feet = bg.crop((0, bg.height - 380, bg.width, bg.height)).resize((round(bg.width * 0.8), 304), Image.LANCZOS)
        col = Image.new("RGB", (max(fig.width, head.width, feet.width), fig.height + head.height + feet.height + 20), color)
        col.paste(fig, (0, 0))
        col.paste(head, (0, fig.height + 10))
        col.paste(feet, (0, fig.height + head.height + 20))
        cells.append(col)
    sheet = Image.new("RGB", (cells[0].width + cells[1].width, cells[0].height), DARK)
    sheet.paste(cells[0], (0, 0))
    sheet.paste(cells[1], (cells[0].width, 0))
    return sheet


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    thresh = THRESH
    if "--thresh" in sys.argv:
        thresh = int(sys.argv[sys.argv.index("--thresh") + 1])
        args.remove(str(thresh))
    src_dir, dst_dir = Path(args[0]), Path(args[1])
    ids = args[2:] or list(FACES)
    dst_dir.mkdir(parents=True, exist_ok=True)
    crops_path = dst_dir / "crops.json"
    crops = json.loads(crops_path.read_text()) if crops_path.exists() else {}
    for name in ids:
        out, box, frame = cut_one(src_dir / f"{name}-1.png", name, thresh)
        full = out.crop(frame)
        full.save(dst_dir / f"{name}-full.png")
        fl, ft, fs, chin = FACES[name]
        face = full.crop((fl, ft, fl + fs, ft + fs)).resize((FACE, FACE), Image.LANCZOS)
        face.save(dst_dir / f"{name}-face.png")
        contact(full).save(dst_dir / f"contact-{name}.jpg", quality=90)
        crops[name] = {
            "source_size": list(out.size), "figure_box": list(box), "full_frame": list(frame),
            "full_size": list(full.size), "face_square_in_full": [fl, ft, fs], "head_height": chin - (box[1] - frame[1]), "thresh": thresh,
        }
        print(f"{name}: фигура {box}, full {full.size}, лицо {FACES[name]}")
    crops_path.write_text(json.dumps(crops, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
