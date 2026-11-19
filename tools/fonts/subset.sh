#!/usr/bin/env bash
# Пересборка шрифта игры (063-Р45, очередь п. 10): подмножество системного Noto Sans 2.004 → woff2 в src/styles/fonts/.
# Кадры макетов сняты на этом же системном Noto Sans — поэтому источник системный, без скачивания.
# Инструменты (согласовано владельцем 19.11): fonttools и brotli в отдельном окружении вне проекта:
#   python3 -m venv ~/.local/share/kk-fonttools && ~/.local/share/kk-fonttools/bin/pip install fonttools brotli
# Набор знаков — латиница, Latin-1, кириллица, общая пунктуация, №, ₽, ™; стрелок и значков в Noto Sans нет — их
# рисует запасной шрифт. unicode-range в src/styles/fonts.css сверять с выводом этого скрипта.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY="${KK_FONTTOOLS:-$HOME/.local/share/kk-fonttools}/bin"
SRC=/usr/share/fonts/truetype/noto
U="U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+0400-045F,U+0490-0491,U+2000-206F,U+20BD,U+2116,U+2122"
for w in Regular Bold; do
  "$PY/pyftsubset" "$SRC/NotoSans-$w.ttf" --unicodes="$U" --flavor=woff2 --layout-features='*' \
    --output-file="$ROOT/src/styles/fonts/noto-sans-$w.woff2"
done
ls -l "$ROOT"/src/styles/fonts/*.woff2
