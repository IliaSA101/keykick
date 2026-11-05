<script setup lang="ts">
/*
 * Карточка «Что нового» поверх главной (спека 010): затемнение, плашка версии, 1–6 строк, зелёная «Отлично!».
 * Как вступление матча: фокус на кнопке, Enter и Esc закрывают. Отметку «видел» ставит тот, кто слушает
 * `close` (главная) — карточка сама ничего не сохраняет. Цвета свои, как у главной: она всегда на фоне стадиона.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { NewsCard } from '../app/whatsNew';
import { ru } from '../i18n/ru';

defineProps<{ card: NewsCard }>();
const emit = defineEmits<{ close: [] }>();

const t = ru.news;
const ok = ref<HTMLButtonElement | null>(null);
let closed = false;

/** Закрыть один раз: двойной щелчок и Enter вместе с кнопкой не шлют `close` дважды. */
function close(): void {
  if (closed) return;
  closed = true;
  emit('close');
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }
  // На кнопке Enter сработает и сам; фокус потерян (клик по фону) — Enter тоже закрывает.
  if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  if (!e.repeat) close();
}

onMounted(() => {
  globalThis.addEventListener('keydown', onKey);
  ok.value?.focus();
});
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="dim">
    <section
      class="card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-title"
    >
      <span class="tag">{{ t.tag }} {{ card.version }}</span>
      <h2 id="news-title">
        {{ t.title }}
      </h2>
      <ul>
        <li
          v-for="line in card.lines"
          :key="line"
        >
          <span
            class="ico"
            aria-hidden="true"
          >⚽</span>
          <span>{{ line }}</span>
        </li>
      </ul>
      <button
        ref="ok"
        type="button"
        class="ok"
        @click="close"
      >
        {{ t.ok }}
      </button>
      <p class="hint">
        {{ t.hint }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.dim {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(10 9 30 / 0.62);
}

/* Шесть строк помещаются в окно 1024×640: список прокручивается внутри карточки, а не уводит её за край. */
.card {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: 100%;
  padding: 20px 26px 16px;
  border: 2px solid #f4c24a;
  border-radius: 16px;
  background: #24235a;
  color: #fff6e0;
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.5);
}

.tag {
  align-self: flex-start;
  margin-bottom: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f4c24a;
  color: #1a1a1a;
  font-size: 0.85rem;
  font-weight: 700;
}

h2 {
  margin: 0 0 12px;
  font-size: 1.75rem;
}

ul {
  display: grid;
  gap: 10px;
  margin: 0 0 16px;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 1.2rem;
  line-height: 1.3;
}

.ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #33327a;
  font-size: 1.3rem;
}

.ok {
  display: block;
  flex: none;
  width: 100%;
  padding: 12px;
  border: 2px solid #f4c24a;
  border-radius: 12px;
  background: linear-gradient(#5cc63c, #3d9a26);
  color: #ffffff;
  font: inherit;
  font-size: 1.4rem;
  font-weight: 800;
  cursor: pointer;
}

.ok:focus-visible {
  outline: 4px solid #ffffff;
  outline-offset: 3px;
}

.hint {
  flex: none;
  margin: 8px 0 0;
  color: #c9c6ec;
  font-size: 0.9rem;
  text-align: center;
}
</style>
