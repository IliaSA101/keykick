<script setup lang="ts">
/*
 * Витрина блока «Файл сохранения» (спека 014-Т6, только dev-сборка):
 *   #/dev/backup?state=idle|never|saved|saved-memory|save-failed|preview|preview-broken|nothing|done|done-reloaded|
 *   partial|partial-reloaded|refused|newer|full|found|v1|copies
 * Блок получает готовое состояние, хранилища и файла не нужно; «Загрузить» в витрине холостое.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ParentBackup from '../components/parent/ParentBackup.vue';
import ParentCopies from '../components/parent/ParentCopies.vue';
import type { Prepared } from '../app/save/backup';
import type { BackupFile, PreviewEntry } from '../engine/save/backup';
import type { ApplyReport } from '../engine/save/backupView';
import { dev } from '../i18n/ru/dev';

const route = useRoute();
// Адрес меняется без перезагрузки страницы (стрелки «назад/вперёд»): состояние следует за ним.
const state = computed(() => (typeof route.query.state === 'string' ? route.query.state : 'idle'));
const AT = 1_800_000_000_000;
const [anya, borya, vera] = dev.backupNames;

const entry = (id: string, name: string, now: boolean, broken = false): PreviewEntry => ({
  id,
  nameNow: now ? name : null,
  nameInFile: name,
  status: broken ? 'broken' : 'ok',
  sections: broken ? null : {},
  now: now ? { lesson: 4, coins: 120, lastDay: '2026-11-01' } : null,
  inFile: broken ? null : { lesson: 9, coins: 340, lastDay: '2026-11-07' },
});

function prepared(entries: PreviewEntry[]): Prepared {
  return { file: { app: '0.10.1', createdAt: AT } as BackupFile, entries };
}

const two = [entry('p1', anya, true), entry('p2', borya, false)];
const done: ApplyReport = { kind: 'done', loaded: [anya, borya], skipped: [] };
const partial: ApplyReport = { kind: 'partial', loaded: [anya], lost: [borya, vera], skipped: [], reason: 'no-space' };

const demos = {
  idle: {},
  never: { lastAt: null },
  saved: { lastAt: Date.now(), saved: { name: 'keykick-2026-11-08-0.10.1.json', fromMemory: false } },
  'saved-memory': { lastAt: Date.now(), saved: { name: 'keykick-2026-11-08-0.10.1.json', fromMemory: true } },
  'save-failed': { saved: 'failed' as const },
  preview: { prepared: prepared(two) },
  'preview-broken': { prepared: prepared([entry('p1', anya, true), entry('p2', borya, true, true), entry('p3', vera, false)]) },
  nothing: { prepared: prepared([entry('p2', borya, true, true)]) },
  done: { report: done },
  'done-reloaded': { report: done, reloaded: true },
  partial: { report: partial },
  'partial-reloaded': { report: partial, reloaded: true },
  refused: { report: { kind: 'refused', reason: 'no-space' } as ApplyReport },
  newer: { refusal: 'newer' as const },
  full: { storageFull: true, lastAt: Date.now() },
  found: { found: [anya, borya], lastAt: Date.now() },
  v1: { v1: true },
  copies: {},
} as const;
type Name = keyof typeof demos;
const demo = computed(() => demos[(state.value in demos ? state.value : 'idle') as Name]);

/** Имена копий для витрины: снимки двух игроков, копии «до …», карантин и игрок, которого уже нет. */
const copyDemo = {
  names: [
    'snap.p1.2026-11-08',
    'snap.p1.2026-11-07',
    'pre.p1.import.1794000000000',
    'pre.p1.migrate.f1',
    'snap.p2.2026-11-06',
    'quarantine.p2.1793000000000',
    'pre.p9.delete.1792000000000',
  ],
  nameOf: { p1: anya, p2: borya },
};
</script>

<template>
  <section class="paper">
    <ParentCopies
      v-if="state === 'copies'"
      :demo="copyDemo"
    />
    <ParentBackup
      v-else
      :key="state"
      :demo="demo"
    />
  </section>
</template>

<style scoped>
.paper {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-5);
  border-radius: 16px;
  background: var(--paper);
  color: var(--paper-text);
  color-scheme: light;
}
</style>
