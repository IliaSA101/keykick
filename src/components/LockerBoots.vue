<script setup lang="ts">
/*
 * Вкладка «Бутсы» шкафчика (спека 004, design.md §6): сверху «На тебе» — весь комплект,
 * ниже 11 пар. Обычные — у всех, лавка — за монеты, кубковые — за трофей лиги.
 * Покупка в два шага (развилка 004-Р8): «Купить за N» → «Купить за N? Да / Нет», фокус на «Нет»;
 * Esc и уход фокуса — «Нет». Второй щелчок двойного клика (detail > 1) не считается: «Да»
 * не спишет дважды (это и так стережёт buyBoots), а «Надеть» на месте «Да» не наденет пару.
 */
import { computed, nextTick, ref } from 'vue';
import { boots } from '../app/boots';
import { buyBootsNow, ourBoots, ourKit, progress, wearBootsNow } from '../app/progress';
import { artUrl } from '../art/assets';
import { canBuyBoots, ownedBoots, type Boots } from '../engine/boots';
import { shirtBack } from '../engine/club';
import { BOOTS_PRICES } from '../engine/rewards';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';
import CoinCount from './CoinCount.vue';
import KitView from './KitView.vue';
import OutfitView from './OutfitView.vue';

type State = 'worn' | 'owned' | 'buy' | 'short' | 'locked';

interface Card {
  b: Boots;
  state: State;
  /** Рамка: дешёвые — обычная, дорогие — серебро, кубковые — золото. */
  frame: 'common' | 'rare' | 'epic';
  /** Кубковая пара получена, но не надета. */
  isNew: boolean;
}

const owned = computed(() => ownedBoots(progress, boots));
const worn = computed(() => ourBoots());
const kit = computed(() => ourKit());
const back = computed(() => shirtBack(progress.club));

function stateOf(b: Boots): State {
  if (b.id === worn.value.id) return 'worn';
  if (owned.value.includes(b.id)) return 'owned';
  if (b.kind !== 'shop') return 'locked';
  return canBuyBoots(progress, boots, b.id) ? 'buy' : 'short';
}

const cards = computed<Card[]>(() =>
  boots.map((b) => {
    const state = stateOf(b);
    const frame = b.kind === 'cup' ? 'epic' : (b.price ?? 0) > Math.min(...BOOTS_PRICES) ? 'rare' : 'common';
    return { b, state, frame, isNew: b.kind === 'cup' && state === 'owned' };
  }),
);

const coinWord = (n: number): string => plural(n, ru.locker.coinWords);
const need = (b: Boots): number => Math.max(0, (b.price ?? 0) - progress.coins);

/** Пара, по которой открыт вопрос «Купить за N?». */
const asking = ref<string | null>(null);
const busy = ref(false);
/** Нажатие внутри вопроса: в Safari кнопка по щелчку не берёт фокус — это не «уход фокуса». */
let pressing = false;

function focusId(id: string): void {
  void nextTick(() => globalThis.document.getElementById(id)?.focus());
}

function ask(id: string): void {
  pressing = false;
  asking.value = id;
  focusId(`boots-no-${id}`);
}

function cancel(refocus: boolean): void {
  const id = asking.value;
  pressing = false;
  asking.value = null;
  if (refocus && id !== null) focusId(`boots-buy-${id}`);
}

function confirm(id: string, e: MouseEvent): void {
  if (e.detail > 1 || busy.value) return;
  busy.value = true;
  const bought = buyBootsNow(id);
  asking.value = null;
  busy.value = false;
  if (bought) focusId(`boots-wear-${id}`);
}

function leave(e: FocusEvent): void {
  const box = e.currentTarget as HTMLElement;
  if (pressing || (e.relatedTarget instanceof Node && box.contains(e.relatedTarget))) return;
  cancel(false);
}

/** Щелчок по карточке мимо кнопок не уводит фокус со страницы. Второй щелчок двойного клика
 *  по «Купить» падает на текст вопроса — фокус остаётся на «Нет», Esc работает; по «Да» —
 *  мимо «Надеть» (карточка стала ниже) — фокус остаётся на «Надеть». */
function hold(e: MouseEvent): void {
  if (!(e.target instanceof Element && e.target.closest('button'))) e.preventDefault();
}

function release(): void {
  globalThis.setTimeout(() => {
    pressing = false;
  });
}

function put(id: string, e: MouseEvent): void {
  if (e.detail > 1) return;
  wearBootsNow(id);
  focusId(`boots-worn-${id}`);
}

