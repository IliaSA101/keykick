<script setup lang="ts">
// Пак с формой: награда за сыгранный тайм. Форма выбирается и сохраняется сразу по нажатию,
// анимация лишь показывает её — уход со страницы посреди анимации пак не теряет.
// Открытая форма — комплектом (спека 004, развилка 004-Р6): футболка прежнего размера,
// справа шорты над гетрами; карточка растёт вширь, высота та же.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { loadOutfitBases } from '../app/kitBase';
import { kits } from '../app/kits';
import { buyPackForCoins, openPendingPack, progress } from '../app/progress';
import { artUrl } from '../art/assets';
import KeyButton from '../components/KeyButton.vue';
import OutfitView from '../components/OutfitView.vue';
import type { Kit } from '../engine/kit';
import { PACK_PRICE } from '../engine/rewards';
import { canBuyPack } from '../engine/save';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

type Phase = 'sealed' | 'opening' | 'revealed';

/** Сколько трясётся пак перед вспышкой. Без анимации (prefers-reduced-motion) — сразу. */
const OPEN_MS = 1100;

const phase = ref<Phase>('sealed');
const result = ref<{ kit: Kit; isNew: boolean; coins: number } | null>(null);
const screen = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof globalThis.setTimeout> | undefined;

function reducedMotion(): boolean {
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** «Новая!», «Повтор — +25 монет» или (повтор без монет) «Уже есть». */
function badge(r: { isNew: boolean; coins: number }): string {
  if (r.isNew) return ru.pack.isNew;
  if (r.coins <= 0) return ru.pack.duplicate;
  return `${ru.pack.dupCoins} +${r.coins} ${plural(r.coins, ru.pack.coinWords)}`;
}

function open(): void {
  const r = openPendingPack();
  const kit = r && kits.find((k) => k.id === r.kitId);
  if (!r || !kit) return;
  result.value = { kit, isNew: r.isNew, coins: r.coins };
  phase.value = 'opening';
  globalThis.clearTimeout(timer);
  timer = globalThis.setTimeout(
    () => {
      phase.value = 'revealed';
      // Фокус на главную кнопку: Enter сразу ведёт дальше («Открыть ещё» или «Ещё матч»).
      void nextTick(() => screen.value?.querySelector<HTMLElement>('.actions .primary')?.focus());
    },
    reducedMotion() ? 0 : OPEN_MS,
  );
}

// Купить ещё пак прямо здесь, не уходя в шкафчик: монеты остались — следующий пак сразу.
const price = `${PACK_PRICE} ${plural(PACK_PRICE, ru.pack.coinWords)}`;
const canBuy = computed(() => progress.pendingPacks === 0 && canBuyPack(progress, kits.length));

function buy(): void {
  if (!buyPackForCoins()) return;
  result.value = null;
  phase.value = 'sealed';
  void nextTick(() => screen.value?.querySelector<HTMLElement>('.primary')?.focus());
}

// Слои шорт, гетр и бутс — пока пак запечатан: открытая форма сразу выйдет комплектом.
onMounted(() => void loadOutfitBases().catch(() => undefined));
onBeforeUnmount(() => globalThis.clearTimeout(timer));
</script>

<template>
  <section
    ref="screen"
    class="pack-screen"
  >
    <h1>{{ ru.pack.title }}</h1>

    <div
      v-if="phase !== 'revealed' && (phase === 'opening' || progress.pendingPacks > 0)"
      class="stage"
    >
      <p class="lead">
        {{ ru.pack.sealed }}
      </p>
      <div
        class="pack"
        :class="{ opening: phase === 'opening' }"
      >
        <img
          :src="artUrl('iconPack')"
          alt=""
          width="256"
          height="256"
        >
        <span
          v-if="phase === 'opening'"
          class="flash"
        />
      </div>
      <p
        v-if="progress.pendingPacks > 1 && phase === 'sealed'"
        class="left"
      >
        {{ ru.pack.left }} {{ progress.pendingPacks - 1 }}
      </p>
      <KeyButton
        primary
        :disabled="phase === 'opening'"
        @click="open"
      >
        {{ ru.pack.open }}
      </KeyButton>
    </div>

    <div
      v-else-if="phase === 'revealed' && result"
      class="stage"
    >
      <!-- Плашка «Новая!» — наклейкой на верхнем крае карточки: своей строкой она съедала высоту. -->
      <div
        class="card reveal"
        :class="result.kit.rarity"
      >
        <p
          class="badge"
          :class="{ dup: !result.isNew }"
        >
          <img
            v-if="result.coins > 0"
            class="coin"
            :src="artUrl('iconCoin')"
            alt=""
            width="256"
            height="256"
          >
          {{ badge(result) }}
        </p>
        <OutfitView
          class="outfit"
          layout="row"
          :kit="result.kit"
        />
        <span class="name">{{ result.kit.name }}</span>
        <span class="rarity">{{ ru.pack.rarityLabel }} {{ ru.pack.rarity[result.kit.rarity] }}</span>
      </div>
      <div class="actions">
        <KeyButton
          v-if="progress.pendingPacks > 0"
          primary
          @click="open"
        >
          {{ ru.pack.openMore }}
        </KeyButton>
        <KeyButton
          v-else-if="canBuy"
          primary
          @click="buy"
        >
          {{ ru.locker.buyPack }} {{ price }}
        </KeyButton>
        <KeyButton to="/locker">
          {{ ru.pack.toLocker }}
        </KeyButton>
        <KeyButton
          to="/match"
          :primary="progress.pendingPacks === 0 && !canBuy"
        >
          {{ ru.pack.nextMatch }}
        </KeyButton>
      </div>
    </div>

    <div
      v-else
      class="stage"
    >
      <img
        class="empty-pack"
        :src="artUrl('iconPack')"
        alt=""
        width="256"
        height="256"
      >
      <p class="lead">
        {{ ru.pack.none }}
      </p>
      <KeyButton
        primary
        to="/match"
      >
        {{ ru.pack.play }}
      </KeyButton>
    </div>
  </section>
</template>

<style scoped>
.pack-screen {
  /* Шире карточки: три кнопки под формой — в один ряд, иначе второй ряд уводит их за край. */
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}

/*
 * Высота — окна 1024×640 без прокрутки во всех состояниях (замер критика: было 770).
 * Пак и карточка ужимаются по высоте окна; vh внутри увеличенного дерева делится на масштаб.
 */
h1 {
  margin: 0 0 var(--space-4);
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.lead {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
}

.left {
  margin: 0;
  color: var(--text-muted);
  font-weight: 700;
}

.pack {
  position: relative;
  /* 400 — всё, что над паком и под ним: панель, отступы, заголовок, подпись, «ещё в запасе», кнопка. */
  width: min(280px, 70vw / var(--ui-scale), 100vh / var(--ui-scale) - 400px);
  animation: wobble 2.4s ease-in-out infinite;
}

.pack img,
.empty-pack {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 12px 18px rgb(0 0 0 / 0.4));
}

.empty-pack {
  width: min(160px, 40vw / var(--ui-scale));
  opacity: 0.5;
  filter: grayscale(1);
}

.pack.opening {
  animation: shake 0.12s linear infinite;
}

/* Вспышка растёт к концу тряски и закрывает пак — за ней появляется форма. */
.flash {
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  background: radial-gradient(circle, #fffbe6 0%, rgb(255 230 140 / 0.8) 40%, transparent 70%);
  animation: flash 1.1s ease-in forwards;
  pointer-events: none;
}

.badge {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  margin: 0;
  padding: 4px 18px;
  border-radius: 999px;
  font-size: 1.15rem;
  font-weight: 800;
  color: #1b3a12;
  background: #f4c24a;
}

.badge .coin {
  width: 28px;
  height: 28px;
  margin-right: var(--space-2);
  vertical-align: -6px;
}

.badge.dup {
  color: var(--text);
  background: var(--surface);
  border: 2px solid var(--border);
}

/* Карточка формы «вечерняя», как в шкафчике; рамка — по редкости. */
.card {
  position: relative;
  /* Место над карточкой — под верхнюю половину плашки. */
  margin-top: var(--space-5);
  background: linear-gradient(160deg, #3a3f86, #1f2152);
  border-radius: 20px;
  /* Сверху — нижняя половина плашки. */
  padding: var(--space-5) var(--space-4) var(--space-4);
  box-shadow:
    0 0 0 3px rgb(255 255 255 / 0.2),
    0 12px 28px rgb(0 0 0 / 0.4);
}

.card.rare {
  box-shadow:
    0 0 0 4px #c9d3e0,
    0 12px 28px rgb(0 0 0 / 0.4);
}

.card.epic {
  box-shadow:
    0 0 0 4px #f4c24a,
    0 0 32px rgb(244 194 74 / 0.6),
    0 12px 28px rgb(0 0 0 / 0.4);
}

/* Футболка — по высоте окна тоже: кнопки под карточкой — в первом экране. 424 — всё, что не
   футболка: панель, отступы, заголовок, край плашки, имя с редкостью, кнопки и запас. По ширине
   комплект ≈ 1,8 футболки — отсюда 44vw: вместе с полями карточка не шире 80vw. */
.outfit {
  --shirt: min(340px, 44vw / var(--ui-scale), 100vh / var(--ui-scale) - 424px);
}

.reveal {
  animation: pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
}

.name {
  display: block;
  margin-top: var(--space-2);
  color: #fff6e0;
  font-weight: 800;
  font-size: 1.6rem;
}

.rarity {
  display: block;
  color: #e6ecf5;
  font-size: 1rem;
  font-weight: 700;
  /* «Редкость: эпическая» — одной строкой: вторая строка растила карточку. */
  white-space: nowrap;
}

.card.epic .rarity {
  color: #f4c24a;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
}

@keyframes wobble {
  0%,
  100% {
    transform: rotate(-4deg);
  }

  50% {
    transform: rotate(4deg) translateY(-6px);
  }
}

@keyframes shake {
  0% {
    transform: translate(0, 0) rotate(0);
  }

  25% {
    transform: translate(-6px, 2px) rotate(-6deg);
  }

  50% {
    transform: translate(5px, -3px) rotate(5deg);
  }

  75% {
    transform: translate(-4px, -2px) rotate(-4deg);
  }

  100% {
    transform: translate(0, 0) rotate(0);
  }
}

@keyframes flash {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }

  100% {
    opacity: 1;
    transform: scale(1.3);
  }
}

@keyframes pop {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pack,
  .pack.opening,
  .flash,
  .reveal {
    animation: none;
  }
}
</style>
