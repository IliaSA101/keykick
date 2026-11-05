<script setup lang="ts">
/*
 * Итог матча: общий счёт двух таймов, исход, звёзды и зачёт решающей серии (спека 008: во дворе —
 * шестая атака второго тайма, с района — пятая и шестая); точность, скорость, ровность и время — за оба
 * тайма (stats — matchStats). Зачёт считает ход матча (008-Р14), здесь только тексты по правилам лиги.
 * Рекорд урока (спека 003) — в ячейке скорости, «Новый рекорд!» — рядом со звёздами.
 * Урок-веха (спека 002) — в конце строки решающей «Открыт 1/8 финала кубка!».
 * Голы с пенальти по ходу матча (спека 005) — в счёте и рядом: «7 : 1 (пен. 1)».
 * Дальше — серия пенальти. Главная кнопка получает фокус: Enter сразу ведёт к пенальти.
 */
import { computed, onMounted, ref } from 'vue';
import KeyButton from './KeyButton.vue';
import type { CupNote } from '../app/cup';
import { decisiveResult, starsWhy, tryAgain } from '../app/decisiveText';
import { openedText } from '../app/unlocks';
import { outcome, type LeagueRules, type MatchScore } from '../engine/match';
import { STAR_COINS } from '../engine/rewards';
import type { BestNote } from '../engine/save';
import type { UnlockId } from '../engine/unlocks';
import { accuracy, charsPerMinute, evenness, formatClock, halfTime, type TypingStats } from '../engine/typing';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

const props = defineProps<{
  score: MatchScore;
  stats: TypingStats;
  stars: 1 | 2 | 3;
  /** Открыт следующий урок (на последнем уроке зачёт его не открывает). */
  unlocked: boolean;
  /** Ошибок в решающей серии — сумма по её атакам. */
  decisiveErrors: number;
  /** Урок зачтён по серии (ход матча, lessonPassed). */
  passed: boolean;
  /** Правила лиги урока: слова «атака» или «серия» и запас в текстах. */
  rules: LeagueRules;
  /** Матч кубка: итог раунда вместо строки про урок; null — обычный матч. */
  cupNote?: CupNote | null;
  /** Матч кубка: вторая кнопка ведёт к сетке кубка, а не на главную. */
  cupTo?: string | null;
  /** Рекорд урока (bestNote); null — без зачёта: о рекорде ни слова. */
  record?: BestNote | null;
  /** Открытое матчем (урок-веха): первое — в строку итога вместо «Открыт новый урок!». */
  opened?: readonly UnlockId[];
  /** Монеты за пенальти по ходу матча (оба тайма) — к звёздным, одним числом. */
  penaltyCoins?: number;
}>();

const result = computed(() => outcome(props.score));
const percent = computed(() => Math.round(accuracy(props.stats) * 100));
const speed = computed(() => charsPerMinute(props.stats));
const even = computed(() => Math.round(evenness(props.stats) * 100));
const time = computed(() => formatClock(halfTime(props.stats)));
// Строка итога горит, если урок зачтён, а в кубке — если раунд пройден.
const lit = computed(() => (props.cupNote ? props.cupNote.advanced : props.passed));
// Монеты за звёзды и пенальти уже начислены в прогрессе (applyHalf) — здесь только показываем, сколько.
const coins = computed(() => STAR_COINS * props.stars + (props.penaltyCoins ?? 0));
// Подпись под скоростью: побит — «быстрее прошлого на 8» (та же скорость — «точнее прошлого»);
// не побит — «Рекорд: 95»; первый — «Рекорд урока: 87».
const recordText = computed(() => {
  const r = props.record;
  const t = ru.match.record;
  if (!r) return null;
  if (r.kind === 'fresh') return r.gain > 0 ? t.faster.replace('{n}', String(r.gain)) : t.sharper;
  return `${r.kind === 'kept' ? t.kept : t.first} ${r.cpm}`;
});

// Открылось несколько — в строке первое с подписью (кубок раньше); строка — до 52 знаков (guards.test).
const openedLine = computed(() => (props.opened ?? []).map(openedText).find((n) => n !== null) ?? null);

const box = ref<HTMLElement | null>(null);
onMounted(() => box.value?.querySelector<HTMLElement>('.primary')?.focus());
</script>

