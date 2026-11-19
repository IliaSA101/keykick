<script setup lang="ts">
/**
 * Смена тренера внутри «Клуба» (Э2К.38, ТЗ-9.1, 020-Р12): четыре портрета, ← → и мышь двигают рамку-фокус, Enter — «Сменить» (на карточке — её же),
 * Esc — «Назад». Нынешний тренер помечен «твой», остальные — «соперник» (прежний станет тренером соперника). Выбор — `chosen`,
 * что менять и можно ли — решает `swapCoach` движка у хозяина окна.
 */
import { ref } from 'vue';
import CoachCard from '../../components/club/CoachCard.vue';
import { SWAP_WINDOW } from '../../components/club/places';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import { ENTER_DELAY } from '../../components/panel/focusCycle';
import { COACHES } from '../../engine/club/start';
import { ru } from '../../i18n/ru';

const props = defineProps<{ current: string }>();
const emit = defineEmits<{ pick: [id: string]; back: [] }>();
const t = ru.club.swap;
const focus = ref(Math.max(0, COACHES.findIndex((c) => c.id === props.current)));
const row = ref<HTMLElement | null>(null);

/** ← → двигают рамку и фокус на карточку: Enter на карточке подтверждает ту, что в рамке. Обработчик один — на окне. */
function key(e: KeyboardEvent): void {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  focus.value = (focus.value + (e.key === 'ArrowRight' ? 1 : -1) + COACHES.length) % COACHES.length;
  row.value?.querySelectorAll('button')[focus.value]?.focus();
}
</script>

<template>
  <KitModal
    :title="t.title"
    :lead="t.lead"
    :width="SWAP_WINDOW.width"
    :top="SWAP_WINDOW.top"
    :enter-delay="ENTER_DELAY"
    left
    @close="emit('back')"
    @keydown="key"
  >
    <div
      ref="row"
      class="coaches"
    >
      <CoachCard
        v-for="(c, i) in COACHES"
        :id="c.id"
        :key="c.id"
        :name="c.name"
        sm
        :focus="i === focus"
        :pressed="i === focus"
        :mine="c.id === current"
        :sub="c.id === current ? t.mine : t.rival"
        @click="focus = i"
        @keydown.enter.prevent="emit('pick', c.id)"
      />
    </div>
    <template #buttons>
      <KeyButton
        primary
        :sub="ru.kit.enter"
        @click="emit('pick', COACHES[focus]!.id)"
      >
        {{ t.go }}
      </KeyButton>
      <span />
      <KeyButton
        quiet
        :sub="ru.kit.esc"
        @click="emit('back')"
      >
        {{ ru.handsHelp.back }}
      </KeyButton>
    </template>
  </KitModal>
</template>

<style scoped>
.coaches {
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>
