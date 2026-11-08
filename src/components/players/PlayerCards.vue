<script setup lang="ts">
/*
 * Карточки игроков и «Новый игрок» (#/players). Карточки — кнопки: Tab и Enter, стрелки ходят между ними.
 * Фокус при открытии — на последнем выбранном: Enter сразу продолжает его игру.
 */
import { onMounted, ref } from 'vue';
import KitView from '../KitView.vue';
import type { PlayerCardData } from '../../app/players/cards';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  cards: readonly PlayerCardData[];
  /** id карточки, на которую встаёт фокус при открытии. */
  focusId: string | null;
  /** Кнопка «Новый игрок» нужна (места есть и форма закрыта). */
  showAdd: boolean;
}>();
const emit = defineEmits<{ play: [id: string]; add: [] }>();

const t = ru.players;
const list = ref<HTMLElement | null>(null);
const addButton = ref<HTMLButtonElement | null>(null);

function buttons(): HTMLButtonElement[] {
  return [...(list.value?.querySelectorAll<HTMLButtonElement>('button.card') ?? [])];
}

/** Стрелки — к соседней карточке по кругу. */
function onArrow(e: KeyboardEvent): void {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return;
  const all = buttons();
  const i = all.findIndex((b) => b === e.target);
  if (i < 0) return;
  e.preventDefault();
  all[(i + step + all.length) % all.length]?.focus();
}

/** Фокус — на кнопку «Новый игрок» (после отмены формы). */
function focusAdd(): void {
  addButton.value?.focus();
}
defineExpose({ focusAdd });

onMounted(() => {
  const i = props.cards.findIndex((c) => c.id === props.focusId);
  buttons()[Math.max(0, i)]?.focus();
});
</script>

<template>
  <ul
    ref="list"
    class="cards"
    @keydown="onArrow"
  >
    <li
      v-for="c in cards"
      :key="c.id"
    >
      <button
        type="button"
        class="card"
        :class="{ playing: c.playing }"
        @click="emit('play', c.id)"
      >
        <span class="kit">
          <KitView
            v-if="c.kit"
            :kit="c.kit"
          />
          <span
            v-else
            class="no-kit"
            aria-hidden="true"
          >{{ c.name.slice(0, 1).toUpperCase() }}</span>
        </span>
        <span class="name">{{ c.name }}</span>
        <span class="club">{{ c.club ?? t.noClub }}</span>
        <span class="lesson">{{ t.lesson }} {{ c.lesson }}</span>
        <span
          v-if="c.playing"
          class="badge"
        >{{ t.playing }}</span>
      </button>
    </li>
    <li v-if="showAdd">
      <button
        ref="addButton"
        type="button"
        class="card add"
        @click="emit('add')"
      >
        <span
          class="plus"
          aria-hidden="true"
        >+</span>
        <span class="name">{{ t.add }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--space-4);
}

/* Карточка — большая кнопка целиком: форма клуба, имя, клуб и урок. */
.card {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-3);
  border: 3px solid rgb(244 194 74 / 0.55);
  border-radius: 18px;
  background: linear-gradient(160deg, rgb(58 63 134 / 0.94), rgb(31 33 82 / 0.94));
  color: var(--text);
  font: inherit;
  cursor: pointer;
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.4);
  transition: transform 0.08s;
}

.card:hover {
  transform: translateY(-3px);
  border-color: #f4c24a;
}

.card:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 4px;
}

.card.playing {
  border-color: #6fd34a;
}

.kit {
  width: 110px;
  height: 110px;
  display: grid;
  place-items: center;
}

.no-kit {
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.12);
  color: #f4c24a;
  font-size: 2.6rem;
  font-weight: 900;
}

.name {
  font-size: 1.4rem;
  font-weight: 900;
}

.club {
  color: #f4c24a;
  font-weight: 700;
}

.lesson {
  color: var(--text-muted);
}

.badge {
  margin-top: var(--space-1);
  padding: 2px 12px;
  border-radius: 999px;
  background: #6fd34a;
  color: #10231b;
  font-size: 0.85rem;
  font-weight: 800;
}

.card.add {
  justify-content: center;
  border-style: dashed;
  background: rgb(255 255 255 / 0.06);
}

.plus {
  font-size: 3.4rem;
  line-height: 1;
  font-weight: 900;
  color: #f4c24a;
}
</style>
