<script setup lang="ts">
/*
 * Что дальше после провала (спека 017, design §4, 017-Р12): кнопки предложений по порядку, первая выделена
 * (Enter), Tab переходит по остальным. Подпись помощи несёт потолок звёзд: Enter по привычке не срежет ★★★ молча.
 * Фокус на первую кнопку ставит родитель (`MatchResult`), он же ловит Enter, когда фокус сброшен.
 */
import type { Offer } from '../../engine/match/verdict';
import type { ResultButton } from '../../engine/matchResult/resultModel';
import { ru } from '../../i18n/ru';
import KeyButton from '../KeyButton.vue';
import { buttonLabel, buttonNote } from './labels';

defineProps<{
  buttons: ResultButton[];
  /** Провал три и больше раз подряд: добавить пояснение, что помощь — не позор. */
  note: boolean;
  /** Подсказка про Enter и Tab — только при двух и больше кнопках (`ResultModel.keysHint`). */
  keys: boolean;
}>();

defineEmits<{ choose: [offer: Offer] }>();

const t = ru.match2Result;
</script>

<template>
  <div class="stuck">
    <p class="lead">
      {{ t.stuck.lead }}
    </p>
    <p
      v-if="note"
      class="note"
    >
      {{ t.stuck.note }}
    </p>
    <div class="offers">
      <div
        v-for="(b, i) in buttons"
        :key="b.id"
        class="offer"
      >
        <KeyButton
          :primary="i === 0"
          :data-offer="b.id"
          @click="$emit('choose', b.id as Offer)"
        >
          {{ buttonLabel(b) }}
        </KeyButton>
        <small
          v-if="buttonNote(b)"
          class="offer-note"
        >{{ buttonNote(b) }}</small>
      </div>
    </div>
    <p
      v-if="keys"
      class="keys"
    >
      {{ t.stuck.enter }}
    </p>
  </div>
</template>

<style scoped>
.stuck {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.lead {
  margin: 0;
  font-weight: 800;
  font-size: 1.1rem;
}

.note {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  text-align: center;
}

.offers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: var(--space-3);
}

/* Подписи короткие (≤ 20 знаков, 017-Р34): каждая кнопка — в одну строку; главная одна (крупная, зелёная), остальные — обычные «клавиши». */
.offer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

/* Пояснение звёзд — под самой кнопкой помощи (017-Р49), не абзацем внизу. */
.offer-note {
  color: var(--text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

.offers :deep(.key-btn) {
  min-width: 0;
  white-space: nowrap;
}

.keys {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}
</style>
