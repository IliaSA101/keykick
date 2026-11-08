<script setup lang="ts">
/*
 * Итог матча v2 (спека 017, design §3, §4, §6, §8; ТЗ-2.12): счёт, звёзды, «чего не хватило», заработанное (монеты крупно, болельщики значком, копилка — только при нуле монет; `EarnedLine`), рост формы пальцев, кнопки. Лежит в слоте `result` экрана матча.
 * Клавиатура: через `screenDelay.resultMs` после появления фокус встаёт на первую (выделенную) кнопку, Enter нажимает её,
 * Tab идёт по остальным; если фокус потерян (клик в пустое место), Enter всё равно жмёт выделенную. До задержки Enter
 * не принимается: лишний знак после последней атаки не должен нажать кнопку (017-Р27, как HOLD_MS пенальти).
 * Состояние и решения — `resultModel`.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { resultModel, type ResultExtras } from '../../engine/matchResult/resultModel';
import { screenDelay } from '../../engine/match/view';
import type { MatchResultInfo } from '../../engine/match/view';
import type { Offer } from '../../engine/match/verdict';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import KeyButton from '../KeyButton.vue';
import { whyText } from './labels';
import EarnedLine from './EarnedLine.vue';
import SquadForm from './SquadForm.vue';
import StuckOffer from './StuckOffer.vue';

const props = defineProps<{
  info: MatchResultInfo;
  extras: ResultExtras;
  us: string;
  rival: string;
}>();

const emit = defineEmits<{
  /** Выбор после провала. */
  choose: [offer: Offer];
  /** Матч пройден: «Дальше». */
  next: [];
}>();

const t = ru.match2Result;
const root = ref<HTMLElement | null>(null);
const m = computed(() => resultModel(props.info, props.extras));

const why = computed(() => whyText(m.value.why));
// Проигрыш: первой строкой — что заработано, потом счёт и «Ещё N голов — и победа» (017-Р30).
const earnedFirst = computed(() => m.value.kind === 'loss' && m.value.coins.paid);

// Фокус и Enter включаются после задержки; мышь работает сразу.
const ready = ref(false);
let readyTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

const press = (id: string): void => {
  if (id === 'next') emit('next');
  else emit('choose', id as Offer);
};

/** Enter с потерянным фокусом (не на кнопке) — выделенная кнопка; на кнопке Enter сработает сам. */
function onKey(e: KeyboardEvent): void {
  if (e.code !== 'Enter' || e.repeat || e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  if (!ready.value) return;
  press(m.value.buttons[0]?.id ?? 'quit');
}

onMounted(() => {
  globalThis.addEventListener('keydown', onKey);
  readyTimer = globalThis.setTimeout(() => {
    ready.value = true;
    root.value?.querySelector('button')?.focus();
  }, screenDelay.resultMs);
});
onBeforeUnmount(() => {
  globalThis.clearTimeout(readyTimer);
  globalThis.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div
    ref="root"
    class="result-card"
    :data-kind="m.kind"
  >
    <h2 class="title">
      {{ t.title[m.kind] }}
    </h2>
    <p class="score">
      {{ us }} <b>{{ m.goals }} : {{ m.conceded }}</b> {{ rival }}
    </p>
    <p
      v-if="m.kind !== 'loss'"
      class="stars"
      :aria-label="`${t.stars}: ${m.stars} ${t.starsOf}`"
    >
      <span
        v-for="n in 3"
        :key="n"
        :class="{ on: n <= m.stars }"
        aria-hidden="true"
      >★</span>
      <small
        v-if="m.newStars > 0"
        class="fresh"
      >+{{ m.newStars }} {{ plural(m.newStars, t.newStars) }}</small>
    </p>
    <p
      v-if="why"
      class="why"
      role="status"
    >
      {{ why }}
    </p>

    <EarnedLine
      class="earned-line"
      :class="{ first: earnedFirst }"
      :coins="m.coins"
    />

    <SquadForm
      :growth="m.growth"
      :report="m.report"
    />

    <div class="actions">
      <StuckOffer
        v-if="m.kind === 'loss'"
        :buttons="m.buttons"
        :note="m.stuck"
        :keys="m.keysHint"
        @choose="(o) => emit('choose', o)"
      />
      <template v-else>
        <KeyButton
          primary
          data-offer="next"
          @click="emit('next')"
        >
          {{ t.next }}
        </KeyButton>
        <span class="key">{{ t.nextKey }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.result-card {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  text-align: center;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Провал: три кнопки в одну строку (017-Р34) — карточка шире обычной. */
.result-card[data-kind='loss'] {
  max-width: 820px;
}

.title {
  order: -2;
  margin: 0;
  font-size: 1.5rem;
}

/* Проигрыш: заработанное сразу под заголовком (порядок только на глаз, в тексте оно рядом с итогом). */
.first {
  order: -1;
}

.score {
  margin: 0;
  color: var(--text-muted);
}

.score b {
  color: var(--text);
  font-size: 1.6rem;
}

.stars {
  margin: 0;
  font-size: 2.4rem;
  line-height: 1.1;
  letter-spacing: 0.1em;
  color: var(--border);
}

.stars .on {
  color: #f2b600;
}

.fresh {
  display: block;
  font-size: 0.9rem;
  letter-spacing: 0;
  color: var(--accent);
}

.why {
  margin: 0;
  font-size: 0.95rem;
}

/*
 * Выделенная кнопка итога (первая, на ней фокус и Enter) обведена всегда, а не только когда фокус уже встал
 * (он ставится после задержки, 017-Р27): на любом итоге в любой момент кадр одинаков (017-Р49).
 */
.result-card :deep(.key-btn.primary) {
  outline: 4px solid #f4c24a;
  outline-offset: 4px;
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: var(--space-2);
  color: var(--text-muted);
  font-size: 0.8rem;
}
</style>
