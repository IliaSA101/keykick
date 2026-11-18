<script setup lang="ts">
/**
 * Строка «прислать файл в Telegram» (063-Р50): слова до и после ника — свои у каждого окна, ник — ссылка из одного места
 * (`ru.system.telegram`). Ссылка открывается в новой вкладке: игра остаётся на экране.
 */
import { ru } from '../../i18n/ru';

defineProps<{ before: string; after: string }>();
</script>

<template>
  <p class="note tg">
    {{ before }}
    <a
      :href="ru.system.telegram.url"
      target="_blank"
      rel="noopener"
    >{{ ru.system.telegram.nick }}</a>
    {{ after }}
  </p>
</template>

<style scoped>
.tg {
  margin: 0;
  text-align: center;
}
.tg a {
  color: var(--text);
  font-weight: 700;
}
.tg a:focus-visible {
  outline: 3px solid var(--text); /* белая обводка, как у ссылок первого запуска — не золото */
  border-radius: 4px;
}
</style>
