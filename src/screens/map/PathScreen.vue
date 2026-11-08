<script setup lang="ts">
// «Путь клуба» (спека 019-Т9, design §6, ТЗ-1.3): шесть мест лиг на одной дороге — что пройдено, где ты, что дальше.
// Экран ничего не пишет в сохранение. Модель — `engine/map/path` через `app/map/pathState`; здесь только показ и клавиши
// (ТЗ-0.16): фокус при открытии — на главной кнопке («К уроку N» / «Повторить уроки за звёздами»), Enter ведёт на карту, Esc и «На карту» — туда же, Tab не заперт.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { clubRef } from '../../app/club/club';
import { MAP_PATH } from '../../app/map/go';
import { isBackKey, pathView } from '../../app/map/pathState';
import PathRoad from '../../components/map/PathRoad.vue';
import { mainActionLabel } from '../../components/map/pathLabels';
import { ru } from '../../i18n/ru';

const router = useRouter();
const t = ru.clubPath;

const backButton = ref<HTMLButtonElement | null>(null);
const mainButton = ref<HTMLButtonElement | null>(null);
const going = ref(false);

const mainLabel = computed(() => mainActionLabel(pathView.value));
const clubLine = (): string => [clubRef.value.name.trim(), clubRef.value.city.trim()].filter((s) => s !== '').join(' · ');

/** На карту. Кнопка заперта до смены маршрута: двойной Enter или щелчок — один переход. */
function toMap(): void {
  if (going.value) return;
  going.value = true;
  void router.push(MAP_PATH).finally(() => {
    going.value = false;
  });
}

function onKey(e: KeyboardEvent): void {
  if (!isBackKey(e)) return;
  e.preventDefault();
  toMap();
}

onMounted(() => {
  globalThis.addEventListener('keydown', onKey);
  // Фокус по умолчанию — главная кнопка (Enter ведёт на карту с карточкой текущего урока); если её нет, «На карту».
  (mainButton.value ?? backButton.value)?.focus({ preventScroll: true });
});
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <main
    class="path-screen"
  >
    <header class="bar">
      <h1>
        {{ t.title }}<span
          v-if="clubLine()"
          class="club"
        > · {{ clubLine() }}</span>
      </h1>
      <button
        ref="backButton"
        type="button"
        class="back"
        @click="toMap"
      >
        {{ t.back }}
      </button>
    </header>

    <div class="stage">
      <PathRoad
        :items="pathView"
        @open="toMap"
      />
    </div>

    <footer class="foot">
      <button
        ref="mainButton"
        type="button"
        class="main"
        @click="toMap"
      >
        {{ mainLabel }}
      </button>
    </footer>
  </main>
</template>

<style scoped>
/*
 * 1024×640 без прокрутки страницы: высота экрана — окно минус верхняя панель (66 px) и поля содержимого (2×24 px),
 * как у карты. Окно внутри увеличенного дерева делится на масштаб страницы.
 */
.path-screen {
  --chrome: 114px;

  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: calc(100vh / var(--ui-scale) - var(--chrome));
  min-height: 360px;
  color: var(--text);
}

.bar {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

h1 {
  flex: 1;
  margin: 0;
  overflow: hidden;
  font-size: 1.5rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club {
  color: var(--text-muted);
  font-weight: 600;
}

.back {
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-weight: 700;
  cursor: pointer;
}

/* Главная кнопка внизу: крупная, жёлтая, одна — как «Играть» на карте. */
.foot {
  display: flex;
  justify-content: center;
}

.main {
  min-height: 48px;
  padding: 0 var(--space-5, 32px);
  border: 2px solid var(--accent);
  border-radius: var(--radius);
  background: var(--accent);
  color: #1b1b1f;
  font: inherit;
  font-size: 1.15rem;
  font-weight: 800;
  cursor: pointer;
}

.main:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 3px;
}

/* Поле на всю доступную область: подписи мест считаются от его ширины (cqw). */
.stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  container-type: size;
  border-radius: 14px;
  background: var(--map-ground);
}
</style>
