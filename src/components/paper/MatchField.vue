<script setup lang="ts">
/**
 * Соединялка (Э3.36, Э3.37): слева строки с точкой, справа — с номером, пары — ломаные дорожки цветом пальца. Мышь: клик по строке
 * с одной стороны, затем по другой. Клавиатура (025-Р13): Tab — к строке слева, цифра 1–6 — строка справа (пара готова, фокус — к следующей
 * слева), Backspace — снять связь. После ответа (`locked` и `reveal`) верные пары — зелёные, неверные — красные пунктиром.
 */
import { computed, ref } from 'vue';
import type { AnswerInput, MatchAnswer } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';
import { columnWidth, digitIndex, linkMatch, matchPick, pairColor, pendingFor, unlinkMatch, type MatchPending } from './paper';

const props = defineProps<{ answer: MatchAnswer; modelValue: AnswerInput; locked?: boolean; reveal?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [AnswerInput] }>();
const t = ru.paper;

// геометрия — как у макета (tools/olymp/school/matrix.mjs, matchSvg): строка 36, плашка 30, дорожки между столбцами
const RH = 36;
const PH = 30;
const GAP = 78;
const MAX_COL = 300; // лист 820 px: два столбца с дорожками не шире ≈ 680
// столбец по самой длинной строке: «шестиугольник» в плашке не переносится (плашка 30 px)
const LW = computed(() => columnWidth(props.answer.left, 120, MAX_COL));
const RW = computed(() => columnWidth(props.answer.right, 120, MAX_COL, 44)); // справа ещё номер строки
const RX = computed(() => LW.value + GAP);

const links = computed<readonly (number | null)[]>(() => (props.modelValue.kind === 'match' ? props.modelValue.value : []));
const pendingRaw = ref<MatchPending>({ l: null, r: null });
/** Выбор сбрасывается, когда лист закрыт ответом; при смене задачи компонент новый (`:key` в TaskPaper). */
const pending = computed<MatchPending>({ get: () => pendingFor(pendingRaw.value, props.locked === true), set: (v) => void (pendingRaw.value = v) });
const rows = computed(() => Math.max(props.answer.left.length, props.answer.right.length));
const height = computed(() => rows.value * RH - (RH - PH));
const y = (i: number): number => i * RH + PH / 2;
const closed = computed(() => props.locked === true && props.reveal === true);
const isBad = (l: number): boolean => closed.value && links.value[l] !== props.answer.pairs[l];
const colorOf = (l: number): string => pairColor(l, closed.value, isBad(l));
/** Подпись левой строки для чтения с экрана; у соединённой — «…, соединена». */
const leftLabel = (l: number, txt: string): string => {
  const base = t.match.left.replace('{text}', txt);
  return links.value[l] === null || links.value[l] === undefined ? base : `${base}, ${t.match.linked}`;
};
const linkedRight =(r: number): number => links.value.indexOf(r);

/** Ломаная дорожка пары: из точки слева, на своей полосе вниз или вверх, в точку справа. */
function route(l: number, r: number): string {
  const lw = LW.value;
  const rx = RX.value;
  const xm = lw + 18 + l * 10;
  const y0 = y(l);
  const y1 = y(r);
  if (y0 === y1) return `M${lw} ${y0} H${rx}`;
  const k = Math.min(6, Math.abs(y1 - y0) / 2);
  const s = Math.sign(y1 - y0);
  return `M${lw} ${y0} H${xm - k} Q${xm} ${y0} ${xm} ${y0 + s * k} V${y1 - s * k} Q${xm} ${y1} ${xm + k} ${y1} H${rx}`;
}
const paths = computed(() => links.value.flatMap((r, l) => (r === null ? [] : [{ l, d: route(l, r) }])));

