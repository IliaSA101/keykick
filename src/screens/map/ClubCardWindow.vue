<script setup lang="ts">
/**
 * «Карточка клуба» поверх Карты (068-Р17, Э2.31/.38): доиграно, голы, задачи, лучшая скорость, трудные клавиши, «Изменить».
 * Числа — `ClubCard` (`engine/club/card.ts`), её собирает `app/club/cardData.ts`; «Изменить» ведёт в окно «Клуб» на правку (`/club?edit=1`).
 */
import { computed } from 'vue';
import { fill } from '../../app/home/texts';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import type { ClubCard } from '../../engine/club/card';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const props = defineProps<{ card: ClubCard; name: string; city: string }>();
defineEmits<{ close: []; edit: [] }>();
const t = ru.club;
const c = ru.map.clubCard;
const rows = computed(() => [
  [t.matches, String(props.card.matches)],
  [t.goals, String(props.card.goals)],
  [t.tasks, String(props.card.tasks)],
  [t.speed, fill(c.speed, { n: props.card.bestSpeed, unit: plural(props.card.bestSpeed, ru.home.signs) })],
]);
const note = computed(() => fill(t.hardNote, { keys: props.card.minute.join(t.hardAnd) }));
</script>

<template>
  <KitModal
    :title="ru.frame.menu.club"
    :lead="fill(c.lead, { name, city })"
    :width="440"
    :top="110"
    left
    @close="$emit('close')"
  >
    <template #head>
      <KeyButton
        quiet
        :sub="ru.kit.esc"
        @click="$emit('close')"
      >
        {{ ru.kit.close }}
      </KeyButton>
    </template>
    <div class="rows">
      <div
        v-for="[label, value] in rows"
        :key="label"
        class="kb-row"
      >
        <span>{{ label }}</span>
        <span><em>{{ value }}</em></span>
      </div>
      <div class="kb-row">
        <span>{{ t.hardKeys }}</span>
        <span
          v-if="card.hard.length"
          class="keys"
        >
          <kbd
            v-for="k in card.hard"
            :key="k"
            class="big"
          >{{ k }}</kbd>
        </span>
        <span v-else><em>{{ t.hardNone }}</em></span>
      </div>
      <p
        v-if="card.minute.length"
        class="note"
      >
        {{ note }}
      </p>
    </div>
    <template #buttons>
      <KeyButton
        quiet
        @click="$emit('edit')"
      >
        {{ t.edit }}
      </KeyButton>
    </template>
  </KitModal>
</template>

<style scoped>
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
</style>
