<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { artUrl, type ArtKey } from './art/assets';
import BreakOverlay from './components/BreakOverlay.vue';
import { ru } from './i18n/ru';
import { previewOf } from './app/matchJump';
import { playerName, players } from './app/players';
import { shared } from './app/progress';
import { action, breakLeftMs, screenChanged, tick } from './app/session';
import { muted } from './app/sound';

// Главная — полноэкранная картинка со своим меню, верхняя панель и общий фон ей не нужны.
const route = useRoute();
const router = useRouter();
const isHome = computed(() => route.name === 'home');
// «Кто играет?» — без верхнего меню: до выбора игрока в игру не пускает страж роутера.
const showTopbar = computed(() => !isHome.value && route.name !== 'players');

// Имя игрока и «Сменить» — когда игроков двое и больше; один игрок — всё как раньше.
// Смена посреди матча бросает его, как уход со страницы: первый тайм уже сохранён.
// В матче «Сменить» нет: случайный щелчок бросал бы тайм (docs/design.md, правки тестировщика игроков).
const who = computed(() =>
  players.players.length >= 2 && route.name !== 'parent' && route.name !== 'match' ? playerName.value : null,
);
function switchPlayer(): void {
  void router.push('/players');
}

// Рисованный фон под экраном: матч — у стадиона, остальное — в раздевалке.
const bgKey = computed<ArtKey>(() => (route.name === 'match' ? 'menuBg' : 'lockerBg'));
const bgStyle = computed(() => ({ backgroundImage: `url(${artUrl(bgKey.value)})` }));
const logoUrl = artUrl('logo');

// Время игры и перерыв (engine/session). Страница родителя — не игра: её время не считается,
// перерыв её не закрывает (родитель может его выключить). Быстрая проверка матча по ссылке
// со страницы родителя (app/matchJump) — тоже не игра: в сохранение не пишет и время ребёнка.
const isParent = computed(() => route.name === 'parent');
const notGame = computed(() => isParent.value || (route.name === 'match' && previewOf(route.query) !== null));
const onBreak = computed(() => breakLeftMs.value > 0 && !notGame.value);

// Переход экрана — место, где начинается назначенный перерыв: идущий тайм он не обрывает.
watch(
  () => route.fullPath,
  () => {
    if (!notGame.value) screenChanged();
  },
  { immediate: true },
);
// Время набралось не на матче — тайм не идёт, перерыв можно начать сразу.
watch(
  () => shared.clock.breakDue,
  (due) => {
    if (due && route.name !== 'match' && !notGame.value) screenChanged();
  },
);

/** Нажатия и клики: на перерыве до игры не доходят, иначе — копят время игры. */
function onInput(e: KeyboardEvent | PointerEvent): void {
  if (onBreak.value) {
    // Сочетания и F-клавиши — браузеру (обновить страницу, закрыть вкладку).
    if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key))) return;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (!notGame.value) action();
}

let ticker: ReturnType<typeof globalThis.setInterval> | undefined;

onMounted(() => {
  // Захват на окне — раньше слушателей экранов (матч слушает окно сам).
  globalThis.addEventListener('keydown', onInput, true);
  globalThis.addEventListener('pointerdown', onInput, true);
  ticker = globalThis.setInterval(tick, 1000);
});

onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onInput, true);
  globalThis.removeEventListener('pointerdown', onInput, true);
  globalThis.clearInterval(ticker);
});
</script>

