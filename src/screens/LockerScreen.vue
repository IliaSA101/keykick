<script setup lang="ts">
// Шкафчик: коллекция форм. Домашняя форма клуба — первой; неполученные — тёмный силуэт
// с замком и «???»: силуэт рисуется из чёрной заглушки, цвета формы на экран не попадают.
// Монеты (за повторы из паков) тратятся здесь же: пак за PACK_PRICE.
// «Надеть» — своя домашняя или любая полученная: в ней команда выходит на матч.
// Вкладки «Формы | Бутсы» (спека 004, развилка 004-Р5): ?tab=boots открывает вторую,
// бутсы — в LockerBoots; здесь только переключение.
import { computed, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { boots } from '../app/boots';
import { kits } from '../app/kits';
import { buyPackForCoins, progress, wear } from '../app/progress';
import { artUrl } from '../art/assets';
import CoinCount from '../components/CoinCount.vue';
import KeyButton from '../components/KeyButton.vue';
import KitView from '../components/KitView.vue';
import LockerBoots from '../components/LockerBoots.vue';
import WearFlight from '../components/WearFlight.vue';
import { ownedBoots } from '../engine/boots';
import { clubKit, shirtBack, shirtInk } from '../engine/club';
import type { Kit } from '../engine/kit';
import { PACK_PRICE } from '../engine/rewards';
import { canBuyPack } from '../engine/save';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

interface Slot {
  kit: Kit;
  owned: boolean;
  club: boolean;
  /** Надета на матч. */
  worn: boolean;
}

const silhouette = (id: string): Kit => ({
  id,
  name: ru.locker.unknown,
  rarity: 'common',
  pattern: 'plain',
  body: '#000000',
  sleeves: '#000000',
  trim: '#000000',
});

const slots = computed<Slot[]>(() => {
  const home = progress.wornKit === null;
  const list: Slot[] = progress.club ? [{ kit: clubKit(progress.club), owned: true, club: true, worn: home }] : [];
  for (const kit of kits) {
    const owned = progress.ownedKits.includes(kit.id);
    const worn = owned && kit.id === progress.wornKit;
    list.push({ kit: owned ? kit : silhouette(kit.id), owned, club: false, worn });
  }
  return list;
});

// Надетая форма — спиной, с именем и номером игрока (если они есть); остальные — спереди.
const back = computed(() => shirtBack(progress.club));

/*
 * «Надеть»: подписи со спины перелетают с прежней надетой формы на новую (WearFlight). Пока летят,
 * новая форма уже спиной, но пустая; долетели — нарисованы на ней. При «меньше движения» — сразу.
 */
const grid = ref<HTMLElement | null>(null);
/** Рамка формы в px окна — как её ждёт WearFlight. */
type FlightRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
/** Текущий полёт; n — ключ: новый «Надеть» посреди полёта начинает его заново. */
const flight = ref<{ from: FlightRect; to: FlightRect; n: number } | null>(null);
let flights = 0;
const BLANK = { name: '', number: null };

function shirtRect(key: string): FlightRect | null {
  const r = grid.value?.querySelector(`[data-slot="${key}"] .shirt`)?.getBoundingClientRect();
  return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

const slotKey = (slot: Slot): string => (slot.club ? 'club' : slot.kit.id);

/** Цвет летящих подписей — как их нарисует новая форма (shirtInk). */
const ghostInk = computed(() => {
  const worn = slots.value.find((s) => s.worn);
  return worn ? shirtInk(worn.kit) : { fill: '#ffffff', outline: '#16161a' };
});

function put(slot: Slot): void {
  flight.value = null;
  const was = slots.value.find((s) => s.worn);
  const from = was ? shirtRect(slotKey(was)) : null;
  const to = shirtRect(slotKey(slot));
  wear(slot.club ? null : slot.kit.id);
  // Кнопка «Надеть» сменилась надписью «На тебе» — фокус на неё, а не в начало страницы.
  void nextTick(() => globalThis.document.getElementById(`worn-${slotKey(slot)}`)?.focus());
  const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
  if (!back.value || !from || !to || still) return;
  flights += 1;
  flight.value = { from, to, n: flights };
}

// Клубная форма — тоже место в коллекции: «Собрано 1 из 25» сразу после создания клуба.
const total = kits.length + 1;
const collected = computed(() => slots.value.filter((s) => s.owned).length);

const router = useRouter();
const price = `${PACK_PRICE} ${plural(PACK_PRICE, ru.locker.coinWords)}`;
const collectionDone = computed(() => progress.ownedKits.length >= kits.length);
const canBuy = computed(() => canBuyPack(progress, kits.length));

function buy(): void {
  if (buyPackForCoins()) void router.push('/pack');
}

type Tab = 'kits' | 'boots';
const tabs: readonly Tab[] = ['kits', 'boots'];
const route = useRoute();
const tab = computed<Tab>(() => (route.query.tab === 'boots' ? 'boots' : 'kits'));

/*
 * Подсказка под заголовком — только новичку (развилка 006-Р10): пока полученных форм меньше
 * HINT_KITS, а бутс — одни обычные. Дальше карточки и так всё говорят, а строка нужна сетке.
 */
const HINT_KITS = 3;
const hint = computed<string | null>(() => {
  if (tab.value === 'boots') return ownedBoots(progress, boots).length <= 1 ? ru.boots.hint : null;
  return progress.ownedKits.length < HINT_KITS ? ru.locker.hint : null;
});

function select(next: Tab, focus = false): void {
  if (next !== tab.value) void router.replace({ query: next === 'boots' ? { tab: 'boots' } : {} });
  if (focus) void nextTick(() => globalThis.document.getElementById(`tab-${next}`)?.focus());
}

/** Стрелки ←/→ по вкладкам: выбор сразу, фокус — на выбранную. */
function arrows(e: KeyboardEvent): void {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (step === 0) return;
  e.preventDefault();
  const i = tabs.indexOf(tab.value);
  select(tabs[(i + step + tabs.length) % tabs.length] ?? 'kits', true);
}
</script>

<template>
  <section class="locker">
    <header class="head">
      <div class="head-main">
        <div class="title">
          <h1>{{ ru.nav.locker }}</h1>
          <div
            class="tabs"
            role="tablist"
            :aria-label="ru.boots.tabsLabel"
            @keydown="arrows"
          >
            <button
              v-for="t in tabs"
              :id="`tab-${t}`"
              :key="t"
              type="button"
              role="tab"
              class="tab"
              :aria-selected="tab === t"
              :aria-controls="`panel-${t}`"
              :tabindex="tab === t ? 0 : -1"
              @click="select(t)"
            >
              {{ t === 'boots' ? ru.boots.tabBoots : ru.boots.tabKits }}
            </button>
          </div>
        </div>
        <p
          v-if="hint"
          class="hint"
        >
          {{ hint }}
        </p>
      </div>
      <div class="head-actions">
        <KeyButton
          v-if="progress.pendingPacks > 0"
          primary
          to="/pack"
        >
          {{ ru.locker.openPacks }} ({{ progress.pendingPacks }})
        </KeyButton>
        <KeyButton to="/club">
          {{ ru.locker.myClub }}
        </KeyButton>
      </div>
    </header>
    <LockerBoots
      v-if="tab === 'boots'"
      id="panel-boots"
      role="tabpanel"
      aria-labelledby="tab-boots"
    />
    <div
      v-else
      id="panel-kits"
      role="tabpanel"
      aria-labelledby="tab-kits"
    >
      <div class="bar">
        <p class="counter">
          {{ ru.locker.collected }} {{ collected }} {{ ru.locker.of }} {{ total }}
        </p>
        <CoinCount :coins="progress.coins" />
        <template v-if="collectionDone">
          <p class="shop-hint">
            {{ ru.locker.collectionDone }}
          </p>
          <KeyButton @click="select('boots', true)">
            {{ ru.boots.toBoots }}
          </KeyButton>
        </template>
        <template v-else>
          <KeyButton
            :disabled="!canBuy"
            @click="buy"
          >
            {{ ru.locker.buyPack }} {{ price }}
          </KeyButton>
          <p
            v-if="!canBuy"
            class="shop-hint"
          >
            {{ ru.locker.buyHint }} {{ price }}.
          </p>
        </template>
      </div>
      <ul
        ref="grid"
        class="grid"
      >
        <li
          v-for="slot in slots"
          :key="slotKey(slot)"
          :data-slot="slotKey(slot)"
          class="card"
          :class="[slot.owned ? slot.kit.rarity : 'locked', { 'worn-card': slot.worn }]"
        >
          <div
            class="shirt"
            :class="{ dark: !slot.owned }"
          >
            <KitView
              :kit="slot.kit"
              :back="slot.worn ? (flight ? BLANK : back) : null"
            />
          </div>
          <img
            v-if="!slot.owned"
            class="lock"
            :src="artUrl('iconLock')"
            alt=""
            width="256"
            height="256"
          >
          <span class="name">{{ slot.kit.name }}</span>
          <span
            v-if="slot.club"
            class="sub"
          >{{ ru.locker.homeKit }}</span>
          <span
            v-if="slot.worn"
            :id="`worn-${slotKey(slot)}`"
            class="worn"
            tabindex="-1"
          >{{ ru.locker.worn }}</span>
          <button
            v-else-if="slot.owned"
            type="button"
            class="wear"
            :aria-label="`${ru.locker.wear}: ${slot.kit.name}`"
            @click="put(slot)"
          >
            {{ ru.locker.wear }}
          </button>
        </li>
      </ul>
    </div>
    <WearFlight
      v-if="flight && back"
      :key="flight.n"
      :from="flight.from"
      :to="flight.to"
      :back="back"
      :ink="ghostInk"
      @done="flight = null"
    />
  </section>
</template>

<style scoped>
/* Плотный шкафчик (спека 006, К6): шапка в одну строку, сетка сама решает, сколько колонок
   (auto-fill по ширине в единицах после zoom — медиазапросы по окну здесь врут). */
.locker {
  max-width: 1440px;
  margin: 0 auto;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3) var(--space-5);
}

.head-main {
  min-width: 0;
}

.head-actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-3);
}

