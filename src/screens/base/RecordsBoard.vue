<script setup lang="ts">
/**
 * Доска рекордов клуба (067 Т19, 036-Р2, кадры Э4.08, Э4.47): рекорд каждой игры, когда он поставлен и как далеко последняя игра от него;
 * закрытые — «откроется после урока N». Рекорды только свои: чужих здесь нет. Данные — `boardRows` (`app/base/run.ts`), здесь только показ.
 */
import { boardRows, funName, lockText, unitOf, whenText, type BoardRow } from '../../app/base/run';
import { fill } from '../../app/home/texts';
import { mmss } from '../../app/learn/view';
import cfg from '../../content/base.json';
import KitPanel from '../../components/kit/KitPanel.vue';
import type { BaseView, FunId, FunView } from '../../engine/base/open';
import { ru } from '../../i18n/ru';

const props = defineProps<{ view: BaseView; today: string; club: string }>();
const t = ru.base;
const rows = (): ReturnType<typeof boardRows> => boardRows(props.view, props.today);
const byId = (id: FunId): FunView | undefined => props.view.fun.find((f) => f.id === id);
/** Значки игр: линии и круги на 24 × 24, белым (кадр Э4.08). */
const ICONS: Record<FunId, string> = {
  keepy: 'M12 5a7 7 0 0 1 7 4M12 5a7 7 0 0 0-7 4M12 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  mini: 'M3 6h18v12H3zM12 6v12M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  free: 'M3 8h3v8H3zM8 8h3v8H8zM13 8h3v8h-3zM19 17a2 2 0 1 0 0 .1',
  memo: 'M3 6h8v12H3zM13 8h8v12h-8z',
  keeper: 'M3 6h18v13M3 6v13M8 6v13M13 6v13M18 6v13',
};
/** Подпись под полосой: «последняя игра — рекорд», «рекорд поставлен сегодня» или «в прошлый раз N · до рекорда M». */
const noteText = (n: NonNullable<BoardRow['note']>): string => (n.kind === 'gap' ? fill(t.lastGap, { n: n.last, gap: n.gap }) : n.kind === 'today' ? t.recordToday : t.lastRecord);
/** «34 удара подряд», «2 гола из 5 · 0:47». */
const big = (f: FunView): string => {
  const n = f.record?.n ?? 0;
  return f.id === 'free' ? fill(t.freeBoard, { n, goals: unitOf('free', n), shots: cfg.free.shots, time: mmss((f.record?.t ?? 0) * 1000) }) : `${n} ${unitOf(f.id, n)}`;
};
</script>

<template>
  <div class="board-wrap">
    <KitPanel
      soft
      class="brd"
    >
      <h2>{{ fill(t.boardTitle, { club }) }}</h2>
      <p class="muted">
        {{ t.boardSub }}
      </p>
      <div class="rrs">
        <div
          v-for="r in rows()"
          :key="r.id"
          class="rr"
          :class="{ lock: r.kind === 'lock' }"
          :data-board="r.id"
        >
          <svg
            class="ic"
            viewBox="0 0 24 24"
            aria-hidden="true"
          ><path
            :d="ICONS[r.id]"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg>
          <b>{{ funName(r.id, r.kind === 'lock') }}</b>
          <span
            v-if="r.kind === 'lock'"
            class="lt"
          >{{ lockText(r.id) }}</span>
          <div
            v-else-if="r.kind === 'none'"
            class="c"
          >
            <span class="big">{{ t.recordNone }}</span>
            <span class="when">{{ t.firstPlay }}</span>
          </div>
          <template v-else>
            <div class="c">
              <span class="big">{{ big(byId(r.id)!) }}</span>
              <span class="when">{{ whenText(byId(r.id)!.record!.day, today) }}</span>
            </div>
            <div class="c">
              <span class="bar"><u :style="{ width: `${r.fill}%` }" /></span>
              <span
                v-if="r.note"
                class="gap"
                :class="{ ok: r.note.kind !== 'gap' }"
              >{{ noteText(r.note) }}</span>
              <small>{{ t.better[r.better] }}</small>
            </div>
          </template>
        </div>
      </div>
    </KitPanel>
  </div>
</template>

<style scoped>
.board-wrap { position: absolute; left: 16px; right: 16px; top: 96px; bottom: 28px; }
.brd { position: static; display: flex; flex-direction: column; gap: 4px; background: linear-gradient(160deg, rgb(58 63 134 / 0.85), rgb(31 33 82 / 0.85)); }
h2 { margin: 0; font-size: 22px; }
.muted { margin: 0; font-size: 13px; color: var(--text-muted); }
.rrs { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.rr { display: grid; grid-template-columns: 40px 200px 220px 1fr; align-items: center; column-gap: 14px; padding: 8px 12px; border-radius: 12px; background: rgb(21 20 58 / 0.85); box-shadow: inset 0 0 0 1.5px var(--border); }
.rr.lock { grid-template-columns: 40px 200px 1fr; border: 1.5px dashed var(--border); box-shadow: none; color: var(--text-muted); }
.rr b { font-size: 15px; }
.ic { width: 34px; height: 34px; color: #e8f0ff; }
.lock .ic { color: #7f7fb8; }
.lt { font-size: 12px; }
.c { display: flex; flex-direction: column; gap: 3px; }
.big { font-size: 17px; font-weight: 800; }
.when { font-size: 11px; color: var(--text-muted); }
.bar { height: 8px; border-radius: 4px; background: rgb(255 255 255 / 0.12); overflow: hidden; }
.bar u { display: block; height: 100%; background: #6fd89c; }
.gap { font-size: 12px; color: var(--text-muted); }
.gap.ok { color: #6fd89c; font-weight: 800; }
small { font-size: 11px; color: var(--text-muted); }
</style>
