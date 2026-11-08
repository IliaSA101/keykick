<script setup lang="ts">
/*
 * Обходчик кадров (#/dev/frames, только dev-сборка): ссылки на состояния экранов. Ссылка — обычный <a>
 * с ?seed=<фикстура> (страница перезагружается, фикстура ложится в хранилище до старта, dev/seed).
 * tools/shots.mjs читает отсюда a[data-frame] и снимает каждый кадр.
 */
import { ref } from 'vue';
import { checkIdb, type ContractResult } from '../app/journal/contract';
import { dbName, PREFIX } from '../app/versions/build';
import { dev } from '../i18n/ru/dev';
import { FRAMES } from './frames';

const base = import.meta.env.BASE_URL;
const groups = [...new Set(FRAMES.map((f) => f.group))].map((group) => ({
  group,
  frames: FRAMES.filter((f) => f.group === group),
}));

// Проверка журнала (018-Т4, В6): контрактный набор на IndexedDB этого браузера во временной базе.
const journalRows = ref<ContractResult[] | null>(null);
const journalBusy = ref(false);
async function checkJournal(): Promise<void> {
  journalBusy.value = true;
  journalRows.value = await checkIdb(dbName(PREFIX));
  journalBusy.value = false;
}
const href = (seed: string, path: string) => `${base}?seed=${seed}#${path}`;
</script>

<template>
  <section class="frames">
    <h1>{{ dev.framesTitle }}</h1>
    <p class="lead">
      {{ dev.framesLead }}
    </p>
    <div class="journal">
      <button
        type="button"
        data-journal-check
        :disabled="journalBusy"
        @click="checkJournal"
      >
        {{ dev.journal.check }}
      </button>
      <ul
        v-if="journalRows"
        class="journal-rows"
        data-journal-rows
      >
        <li
          v-for="r in journalRows"
          :key="r.name"
        >
          {{ r.ok ? dev.journal.ok : dev.journal.fail }}: {{ dev.journal.cases[r.name] ?? r.name }}{{ r.detail ? ` (${r.detail})` : '' }}
        </li>
      </ul>
    </div>
    <div
      v-for="g in groups"
      :key="g.group"
      class="group"
    >
      <h2>{{ g.group }}</h2>
      <ul>
        <li
          v-for="f in g.frames"
          :key="f.id"
        >
          <a
            :href="href(f.seed, f.path)"
            :data-frame="f.id"
            :data-group="f.group"
            :data-path="f.path"
            :data-seed="f.seed"
            :data-expand="f.expand"
          >{{ f.id }}</a>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.frames {
  max-width: 60rem;
  margin: 0 auto;
  padding: var(--space-4);
  color: var(--text);
}

.lead {
  margin: 0 0 var(--space-4);
}

h2 {
  margin: var(--space-3) 0 var(--space-2);
  font-size: 1rem;
}

ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.journal {
  margin: 0 0 var(--space-4);
}

.journal-rows {
  display: block;
  margin-top: var(--space-2);
}

button,
a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid currentcolor;
  border-radius: var(--radius);
  color: inherit;
  font-family: monospace;
  background: transparent;
}
</style>
