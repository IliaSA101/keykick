<script setup lang="ts">
/*
 * Страница родителя: «Версии игры» (спека 010) — установленная версия, список изменений для взрослых
 * с датами и ссылка, которая открывает на главной карточку «Что нового» ещё раз.
 * Отметку «игрок это видел» ссылка не меняет: меняет её только закрытие карточки.
 */
import { RouterLink } from 'vue-router';
import { APP_VERSION } from '../app/version';
import { formatDate, parentList, replay } from '../app/whatsNew';
import { ru } from '../i18n/ru';

const t = ru.parent;
const releases = parentList().map((n) => ({
  version: n.version,
  date: formatDate(n.date) || t.versionsNoDate,
  lines: n.parent,
}));
// Нет версии со строками для ребёнка — показывать на главной нечего, кнопки нет.
const canReplay = replay() !== null;
</script>

<template>
  <section class="block">
    <h2>{{ t.versions }}</h2>
    <p class="now">
      {{ t.versionsNow }} <b>{{ APP_VERSION }}</b>
    </p>
    <ul class="releases">
      <li
        v-for="r in releases"
        :key="r.version"
      >
        <b>{{ r.version }}</b>
        <span class="date">{{ r.date }}</span>
        <ul v-if="r.lines.length > 0">
          <li
            v-for="line in r.lines"
            :key="line"
          >
            {{ line }}
          </li>
        </ul>
      </li>
    </ul>
    <template v-if="canReplay">
      <RouterLink
        class="btn"
        :to="{ path: '/', query: { news: '1' } }"
      >
        {{ t.versionsAgain }}
      </RouterLink>
      <p class="muted">
        {{ t.versionsAgainHint }}
      </p>
    </template>
  </section>
</template>

<style scoped>
/* Облик — как у остальной страницы родителя (ParentCheck.vue, ParentScreen.vue). */
.block {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--paper-border);
}

h2 {
  margin: 0 0 var(--space-3);
  font-size: 1.2rem;
}

.now {
  margin: 0 0 var(--space-2);
}

.releases {
  margin: 0 0 var(--space-3);
  padding: 0;
  list-style: none;
}

.releases > li {
  padding: var(--space-2) 0;
  border-top: 1px solid var(--paper-border);
}

.date {
  margin-left: var(--space-2);
  color: #555;
  font-size: 0.9rem;
}

.releases ul {
  margin: var(--space-1) 0 0;
  padding-left: var(--space-5);
}

.muted {
  margin: var(--space-2) 0 0;
  color: #555;
}

.btn {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--paper-button);
  border-radius: var(--radius);
  background: var(--paper-button);
  color: var(--paper-button-text);
  font: inherit;
  font-weight: 700;
  text-decoration: none;
}

.btn:focus-visible {
  outline: 3px solid var(--paper-focus);
  outline-offset: 2px;
}
</style>