<template>
  <section
    ref="box"
    class="result panel"
    aria-labelledby="result-title"
  >
    <h1 id="result-title">
      {{ ru.match.final }}
    </h1>
    <p class="score">
      {{ score.goals }} : {{ score.conceded }}
      <span
        v-if="score.penalties.scored > 0"
        class="pen"
      >({{ ru.midPenalty.short }} {{ score.penalties.scored }})</span>
    </p>
    <p
      class="outcome"
      :class="result"
    >
      {{ ru.match.outcome[result] }}
    </p>
    <!-- Звёзды и монеты одной строкой: на 1024×640 итог с кнопками помещается без прокрутки. -->
    <div class="reward">
      <p
        class="stars"
        :aria-label="`${ru.match.stars}: ${stars} ${ru.match.starsOf}`"
      >
        <span
          v-for="n in 3"
          :key="n"
          :class="{ on: n <= stars }"
          aria-hidden="true"
        >★</span>
      </p>
      <p class="coins">
        +{{ coins }} {{ plural(coins, ru.pack.coinWords) }}
      </p>
      <p
        v-if="record?.kind === 'fresh'"
        class="fresh"
      >
        {{ ru.match.record.fresh }}
      </p>
    </div>
    <p class="why">
      {{ starsWhy(rules) }}
    </p>
    <dl class="numbers">
      <div>
        <dt>{{ ru.match.accuracy }}</dt>
        <dd>{{ percent }}%</dd>
      </div>
      <div>
        <dt>{{ ru.match.speed }}</dt>
        <dd>{{ speed }} <small>{{ plural(speed, ru.match.perMinute) }}</small></dd>
        <dd
          v-if="recordText"
          class="best"
          :class="{ fresh: record?.kind === 'fresh' }"
        >
          {{ recordText }}
        </dd>
      </div>
      <div>
        <dt>{{ ru.match.evenness }}</dt>
        <dd>{{ even }}%</dd>
      </div>
      <div>
        <dt>{{ ru.match.time }}</dt>
        <dd class="time">
          {{ time }}
        </dd>
      </div>
    </dl>
    <p
      class="decisive"
      :class="{ passed: lit }"
    >
      <template v-if="!cupNote || cupNote.draw">
        {{ decisiveResult(rules) }}: {{ decisiveErrors }} {{ plural(decisiveErrors, ru.match.decisiveErrors) }}.
      </template>
      <template v-if="cupNote">
        {{ cupNote.text }}
      </template>
      <template v-else-if="passed">
        {{ openedLine ?? (unlocked ? ru.match.nextLesson : ru.match.passed) }}
      </template>
      <template v-else>
        {{ tryAgain(rules) }}
      </template>
    </p>
    <div class="actions">
      <KeyButton
        to="/penalty"
        primary
      >
        {{ ru.match.toPenalty }}
      </KeyButton>
      <KeyButton
        v-if="cupTo"
        :to="cupTo"
      >
        {{ ru.cup.toCup }}
      </KeyButton>
      <KeyButton
        v-else
        to="/"
      >
        {{ ru.match.toHome }}
      </KeyButton>
    </div>
  </section>
</template>

<style scoped>
.result {
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
}

h1 {
  margin: 0;
  font-size: 1.6rem;
}

.reward {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
}

.why {
  margin: 0 auto var(--space-2);
  max-width: 540px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.coins {
  margin: 0;
  font-weight: 800;
  color: var(--accent);
}

.fresh {
  margin: 0;
  font-weight: 800;
  color: var(--accent);
}

.score {
  margin: var(--space-2) 0 0;
  font-size: 3.4rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.score .pen {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-muted);
}

.outcome {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
}

.outcome.win {
  color: var(--accent);
}

.stars {
  margin: 0;
  font-size: 2.4rem;
  letter-spacing: 0.1em;
  color: var(--border);
}

.stars .on {
  color: #f2b600;
}

.numbers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3) var(--space-5);
  margin: 0;
}

.numbers dt {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.numbers dd {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
}

.numbers small {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
}

.numbers .best {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
}

.numbers .best.fresh {
  color: var(--accent);
}

.numbers .time {
  font-variant-numeric: tabular-nums;
}

.decisive {
  margin: var(--space-3) 0 0;
  font-weight: 700;
  color: var(--text-muted);
}

.decisive.passed {
  color: var(--accent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-4);
  /* 1024×640: итог с кнопками помещается без прокрутки. */
  margin-top: var(--space-4);
}
</style>