/* Кнопки шапки и полосы — ниже обычных KeyButton (высота ~50 вместо 56–70, цель всё равно ≥ 44):
   иначе шапка не встаёт в строку и первый ряд форм на 1024×640 уходит за край. */
.head .key-btn.key-btn,
.bar .key-btn.key-btn {
  min-width: 0;
  padding: 11px 20px;
  font-size: 1.1rem;
}

/* Заголовок и вкладки — одной строкой: вкладки видны с первого экрана. */
.title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-5);
}

.title h1 {
  margin: 0;
}

/* Вкладки — переключатель-табло: выбранная залита золотом. */
.tabs {
  display: inline-flex;
  padding: 4px;
  gap: 4px;
  border-radius: 14px;
  background: rgb(16 15 44 / 0.75);
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.18);
}

.tab {
  min-height: 44px;
  padding: 0 var(--space-5);
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #fff6e0;
  font: inherit;
  font-weight: 800;
  font-size: 1.1rem;
  cursor: pointer;
}

.tab:hover {
  background: rgb(255 255 255 / 0.12);
}

.tab[aria-selected='true'] {
  color: #1b3a12;
  background: #f4c24a;
}

.tab:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 3px;
}

.hint {
  margin: var(--space-1) 0 0;
  color: var(--text-muted);
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-5);
  margin: var(--space-2) 0 var(--space-3);
}