<template>
  <div
    class="layout"
    :class="{ plain: isParent }"
    :inert="onBreak"
  >
    <div
      v-if="!isHome"
      class="backdrop"
      :style="bgStyle"
      aria-hidden="true"
    />
    <header
      v-if="showTopbar"
      class="topbar"
    >
      <RouterLink
        class="brand"
        to="/"
      >
        <img
          :src="logoUrl"
          :alt="ru.appTitle"
          width="1100"
          height="526"
        >
      </RouterLink>
      <nav class="nav">
        <RouterLink to="/match">
          {{ ru.nav.match }}
        </RouterLink>
        <RouterLink to="/locker">
          {{ ru.nav.locker }}
        </RouterLink>
        <RouterLink to="/stats">
          {{ ru.nav.stats }}
        </RouterLink>
      </nav>
      <div
        v-if="who !== null"
        class="who"
      >
        <span class="who-name">{{ who }}</span>
        <button
          type="button"
          class="switch"
          :aria-label="ru.players.switchLabel"
          @click="switchPlayer"
        >
          {{ ru.players.switch }}
        </button>
      </div>
      <button
        type="button"
        class="sound"
        :aria-pressed="!muted"
        :aria-label="muted ? ru.sound.off : ru.sound.on"
        :title="muted ? ru.sound.off : ru.sound.on"
        @click="muted = !muted"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M4 9h4l5-4v14l-5-4H4z"
            fill="currentColor"
          />
          <path
            v-if="!muted"
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            v-else
            d="M16 9l6 6M22 9l-6 6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </header>
    <main
      class="content"
      :class="{ home: isHome, match: route.name === 'match' }"
    >
      <!-- Ключ — кубок из адреса: «Матч» в меню посреди матча кубка (#/match?cup=…) открывает
           обычный матч заново, а не оставляет тот же экран (Vue переиспользует его на смене query). -->
      <RouterView :key="String(route.query.cup ?? '')" />
    </main>
  </div>
  <BreakOverlay
    v-if="onBreak"
    :left-ms="breakLeftMs"
  />
</template>

<style scoped>
/*
 * Крупный экран (docs/design.md, 04.11; две шкалы — docs/specs/006-page-scale.md): матч растёт
 * с окном (--ui-scale), страницы и верхняя панель — вдвое медленнее (--page-scale, app/viewport).
 * Панель на всех экранах одной высоты: при входе в матч крупнеет только поле.
 * zoom увеличивает и vh — экраны делят высоту окна на --ui-scale, а вне матча оно здесь же
 * подменено на --page-scale. Страница родителя — не игра: она остаётся в обычном размере.
 */
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout.plain {
  --ui-scale: 1;
  --page-scale: 1;
}

/* Фон — неподвижный слой под всем: картинка и вечернее затемнение поверх, чтобы панели читались. */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  background-color: var(--bg);
  background-size: cover;
  background-position: center;
}

.backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, rgb(21 20 58 / 0.35), rgb(21 20 58 / 0.75)),
    linear-gradient(rgb(21 20 58 / 0.2), rgb(21 20 58 / 0.45));
}

/* Панель — как табло стадиона: тёмная, с золотой кромкой снизу. */
.topbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-5);
  background: rgb(16 15 44 / 0.88);
  border-bottom: 2px solid #f4c24a;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
  zoom: var(--page-scale);
}

.brand {
  display: block;
  border-radius: var(--radius);
}

.brand img {
  display: block;
  height: 48px;
  width: auto;
  filter: drop-shadow(0 3px 8px rgb(0 0 0 / 0.5));
}

.nav {
  display: flex;
  gap: var(--space-2);
  flex: 1;
}

/* Пункты меню — цели не меньше 44 px: плашка нажимается целиком. */
.nav a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-4);
  border-radius: 999px;
  color: var(--text);
  font-weight: 700;
  text-decoration: none;
}

.nav a:hover {
  background: rgb(255 255 255 / 0.1);
}

.nav a.router-link-active {
  background: #f4c24a;
  color: #1b1b1f;
}

/* Кто играет: имя и «Сменить» — плашка 44 px, как пункты меню. */
.who {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.who-name {
  max-width: 10em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #f4c24a;
  font-weight: 800;
}

.switch {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 2px solid rgb(244 194 74 / 0.6);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.switch:hover {
  background: rgb(255 255 255 / 0.1);
}

/* Кнопка звука: вся площадь 44×44 нажимается, не только значок. */
.sound {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 2px solid rgb(244 194 74 / 0.6);
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.sound:hover {
  background: rgb(255 255 255 / 0.1);
}

.sound svg {
  width: 24px;
  height: 24px;
  pointer-events: none;
}

.content {
  flex: 1;
  padding: var(--space-5);
  zoom: var(--ui-scale);
}

/* Всё, кроме матча, — страница: её множитель и её деление vh. */
.content:not(.match) {
  --ui-scale: var(--page-scale);
}

.content.home {
  padding: 0;
}

/* Матч: низ — у клавиатуры с руками (MatchScreen, .board), иначе 1024×640 прокручивается;
   сверху отступ меньше — эти 12 px отданы ногтям больших пальцев под пробелом. */
.content.match {
  padding-top: var(--space-3);
  padding-bottom: 0;
}

@media (width <= 760px) {
  .brand img {
    height: 36px;
  }

  .topbar {
    padding: var(--space-2) var(--space-3);
    gap: var(--space-2);
  }

  .nav a {
    padding: 0 var(--space-3);
  }
}
</style>
