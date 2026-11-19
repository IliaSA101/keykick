<script setup lang="ts">
/**
 * Выбор тренера (лист Э2К.34/35) и его приветствие (Э2К.41): 4 карточки на белом, рамка — выбранный; ← → и мышь.
 * Enter на карточке (и вне кнопок) выбирает карточку в фокусе и подтверждает; на кнопке «Выбрать» — жмёт её.
 * После выбора — окно с репликой `greet` из `coach.json` и «Дальше · Enter»; Enter не засчитывается первые `ENTER_DELAY` мс
 * и при удержании (двойной Enter не пролетает приветствие). Esc в приветствии — назад к выбору.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import KeyButton from '../kit/KeyButton.vue';
import KitPanel from '../kit/KitPanel.vue';
import KitModal from '../panel/KitModal.vue';
import { ENTER_DELAY, enterAllowed } from '../panel/focusCycle';
import { COACHES, coachEnter } from '../../engine/club/start';
import { ru } from '../../i18n/ru';
import { coachPortrait } from './coachArt';
import CoachCard from './CoachCard.vue';
import { GREET_WINDOW } from './places';

const props = defineProps<{ modelValue: string; busy?: boolean; /** Стенд кадров: экран сразу с приветствием (Э2К.41); в игре — нет. */ greet?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [id: string]; done: [] }>();

const greeting = ref(props.greet === true);
const openedAt = globalThis.performance.now(); // экран открылся: Enter прошлого окна («Сохранить») сюда не пролетает
const chosen = computed(() => COACHES.find((c) => c.id === props.modelValue) ?? COACHES[0]!);
const portrait = coachPortrait;

function move(step: number): void {
  const i = COACHES.findIndex((c) => c.id === props.modelValue);
  emit('update:modelValue', COACHES[(Math.max(0, i) + step + COACHES.length) % COACHES.length]!.id);
}
/** Выбрать карточку `id` и подтвердить: открывается приветствие. */
function confirm(id: string): void {
  emit('update:modelValue', id);
  greeting.value = true;
}
function focusKind(): 'card' | 'button' | 'none' {
  const el = globalThis.document.activeElement;
  if (el instanceof HTMLElement && el.classList.contains('ccard')) return 'card';
  return el instanceof HTMLElement && el.closest('button, a') ? 'button' : 'none';
}
function onKey(e: KeyboardEvent): void {
  if (greeting.value) return;
  if (e.key === 'Enter') {
    const kind = focusKind();
    if (!enterAllowed({ repeat: e.repeat, openedAt, now: e.timeStamp, delay: ENTER_DELAY })) {
      e.preventDefault(); // и кнопка «Выбрать» не щёлкает: это Enter прошлого окна или удержание
      return;
    }
    if (coachEnter(kind) === 'native') return;
    e.preventDefault();
    if (kind === 'none') confirm(chosen.value.id); // карточку в фокусе обрабатывает её обработчик (там известен id)
    return;
  }
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  move(e.key === 'ArrowRight' ? 1 : -1);
}
function onCardEnter(e: KeyboardEvent, id: string): void {
  e.preventDefault(); // кнопка-карточка сама по Enter только щёлкает (выбирает) — здесь ещё и подтверждаем
  if (enterAllowed({ repeat: e.repeat, openedAt, now: e.timeStamp, delay: ENTER_DELAY })) confirm(id);
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="pick">
    <div class="col">
      <span class="steps">{{ ru.start.coach.step }}</span>
      <h1>{{ ru.start.coach.title }}</h1>
      <p class="lead muted">
        {{ ru.start.coach.lead }}
      </p>
      <KitPanel
        soft
        class="cards"
      >
        <CoachCard
          v-for="c in COACHES"
          :id="c.id"
          :key="c.id"
          :name="c.name"
          :sel="c.id === modelValue"
          :pressed="c.id === modelValue"
          @click="emit('update:modelValue', c.id)"
          @keydown.enter="onCardEnter($event, c.id)"
        />
      </KitPanel>
      <KeyButton
        primary
        :sub="ru.kit.enter"
        @click="greeting = true"
      >
        {{ ru.start.coach.pick }}
      </KeyButton>
      <p class="tiny">
        {{ ru.start.coach.hint }}
      </p>
    </div>
    <KitModal
      v-if="greeting"
      :title="chosen.name"
      :width="GREET_WINDOW.width"
      :top="GREET_WINDOW.top"
      @close="greeting = false"
    >
      <img
        class="face"
        :src="portrait(chosen.id)"
        :alt="chosen.name"
      >
      <p class="greet">
        {{ chosen.greet }}
      </p>
      <template #buttons>
        <KeyButton
          primary
          :sub="ru.kit.enter"
          :state="busy ? 'off' : undefined"
          @click="emit('done')"
        >
          {{ ru.start.coach.next }}
        </KeyButton>
      </template>
    </KitModal>
  </div>
</template>

<style scoped>
/* числа — единицы макета из генераторов Э2К.34 и Э2К.41 (карточки — в CoachCard) (e2k-club.mjs, collection-e.css и collection-e-club.css); множителя нет */
.pick {
  position: absolute;
  inset: 0;
}
.col {
  position: absolute;
  inset: 110px 0 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.pick h1 {
  margin: 0;
  font-size: 32px;
  text-shadow: 0 2px 8px #000;
}
.steps,
.tiny,
.muted {
  margin: 0;
  color: #ece9df;
  text-shadow: 0 1px 4px #000;
}
.steps {
  font-size: 14px;
}
.muted {
  font-size: 15px;
}
.tiny {
  font-size: 13px;
}
.cards {
  position: relative;
  display: flex;
  gap: 14px;
  padding: 12px 14px;
}
.face {
  display: block;
  width: 130px;
  height: 150px;
  border-radius: 12px;
  object-fit: cover;
  object-position: top;
  background: #fff;
}
.greet {
  margin: 0;
  text-align: center;
  font-size: 15px;
  color: var(--text-muted);
}
</style>