/** Блик кубковых — маска по самой паре: полоса идёт по бутсам, а не по карточке. */
const masks = ref<Record<string, string>>({});
function drawn(b: Boots, canvas: HTMLCanvasElement): void {
  if (b.kind === 'cup') masks.value = { ...masks.value, [b.id]: `url(${canvas.toDataURL()})` };
}

const total = boots.length;
</script>

<template>
  <div class="boots-tab">
    <div class="top">
      <section
        class="outfit-box"
        aria-labelledby="boots-outfit-title"
      >
        <h2 id="boots-outfit-title">
          {{ ru.locker.worn }}
        </h2>
        <OutfitView
          v-if="kit"
          class="outfit"
          layout="row"
          :kit="kit"
          :back="back"
          :boots="worn"
        />
        <KitView
          v-else
          class="lone"
          view="boots"
          :boots="worn"
        />
      </section>
      <div class="bar">
        <p class="counter">
          {{ ru.boots.counter }} {{ owned.length }} {{ ru.locker.of }} {{ total }}
        </p>
        <CoinCount :coins="progress.coins" />
      </div>
    </div>
    <ul class="grid">
      <li
        v-for="c in cards"
        :key="c.b.id"
        class="card"
        :class="[c.frame, { locked: c.state === 'locked', 'worn-card': c.state === 'worn' }]"
        @mousedown="hold"
      >
        <p
          v-if="c.isNew"
          class="badge"
        >
          {{ ru.boots.isNew }}
        </p>
        <div
          class="pic"
          :class="{ dark: c.state === 'locked' }"
        >
          <KitView
            view="boots"
            :boots="c.b"
            @drawn="drawn(c.b, $event)"
          />
          <span
            v-if="c.b.kind === 'cup' && masks[c.b.id]"
            class="shine"
            aria-hidden="true"
            :style="{ maskImage: masks[c.b.id] }"
          />
        </div>
        <img
          v-if="c.state === 'locked'"
          class="lock"
          :src="artUrl('iconLock')"
          alt=""
          width="256"
          height="256"
        >
        <span class="name">{{ c.b.name }}</span>
        <span
          v-if="c.state === 'worn'"
          :id="`boots-worn-${c.b.id}`"
          class="worn"
          tabindex="-1"
        >{{ ru.locker.worn }}</span>
        <button
          v-else-if="c.state === 'owned'"
          :id="`boots-wear-${c.b.id}`"
          type="button"
          class="act"
          :aria-label="`${ru.locker.wear}: ${c.b.name}`"
          @click="put(c.b.id, $event)"
        >
          {{ ru.locker.wear }}
        </button>
        <div
          v-else-if="c.state !== 'locked' && asking === c.b.id"
          class="ask"
          @keydown.esc.stop="cancel(true)"
          @focusout="leave"
          @pointerdown="pressing = true"
          @pointerup="release"
        >
          <span class="question">{{ ru.boots.buy }} {{ c.b.price }}?</span>
          <span class="answers">
            <button
              type="button"
              class="act yes"
              :disabled="busy"
              @click="confirm(c.b.id, $event)"
            >{{ ru.boots.yes }}</button>
            <button
              :id="`boots-no-${c.b.id}`"
              type="button"
              class="act"
              @click="cancel(true)"
            >{{ ru.boots.no }}</button>
          </span>
        </div>
        <template v-else-if="c.state !== 'locked'">
          <button
            :id="`boots-buy-${c.b.id}`"
            type="button"
            class="act buy"
            :disabled="c.state === 'short'"
            :aria-label="`${ru.boots.buy} ${c.b.price} ${coinWord(c.b.price ?? 0)}: ${c.b.name}`"
            @click="ask(c.b.id)"
          >
            {{ ru.boots.buy }} {{ c.b.price }}
            <img
              class="coin"
              :src="artUrl('iconCoin')"
              alt=""
              width="256"
              height="256"
            >
          </button>
          <span
            v-if="c.state === 'short'"
            class="sub"
          >{{ ru.boots.short }} {{ need(c.b) }} {{ coinWord(need(c.b)) }}</span>
        </template>
        <span
          v-else-if="c.b.league"
          class="sub"
        >{{ ru.boots.forCup }} {{ ru.cup.leagues[c.b.league] }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* «На тебе» и счётчик — одной полосой: с первого экрана 1024×640 видны и они, и сетка. */
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-5);
  margin: var(--space-2) 0 var(--space-3);
}

