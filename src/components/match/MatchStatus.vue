<script setup lang="ts">
/*
 * Строка статуса матча (спека 017-Р47, разрез экрана): полоска хода, метка помощи, мячи запаса и подсказка.
 * Экранов не знает: получает вид матча и то, что экран уже посчитал для клавиатуры (ожидаемая клавиша, большой палец).
 */
import { computed } from 'vue';
import type { MatchView } from '../../engine/match/view';
import { expectedHit, expectedThumb } from '../../engine/typing';
import { ru } from '../../i18n/ru';
import ErrorReserve from '../ErrorReserve.vue';
import LineProgress from '../LineProgress.vue';

const props = defineProps<{
  view: MatchView;
  /** Печать идёт (фаза печати и не пауза): подсказки и предупреждения только тогда. */
  printing: boolean;
  /** Строка печати; на пенальти null. */
  typing: MatchView['typing'];
  /** Ожидаемая клавиша и большой палец — для подсказки «Бей пальцем: …». */
  target: NonNullable<ReturnType<typeof expectedHit>>['key'] | null;
  thumb: ReturnType<typeof expectedThumb>;
}>();

/** Пустая подсказка держит высоту строки, чтобы клавиатура не прыгала. */
const NBSP = String.fromCharCode(0xa0);
const t = ru.match2;

// Полоска хода: в разминке — строки блока, в тайме — атаки. У минуты тренера её нет (время идёт по часам),
// у доп. времени тоже: атака одна, «Строка 1 из 1» ничего не говорит (017-Р33).
const progress = computed(() => {
  const x = props.view;
  if (!x.typing || x.phase === 'coach' || x.phase === 'extra') return null;
  return x.phase === 'warmup'
    ? { total: x.rows.length, done: x.row }
    : { total: x.attacks, done: x.attack - 1 };
});

// Предупреждение (раскладка, Caps Lock, цифры) длиннее «Бей пальцем: …»: пока оно горит, подпись мячей прячется (compact).
const warning = computed(() => props.printing && props.typing?.hint != null && props.typing.hint !== 'finger');

const hint = computed(() => {
  const v = props.view;
  const h = props.printing ? (props.typing?.hint ?? null) : null;
  if (h === null) {
    // Решающая: вызов, пока запас цел; после ошибки вызов звучал бы насмешкой — поддержка (008-Р10).
    if (v.decisive) return v.reserve && v.reserve.left < v.reserve.total ? t.decisiveHint.after : t.decisiveHint.clean;
    return v.phase === 'warmup' && v.row === 0 && (props.typing?.pos ?? 0) === 0 ? t.warmupHint : null;
  }
  if (h === 'finger') {
    if (!props.target) return null;
    const name = props.thumb ? ru.keyboard.thumbs[props.thumb] : ru.keyboard.fingers[props.target.finger];
    return `${ru.match.hints.finger} ${name}`;
  }
  return ru.match.hints[h];
});
</script>

<template>
  <!-- Вступление: строки статуса нет; пенальти, перерыв, итог: нет и клавиатуры (место — карточке или листу задачи). -->
  <div
    class="status"
    :class="{ idle: view.phase === 'intro' }"
  >
    <LineProgress
      v-if="progress && typing"
      class="line-progress"
      :total="progress.total"
      :done="progress.done"
      :state="typing"
    />
    <span
      v-if="view.reserve && view.help !== 'none'"
      class="help-tag"
      data-help-tag
    >{{ t.helpTag[view.help] }}</span>
    <ErrorReserve
      v-if="view.reserve"
      :left="view.reserve.left"
      :total="view.reserve.total"
      :goal="view.reserve.goalBalls"
      :hint="view.reserve.hint"
      :compact="warning"
    />
    <p
      class="hint"
      role="status"
    >
      {{ hint ?? NBSP }}
    </p>
  </div>
</template>

<style scoped>
/*
 * Полоска, мячи запаса и подсказка в одной строке, если помещаются; решающая серия длиннее — подсказка уходит
 * на вторую строку целиком, а не обрезается и не налезает на мячи (017-Р33).
 */
.status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px var(--space-2);
  min-height: 1.5em;
}

.status.idle {
  display: none;
}

/* Подпись «Строка N из M» (~100 px) и полоска (от 90 px) должны влезть целиком: уже — полоска вылезала на мячи (017-Р49). */
.line-progress {
  flex: 0 0 220px;
}

/* Метка помощи (С запасом / С тренером): маленькая плашка в цвете акцента рядом с мячами запаса. */
.help-tag {
  flex: 0 0 auto;
  padding: 1px 8px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  font-size: 0.8em;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

/* Подсказка — одна строка (две растили страницу за край окна 640); не влезла рядом с мячами — ниже, целиком. */
.hint {
  flex: 1 0 auto;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: center;
  font-weight: 700;
  color: var(--accent);
}
</style>
