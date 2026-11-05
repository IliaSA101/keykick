<script setup lang="ts">
/*
 * «Точный пас мышью»: сначала щелчки по партнёру (он каждый раз в новом месте), потом
 * перетаскивание мяча к партнёру. Мимо — подсказка, без проигрыша.
 * Партнёр — кнопка: с клавиатуры (Tab, Enter) игру тоже можно пройти.
 * Точки и проверка «мяч дошёл» — в движке (engine/minigames), здесь указатель и рисунок.
 */
import { computed, ref, shallowRef } from 'vue';
import { artUrl } from '../../art/assets';
import { BALL_SPOT, droppedOn, makeMouseGame, type Spot } from '../../engine/minigames';
import { ru } from '../../i18n/ru';

const props = defineProps<{ seed: number }>();
const emit = defineEmits<{ finished: [summary: string] }>();

const t = ru.halftime.mouse;
const ballUrl = artUrl('ball');
const game = makeMouseGame(props.seed);

const stage = ref<'click' | 'drag' | 'over'>('click');
const index = ref(0);
const misses = ref(0);
const message = ref<string | null>(null);
const field = ref<HTMLElement | null>(null);
/** Где мяч сейчас (в процентах поля); тащат — следует за указателем. */
const ball = shallowRef<Spot>(BALL_SPOT);
const dragging = ref(false);

const total = game.clicks.length + game.drags.length;
const done = computed(() => (stage.value === 'click' ? index.value : game.clicks.length + index.value));
const partner = computed(() => (stage.value === 'click' ? game.clicks[index.value] : game.drags[index.value]) ?? null);

const at = (s: Spot) => ({ left: `${s.x}%`, top: `${s.y}%` });

function advance(): void {
  message.value = null;
  index.value += 1;
  ball.value = BALL_SPOT;
  if (stage.value === 'click' && index.value >= game.clicks.length) {
    stage.value = 'drag';
    index.value = 0;
  } else if (stage.value === 'drag' && index.value >= game.drags.length) {
    stage.value = 'over';
    emit('finished', t.result);
  }
}

/** Щелчок по партнёру. На этапе перетаскивания мышью — подсказка; Enter с клавиатуры (detail 0) — пас. */
function onPartner(e: MouseEvent): void {
  if (stage.value === 'click' || (stage.value === 'drag' && e.detail === 0)) advance();
  else if (stage.value === 'drag') message.value = t.drag;
}

/** Щелчок мимо партнёра — промах. */
function onField(e: PointerEvent): void {
  if (stage.value !== 'click' || e.target !== field.value) return;
  misses.value += 1;
  message.value = t.miss;
}

function spotOf(e: PointerEvent): Spot | null {
  const rect = field.value?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return { x: clamp(((e.clientX - rect.left) / rect.width) * 100), y: clamp(((e.clientY - rect.top) / rect.height) * 100) };
}

function onBallDown(e: PointerEvent): void {
  if (stage.value !== 'drag') return;
  e.preventDefault();
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  dragging.value = true;
}

function onBallMove(e: PointerEvent): void {
  if (!dragging.value) return;
  const s = spotOf(e);
  if (s) ball.value = s;
}

function onBallUp(e: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  const s = spotOf(e);
  if (s && partner.value && droppedOn(partner.value, s)) {
    advance();
    return;
  }
  misses.value += 1;
  message.value = t.miss;
  ball.value = BALL_SPOT;
}
</script>

<template>
  <div class="mouse">
    <p
      class="task"
      aria-live="polite"
    >
      <template v-if="stage !== 'over'">
        {{ stage === 'click' ? t.click : t.drag }}
        <span class="count">({{ done + 1 }} {{ ru.halftime.of }} {{ total }})</span>
      </template>
    </p>
    <div
      ref="field"
      class="field"
      :aria-label="t.label"
      role="group"
      @pointerdown="onField"
    >
      <button
        v-if="partner && stage !== 'over'"
        :key="`${stage}-${index}`"
        type="button"
        class="partner"
        :style="at(partner)"
        :aria-label="t.partner"
        @click="onPartner"
      >
        <span
          class="shirt"
          aria-hidden="true"
        />
      </button>
      <img
        v-if="stage === 'drag'"
        class="ball"
        :class="{ dragging }"
        :style="at(ball)"
        :src="ballUrl"
        :alt="t.ball"
        width="256"
        height="256"
        draggable="false"
        @pointerdown="onBallDown"
        @pointermove="onBallMove"
        @pointerup="onBallUp"
        @pointercancel="onBallUp"
      >
    </div>
    <p
      class="message"
      role="status"
    >
      {{ message ?? '' }}
    </p>
  </div>
</template>

<style scoped>
.mouse {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.task {
  margin: 0;
  min-height: 1.6em;
  font-size: 1.2rem;
  font-weight: 800;
}

.count {
  font-size: 0.95rem;
  font-weight: 600;
  opacity: 0.8;
}

.field {
  position: relative;
  width: min(100%, 600px);
  height: 220px;
  border-radius: 14px;
  background:
    linear-gradient(90deg, transparent calc(50% - 1px), rgb(255 255 255 / 0.5) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
    repeating-linear-gradient(90deg, #2f7d32 0 60px, #2a722d 60px 120px);
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 0.5);
  cursor: crosshair;
  touch-action: none;
}

.partner {
  position: absolute;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: rgb(255 216 74 / 0.35);
  box-shadow: 0 0 0 4px #ffd84a;
  cursor: pointer;
  display: grid;
  place-items: center;
  animation: appear 0.25s ease-out;
}

.shirt {
  width: 40px;
  height: 44px;
  border-radius: 12px 12px 6px 6px;
  background: linear-gradient(#3d6fd8, #244aa0);
  pointer-events: none;
}

.partner:focus-visible {
  outline: 4px solid #ffffff;
  outline-offset: 4px;
}

.ball {
  position: absolute;
  width: 52px;
  height: 52px;
  transform: translate(-50%, -50%);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.ball.dragging {
  cursor: grabbing;
  width: 58px;
  height: 58px;
}

/* Появление — не меньше 0,7: цель 64 px и в первом кадре шире 44 px (docs/specs/006-page-scale.md,
   К7; с 0,4 она 250 мс была 26×26), а «вырастание» дорисовывает прозрачность. */
@keyframes appear {
  from {
    transform: translate(-50%, -50%) scale(0.7);
    opacity: 0;
  }
}

.message {
  margin: 0;
  min-height: 1.5em;
  font-weight: 700;
  color: #ffd84a;
}

@media (prefers-reduced-motion: reduce) {
  .partner {
    animation: none;
  }
}
</style>
