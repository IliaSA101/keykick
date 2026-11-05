"""Разложение основы формы на слои для перекраски кодом.

Основа — генерация, где зоны залиты чистыми разными цветами: корпус красный,
рукава синие, воротник и манжеты жёлтые. Из одной картинки получаем:

    zones.webp — R = корпус, G = рукава, B = окантовка (доли 0…255);
    shade.webp — R = затемнение (во сколько раз темнее светлого места зоны),
                 G = блик (насколько пиксель белее своей зоны), B = непрозрачность.

Оба файла без альфа-канала и без потерь: браузер умножает цвет на альфу при чтении
картинки, и доли зон на краях исказились бы.

Цвет в игре: base = цвет_зоны · R; итог = base + (1 − base) · G.
Второй генерации и совмещения не нужно — зоны и тени из одного кадра.

    python tools/kit_layers.py art-src/kit/kit-3.png --out art-work/kit/kit-3 --side 640
"""

from __future__ import annotations

import argparse
import pathlib
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from sheet import defringe, label_runs, run_rembg  # noqa: E402

# Уверенные оттенки (градусы). Между ними — спорные: оранжевый бывает и отсветом
# на краю корпуса, и тенью манжеты, фиолетовый — стыком рукава с корпусом.
RED = (345.0, 12.0)
YELLOW = (36.0, 75.0)
BLUE = (170.0, 290.0)
# Пиксели бледнее этого — блики: оттенок у них случайный, зону берём у соседей.
PALE = 0.3
# Радиус «голосования» соседей за зону, в пикселях исходника 2K. Спорному пикселю
# нужен широкий: тень манжеты — полоса шириной в десятки пикселей.
VOTE_RADIUS = 24
# Клочок корпуса меньше этой доли — тень манжеты, а не изнанка горловины (та ~2 %).
STRAY_SHARE = 0.005
# Тёмное и ненасыщенное — подошва и шипы бутс (спека 004-Р9): без зоны, игра красит их чёрным
# с бликом. Только с флагом --neutral: у шорт и гетр так попадают глубокие тени (чёрные пятна).
NEUTRAL_V = 0.35
NONE = 3


def hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Оттенок в градусах, насыщенность и яркость для массива RGB 0…1."""
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dd = np.maximum(d, 1e-6)
    h = np.where(
        mx == r,
        ((g - b) / dd) % 6,
        np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4),
    )
    return h * 60.0, s, mx


def zone_votes(
    h: np.ndarray, s: np.ndarray, v: np.ndarray, inside: np.ndarray, neutral: bool = False
) -> np.ndarray:
    """Зона каждого пикселя: 0 — корпус, 1 — рукава, 2 — окантовка, NONE — без зоны.

    Уверенные пиксели — по оттенку; блики и спорные оттенки получают зону
    ближайших уверенных соседей (размытое голосование).
    """
    yellow = (h >= YELLOW[0]) & (h <= YELLOW[1])
    blue = (h >= BLUE[0]) & (h <= BLUE[1])
    red = (h >= RED[0]) | (h <= RED[1])
    sure = inside & (s >= PALE) & (red | yellow | blue)
    votes = []
    for m in (red, blue, yellow):
        layer = Image.fromarray(((m & sure) * 255).astype(np.uint8))
        votes.append(np.asarray(layer.filter(ImageFilter.GaussianBlur(VOTE_RADIUS)), np.float32))
    # У уверенных пикселей своя зона весит больше соседских.
    stack = np.stack(votes, axis=-1)
    own = np.stack([red, blue, yellow], axis=-1) & sure[..., None]
    stack += own * 400.0
    # Спорный оттенок выбирает только из соседних по кругу: оранжевый — корпус
    # или окантовка (не рукав), фиолетовый — корпус или рукав (не окантовка).
    vivid = inside & (s >= PALE) & ~sure
    orange = vivid & (h > RED[1]) & (h < YELLOW[0])
    purple = vivid & (h > BLUE[1]) & (h < RED[0])
    stack[..., 1] -= orange * 1000.0
    stack[..., 2] -= purple * 1000.0
    zone = stack.argmax(axis=-1)

    # Мелкие отдельные клочки «корпуса» — это тень на конце манжеты: отдаём их
    # лучшей из оставшихся зон. Крупные (изнанка горловины) остаются корпусом.
    body = inside & (zone == 0)
    stray = small_parts(body, STRAY_SHARE)
    stack[..., 0] = -1e9
    zone[stray] = stack.argmax(axis=-1)[stray]
    if neutral:
        zone[inside & (s < PALE) & (v < NEUTRAL_V)] = NONE
    return zone


def small_parts(region: np.ndarray, share: float) -> np.ndarray:
    """Четырёхсвязные области region меньше share от его площади."""
    rows, find = label_runs(region)
    size: dict[int, int] = {}
    for row in rows:
        for start, end, index in row:
            root = find(index)
            size[root] = size.get(root, 0) + end - start
    limit = share * sum(size.values())
    out = np.zeros_like(region)
    for y, row in enumerate(rows):
        for start, end, index in row:
            if size[find(index)] < limit:
                out[y, start:end] = True
    return out


def shading(
    v: np.ndarray, s: np.ndarray, zone: np.ndarray, inside: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """Затемнение и блик для каждого пикселя, нормированные внутри своей зоны."""
    dark = np.zeros_like(v)
    gloss = np.zeros_like(v)
    for z in range(NONE + 1):
        m = inside & (zone == z)
        if not m.any():
            continue
        solid = m & (s >= PALE)
        top = np.percentile(v[solid], 92) if solid.any() else 1.0
        sat = np.median(s[solid]) if solid.any() else 1.0
        dark[m] = np.clip(v[m] / top, 0, 1)
        gloss[m] = np.clip((sat - s[m]) / sat, 0, 1) * np.clip(v[m] / top, 0, 1)
    return dark, gloss


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", type=pathlib.Path)
    p.add_argument("--out", type=pathlib.Path, required=True, help="папка для zones.png и shade.png")
    p.add_argument("--side", type=int, default=640, help="сторона квадрата результата")
    p.add_argument("--neutral", action="store_true", help="тёмное ненасыщенное — без зоны (подошва бутс)")
    p.add_argument("--pad", type=int, default=24, help="поле вокруг формы в исходных пикселях")
    args = p.parse_args()

    cut = args.out / "cut.png"
    run_rembg(args.source, cut)
    rgba = defringe(np.asarray(Image.open(cut).convert("RGBA")))

    alpha = rgba[..., 3]
    ys, xs = np.nonzero(alpha > 8)
    side = max(ys.max() - ys.min(), xs.max() - xs.min()) + 2 * args.pad
    cy, cx = (ys.max() + ys.min()) // 2, (xs.max() + xs.min()) // 2
    box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
    rgba = np.asarray(Image.fromarray(rgba).crop(box))

    rgb = rgba[..., :3].astype(np.float32) / 255.0
    a = rgba[..., 3]
    inside = a > 0
    h, s, v = hsv(rgb)
    zone = zone_votes(h, s, v, inside, args.neutral)
    dark, gloss = shading(v, s, zone, inside)

    def shrink(arr: np.ndarray) -> np.ndarray:
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        return np.asarray(img.resize((args.side, args.side), Image.Resampling.LANCZOS))

    # Доли зон уменьшаем отдельно — на стыках получаются мягкие переходы, а не лесенка.
    zones = np.stack([shrink((zone == z) * inside * 255.0) for z in range(3)], axis=-1)
    shade = np.stack(
        [shrink(dark * 255.0), shrink(gloss * 255.0), shrink(a.astype(np.float32))], axis=-1
    )
    args.out.mkdir(parents=True, exist_ok=True)
    for name, arr in (("zones", zones), ("shade", shade)):
        path = args.out / f"{name}.webp"
        Image.fromarray(arr, "RGB").save(path, lossless=True, quality=100, method=6)
        if not np.array_equal(np.asarray(Image.open(path).convert("RGB")), arr):
            sys.exit(f"WebP исказил {path}: нужен lossless")

    share = [round(float(((zone == z) & inside).sum() / inside.sum()) * 100, 1) for z in range(NONE + 1)]
    print(
        f"готово: {args.out}  доли зон, %: корпус {share[0]}, рукава {share[1]}, окантовка {share[2]},"
        f" без зоны {share[3]}"
    )


if __name__ == "__main__":
    main()
