#!/bin/bash
# Пересъёмка всех листов макетов подряд (через общий замок tools/heavy.sh) и сверка mock-check.
# Нужна после правки общей модели (tools/mock-map: kids.json, yard.mjs, club-model.mjs) или kit — числа меняются на всех листах
# (сквозные круги 2–3, 12.11). Перед этим, если менялась модель детей: tools/heavy.sh python3 tools/mock-map/compose_kids.py
# (и откатить docs/mockups/map-yard/img/star-sector.webp — он пересжимается с другими байтами). После — to_canvas Коллекции и холст.
cd "$(git rev-parse --show-toplevel)"
for s in tools/mock-map-shots.mjs tools/mock-kit-shots.mjs tools/mock-mk1-shots-b.mjs tools/mock-champ/shots.mjs tools/mock-collection/shots.mjs \
  tools/mock-games/shots.mjs tools/mock-path/shots.mjs tools/mock-story/shots.mjs tools/olymp/school/shots.mjs; do
  echo "== $s"; tools/heavy.sh node "$s" 2>&1 | grep -v 'жду очереди' | tail -2 || echo "ОШИБКА $s"
done
echo "== mock-check"; tools/heavy.sh node tools/mock-check.mjs 2>&1 | grep -v 'жду очереди' | tail -3