.outfit-box {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-radius: 18px;
  background: linear-gradient(160deg, #3a3f86, #1f2152);
  box-shadow:
    0 0 0 4px #6fd34a,
    0 10px 24px rgb(0 0 0 / 0.35);
}

.outfit-box h2 {
  margin: 0;
  color: #6fd34a;
  font-size: 1.1rem;
}

.outfit {
  --shirt: 120px;
}

.lone {
  width: 140px;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-5);
}

.counter {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  /* Колонки — по ширине в единицах после zoom, как у форм (спека 006, К6). */
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--space-3);
}

/* Карточки — как у форм: всегда «вечерние», рамка по цене. */
.card {
  position: relative;
  background: linear-gradient(160deg, #3a3f86, #1f2152);
  border-radius: 18px;
  padding: var(--space-4) var(--space-3);
  box-shadow:
    0 0 0 2px rgb(255 255 255 / 0.18),
    0 10px 24px rgb(0 0 0 / 0.35);
  text-align: center;
}

.card.rare {
  box-shadow:
    0 0 0 3px #c9d3e0,
    0 10px 24px rgb(0 0 0 / 0.35);
}

.card.epic {
  box-shadow:
    0 0 0 3px #f4c24a,
    0 0 18px rgb(244 194 74 / 0.45),
    0 10px 24px rgb(0 0 0 / 0.35);
}

.card.locked {
  background: linear-gradient(160deg, #2c2f63, #18193f);
}

.card.worn-card {
  box-shadow:
    0 0 0 4px #6fd34a,
    0 0 20px rgb(111 211 74 / 0.5),
    0 10px 24px rgb(0 0 0 / 0.35);
}

.badge {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 1;
  transform: translate(-50%, -50%);
  margin: 0;
  padding: 2px 14px;
  border-radius: 999px;
  white-space: nowrap;
  font-weight: 800;
  color: #1b3a12;
  background: #f4c24a;
}

.pic {
  position: relative;
  width: 86%;
  margin: 0 auto;
}

/* Кубковая без трофея видна в цвете, но приглушена: ради неё и играют кубок. */
.pic.dark {
  opacity: 0.6;
  filter: brightness(0.75);
}

/* Блик — полоса света по самой паре (маска — её же картинка), медленно. */
.shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(105deg, transparent 38%, rgb(255 255 255 / 0.8) 50%, transparent 62%) 0 0 / 300% 100%;
  mask-size: 100% 100%;
  mask-repeat: no-repeat;
  animation: shine 4s ease-in-out infinite;
}

@keyframes shine {
  0% {
    background-position: 100% 0;
  }

  60%,
  100% {
    background-position: 0 0;
  }
}

.lock {
  position: absolute;
  top: 30%;
  left: 50%;
  width: 48px;
  height: 48px;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.5));
}

.name {
  display: block;
  margin-top: var(--space-2);
  color: #fff6e0;
  font-weight: 700;
  font-size: 1.05rem;
}

.card.locked .name {
  color: #8f93c4;
}

.sub {
  display: block;
  margin-top: var(--space-1);
  color: #f4c24a;
  font-size: 0.9rem;
  font-weight: 700;
}

.worn,
.act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  min-width: 44px;
  margin-top: var(--space-2);
  padding: 0 var(--space-4);
  border-radius: 12px;
  font: inherit;
  font-weight: 800;
}

/* «На тебе» — метка, а не кнопка: галочка в круге и зелёный текст, без рамки и заливки. */
.worn {
  color: #6fd34a;
  cursor: default;
  user-select: none;
}

.worn::before {
  content: '\2713';
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: #1b3a12;
  background: #6fd34a;
  font-size: 0.95rem;
  line-height: 1;
}

.act {
  border: 2px solid #fff6e0;
  color: #fff6e0;
  background: transparent;
  cursor: pointer;
}

.act:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.12);
}

.act:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.act.yes {
  border-color: #6fd34a;
  color: #1b3a12;
  background: #6fd34a;
}

.act.yes:hover:not(:disabled) {
  background: #86e062;
}

.act:focus-visible,
.worn:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 3px;
}

/* «Купить за N» — в одну строку: уже поля и монета, перенос запрещён (карточка от 190 px). */
.act.buy {
  padding: 0 var(--space-3);
  gap: 4px;
  white-space: nowrap;
}

.coin {
  width: 20px;
  height: 20px;
}

.question {
  display: block;
  margin-top: var(--space-2);
  color: #fff6e0;
  font-weight: 800;
}

.answers {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
}

.answers .act {
  margin-top: var(--space-1);
}

@media (prefers-reduced-motion: reduce) {
  .shine {
    animation: none;
    background-position: 50% 0;
  }
}
</style>