.bar p {
  margin: 0;
}

.counter {
  font-size: 1.25rem;
  font-weight: 800;
}

.shop-hint {
  flex: 1 1 240px;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--space-3);
}

/* Карточка всегда «вечерняя», как стадион на главной: формы на тёмном выглядят ярче в любой теме.
   Рамка — по редкости: обычная — тонкая, редкая — серебро, эпическая — золото. */
.card {
  position: relative;
  background: linear-gradient(160deg, #3a3f86, #1f2152);
  border-radius: 18px;
  padding: var(--space-3) var(--space-3) var(--space-4);
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

.shirt.dark {
  filter: brightness(0) opacity(0.45);
}

.lock {
  position: absolute;
  top: 38%;
  left: 50%;
  width: 56px;
  height: 56px;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.5));
}

.name {
  display: block;
  margin-top: var(--space-2);
  color: #fff6e0;
  font-weight: 700;
  font-size: 1.1rem;
}

.card.locked .name {
  color: #8f93c4;
}

.sub {
  display: block;
  color: #f4c24a;
  font-size: 0.9rem;
  font-weight: 700;
}

/* Надетая — зелёная рамка и метка «На тебе»; у остальных полученных — кнопка той же высоты. */
.card.worn-card {
  box-shadow:
    0 0 0 4px #6fd34a,
    0 0 20px rgb(111 211 74 / 0.5),
    0 10px 24px rgb(0 0 0 / 0.35);
}

.worn,
.wear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin-top: var(--space-2);
  padding: 0 var(--space-4);
  border-radius: 12px;
  font: inherit;
  font-weight: 800;
}

/* «На тебе» — метка, а не кнопка: галочка в круге и зелёный текст, без рамки и заливки. */
.worn {
  gap: 6px;
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

.worn:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 3px;
}

.wear {
  border: 2px solid #fff6e0;
  color: #fff6e0;
  background: transparent;
  cursor: pointer;
}

.wear:hover {
  background: rgb(255 255 255 / 0.12);
}

.wear:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 3px;
}
</style>
