<script setup lang="ts">
/**
 * Правая колонка окна «Клуб» (Э2К.32): тренер со «Сменить ›», четыре числа, трудные клавиши и подпись о «Минуте тренера».
 * Ничего не считает: карточку (`ClubCard`) собирает `engine/club/card.ts`; нет трудных клавиш — «пока нет», подписи нет.
 */
import { computed } from 'vue';
import { fill } from '../../app/home/texts';
import { coachPortrait } from '../../components/club/coachArt';
import KitChip from '../../components/kit/KitChip.vue';
import type { ClubCard } from '../../engine/club/card';
import { coachNameOf } from '../../engine/club/start';
import { ru } from '../../i18n/ru';

const props = defineProps<{ card: ClubCard; coach: string; /** Только просмотр (вторая вкладка): «Сменить ›» погашен. */ locked?: boolean }>();
defineEmits<{ swap: [] }>();
const t = ru.club;
const rows = computed(() => [
  [t.matches, String(props.card.matches)],
  [t.goals, String(props.card.goals)],
  [t.tasks, String(props.card.tasks)],
  [t.speed, `${props.card.bestSpeed} ${t.speedUnit}`],
]);
const note = computed(() => fill(t.hardNote, { keys: props.card.minute.join(t.hardAnd) }));
</script>

<template>
  <div class="right">
    <div class="crow">
      <img
        :src="coachPortrait(coach)"
        alt=""
      >
      <span>
        <b>{{ coachNameOf(coach) }}</b>
        <small>{{ t.coachSub }}</small>
      </span>
      <KitChip
        sm
        :disabled="locked"
        @click="$emit('swap')"
      >
        {{ t.coachSwap }}
      </KitChip>
    </div>
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
      <span v-else><em class="none">{{ t.hardNone }}</em></span>
    </div>
    <p
      v-if="card.minute.length"
      class="note"
    >
      {{ note }}
    </p>
  </div>
</template>

<style scoped>
/* числа — единицы макета из генератора Э2К.32 (e2k-club.mjs, collection-e.css и collection-e-club.css); множителя нет */
.right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  text-align: left;
}
.crow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #1a1c45;
}
.crow img {
  width: 46px;
  height: 62px;
  object-fit: cover;
  object-position: 50% 6%;
  border-radius: 8px;
  background: #fff;
}
.crow span {
  flex: 1;
}
.crow b {
  display: block;
  font-size: 15px;
}
.crow small {
  font-size: 12px;
  color: var(--text-muted);
}
.none {
  color: var(--text-muted);
  font-weight: 600;
}
.note {
  margin: 0;
  color: var(--text-muted);
}
</style>