function emitLinks(next: (number | null)[]): void {
  emit('update:modelValue', { kind: 'match', value: next });
}
function click(side: 'l' | 'r', i: number): void {
  if (props.locked === true) return;
  const out = matchPick(links.value, pending.value, side, i);
  pending.value = out.pending;
  if (out.links.some((v, k) => v !== links.value[k])) emitLinks(out.links);
}
/** Цифра на строке слева — соединить её с этой правой; фокус — к следующей левой. */
function onKey(e: KeyboardEvent, l: number): void {
  if (props.locked === true) return;
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    emitLinks(unlinkMatch(links.value, l));
    return;
  }
  const r = digitIndex(e, props.answer.right.length);
  if (r === null) return;
  e.preventDefault();
  emitLinks(linkMatch(links.value, l, r));
  pending.value = { l: null, r: null };
  const next = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[data-side="l"]')[l + 1];
  next?.focus();
}
</script>

<template>
  <div
    class="match"
    :data-kind="answer.kind"
    :style="{ width: `${RX + RW}px`, height: `${height}px` }"
  >
    <svg
      class="lines"
      :width="RX + RW"
      :height="height"
      aria-hidden="true"
    >
      <path
        v-for="p in paths"
        :key="p.l"
        :d="p.d"
        fill="none"
        :stroke="colorOf(p.l)"
        stroke-width="2.5"
        :stroke-dasharray="isBad(p.l) ? '6 4' : undefined"
      />
      <circle
        v-for="(_, l) in answer.left"
        :key="`l${l}`"
        :cx="LW"
        :cy="y(l)"
        :r="links[l] === null || links[l] === undefined ? 7 : 10"
        :fill="links[l] === null || links[l] === undefined ? 'var(--paper-field)' : colorOf(l)"
        stroke="var(--paper-node)"
        :stroke-width="links[l] === null || links[l] === undefined ? 2 : 0"
      />
      <circle
        v-for="(_, r) in answer.right"
        :key="`r${r}`"
        :cx="RX"
        :cy="y(r)"
        r="7"
        fill="var(--paper-field)"
        :stroke="linkedRight(r) >= 0 ? colorOf(linkedRight(r)) : 'var(--paper-node)'"
        stroke-width="2.5"
      />
    </svg>
    <button
      v-for="(txt, l) in answer.left"
      :key="`bl${l}`"
      type="button"
      class="pill left"
      :class="{ on: pending.l === l }"
      data-side="l"
      :style="{ top: `${l * RH}px`, width: `${LW}px`, height: `${PH}px` }"
      :aria-label="leftLabel(l, txt)"
      :aria-pressed="pending.l === l"
      :disabled="locked"
      @click="click('l', l)"
      @keydown="onKey($event, l)"
    >
      {{ txt }}
    </button>
    <button
      v-for="(txt, r) in answer.right"
      :key="`br${r}`"
      type="button"
      class="pill right"
      :class="{ on: pending.r === r }"
      data-side="r"
      tabindex="-1"
      :style="{ top: `${r * RH}px`, left: `${RX}px`, width: `${RW}px`, height: `${PH}px` }"
      :aria-label="t.match.right.replace('{n}', String(r + 1)).replace('{text}', txt)"
      :aria-pressed="pending.r === r"
      :disabled="locked"
      @click="click('r', r)"
    >
      {{ txt }}<i>{{ r + 1 }}</i>
    </button>
  </div>
</template>

<style scoped>
.match { position: relative; margin: 6px 0 4px; }
.lines { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: visible; }
.pill { position: absolute; box-sizing: border-box; display: flex; align-items: center; padding: 0 10px; border: 0; border-radius: 9px; background: var(--paper-note); color: var(--paper-text); font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; text-align: left; white-space: nowrap; }
.pill:disabled { cursor: default; }
.pill.right { padding-left: 14px; }
.pill i { margin-left: auto; font-size: 11px; font-style: normal; color: var(--paper-muted); }
.pill.on { box-shadow: inset 0 0 0 2px var(--paper-focus); }
.pill:focus-visible { outline: 3px solid var(--paper-focus); outline-offset: 2px; }
</style>
