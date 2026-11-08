<script setup lang="ts">
// «Что нового» поверх карты (спека 019-Т8, ТЗ-12.12): плашка версии, 1–6 строк, «Отлично!». Те же тексты, что у
// карточки v1 (`ru.news`), краски — из токенов. Отметку «видел» ставит тот, кто слушает `close` (экран).
import type { NewsCard } from '../../app/whatsNew';
import { ru } from '../../i18n/ru';
import MapDialog from './MapDialog.vue';

defineProps<{ card: NewsCard }>();
const emit = defineEmits<{ close: [] }>();

const t = ru.news;
</script>

<template>
  <MapDialog
    labelledby="news-title"
    enter-closes
    @close="emit('close')"
  >
    <template #default="{ close }">
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
        type="button"
        class="ok"
        data-autofocus
        @click="close"
      >
        {{ t.ok }}
      </button>
      <p class="hint">
        {{ t.hint }}
      </p>
    </template>
  </MapDialog>
</template>

<style scoped>
.tag {
  align-self: flex-start;
  margin-bottom: var(--space-1);
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent);
  color: #1b1b1f;
  font-size: 0.85rem;
  font-weight: 700;
}

h2 {
  margin: 0 0 var(--space-3);
  font-size: 1.75rem;
}

ul {
  display: grid;
  gap: 10px;
  margin: 0 0 var(--space-4);
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
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
  background: var(--accent-soft);
  font-size: 1.3rem;
}

.ok {
  display: block;
  width: 100%;
  padding: var(--space-3);
  border: 0;
  border-radius: 12px;
  background: var(--accent);
  color: #1b1b1f;
  font: inherit;
  font-size: 1.3rem;
  font-weight: 800;
  cursor: pointer;
}

.ok:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 3px;
}

.hint {
  margin: var(--space-2) 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  text-align: center;
}
</style>
