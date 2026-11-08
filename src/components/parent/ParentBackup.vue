<script setup lang="ts">
/*
 * Страница родителя: файл сохранения (спека 014-Т6, design §8). «Сохранить файл» отдаёт выгрузку и помнит время;
 * «Загрузить файл» читает файл, показывает превью в две колонки «сейчас / в файле» и только после подтверждения
 * пишет. Итог: успех или частичный (Р11) — страница ВСЕГДА перезагружается, итог ждёт её в sessionStorage
 * (Р13); отказ — остаётся на месте. Строки беды: переполнение, найденное при запуске, режим v1.
 * Ничего не пишет сам: зовёт app/save/backup; разбор превью и итога — чистые функции engine/save/backupView.
 */
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { players } from '../../app/players/list';
import { applyBackup, downloadBackup, lastBackupAt, readBackupFile, saveInfo, type Prepared } from '../../app/save/backup';
import { createReloadPlan } from '../../app/save/reloadPlan';
import { localDay } from '../../app/session';
import { tabFlag } from '../../app/storage';
import {
  backupAge,
  canLoad,
  decodeReport,
  encodeReport,
  fileDateText,
  foundNames,
  needsReload,
  previewRows,
  reportApply,
  type ApplyReport,
} from '../../engine/save/backupView';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import ParentBackupPreview from './ParentBackupPreview.vue';
import ParentBackupResult from './ParentBackupResult.vue';

/** Готовое состояние для витрины кадров (dev/BackupDemo.vue): без хранилища и без файла. В игре не передаётся. */
interface Demo {
  prepared?: Prepared;
  report?: ApplyReport;
  refusal?: keyof typeof ru.backup.reasons;
  saved?: { name: string; fromMemory: boolean } | 'failed';
  lastAt?: number | null;
  /** Режим v1, переполнение, имена игроков с найденной бедой, итог после перезагрузки. */
  v1?: boolean;
  storageFull?: boolean;
  found?: readonly string[];
  reloaded?: boolean;
}
const props = defineProps<{ demo?: Demo }>();
/** Загрузка записана или прервалась, страница вот-вот обновится: остальную страницу экран делает недоступной. */
const emit = defineEmits<{ waiting: [value: boolean] }>();

const t = ru.backup;

/** Пауза перед перезагрузкой после успеха: родитель успевает прочитать итог. */
const RELOAD_MS = 1500;
/** Сколько после паузы ждать слияние журнала из файла. */
const JOURNAL_WAIT_MS = 3000;

/** Ключ итога в sessionStorage вкладки (с префиксом сборки): `keykick.backup.report`. */
const REPORT_FLAG = 'backup.report';

const info = props.demo === undefined ? saveInfo() : { v1: props.demo.v1 === true, storageFull: props.demo.storageFull === true, found: {} };
const foundList =
  props.demo === undefined
    ? foundNames(info.found, (id) => players.players.find((p) => p.id === id)?.name ?? null)
    : (props.demo.found ?? []);

const lastAt = ref(props.demo === undefined ? lastBackupAt() : (props.demo.lastAt ?? null));
const lastText = computed(() => {
  const age = backupAge(lastAt.value, Date.now(), localDay);
  if (age.kind === 'never') return t.lastNever;
  if (age.kind === 'today') return t.lastToday;
  return `${t.lastDays} ${age.days} ${plural(age.days, t.daysAgo)}`;
});

// Выгрузка.
const saved = ref<{ name: string; fromMemory: boolean } | 'failed' | null>(props.demo?.saved ?? null);
/** Файл собирается (ждём журнал игры до 3 с): вторая выгрузка не стартует, пока первая не закончила. */
const saving = ref(false);
async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    const r = await downloadBackup();
    lastAt.value = lastBackupAt();
    saved.value = { name: r.name, fromMemory: r.fromMemory.length > 0 };
  } catch {
    saved.value = 'failed';
  } finally {
    saving.value = false;
  }
}

// Загрузка: выбор файла → превью → подтверждение → итог.
const step = ref<'idle' | 'reading' | 'preview' | 'applying' | 'result'>(
  props.demo?.report !== undefined ? 'result' : props.demo?.prepared !== undefined ? 'preview' : 'idle',
);
const picker = ref<HTMLInputElement | null>(null);
const loadButton = ref<HTMLButtonElement | null>(null);
const preview = ref<InstanceType<typeof ParentBackupPreview> | null>(null);
// shallowRef: в `applyBackup` уходит сам файл, а не прокси Vue.
const prepared = shallowRef<Prepared | null>(props.demo?.prepared ?? null);
const refusal = ref<keyof typeof t.reasons | null>(props.demo?.refusal ?? null);
const report = ref<ApplyReport | null>(props.demo?.report ?? null);
/** Страница уже обновилась после загрузки, итог взят из sessionStorage. */
const reloaded = ref(props.demo?.reloaded === true);
/** Загрузка записана, страница вот-вот обновится: до тех пор новую загрузку не начинаем. */
const waiting = ref(false);
watch(waiting, (v) => emit('waiting', v));
/** Загрузка прервалась исключением: что записано — неизвестно, страница обновится и покажет, что получилось. */
const interrupted = ref(false);
/** План перезагрузки (014-Р13, 018-Р26): пауза 1,5 с, затем журнал ≤ 3 с; уход со страницы — сразу и без журнала. */
const reloadPlan = createReloadPlan({
  setTimer: (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimer: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
  reload: () => globalThis.location.reload(),
  clearReport: () => tabFlag(REPORT_FLAG, null),
  delayMs: RELOAD_MS,
  journalMaxMs: JOURNAL_WAIT_MS,
});

// Итог прошлой загрузки: ключ снимаем сразу, чтобы он показался один раз.
if (props.demo === undefined) {
  const back = decodeReport(tabFlag(REPORT_FLAG));
  tabFlag(REPORT_FLAG, null);
  if (back !== null) {
    report.value = back;
    reloaded.value = true;
    step.value = 'result';
  }
}

const rows = computed(() => (prepared.value === null ? [] : previewRows(prepared.value.entries)));
const loadable = computed(() => prepared.value !== null && canLoad(prepared.value.entries));
const fileDate = computed(() => (prepared.value === null ? '' : fileDateText(prepared.value.file.createdAt, localDay)));

function pick(): void {
  picker.value?.click();
}

async function onFile(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  // Тот же файл можно выбрать повторно: без сброса `change` не сработает.
  input.value = '';
  if (file === undefined || step.value === 'reading') return;
  step.value = 'reading';
  refusal.value = null;
  // Строка «Файл сохранён» к загрузке не относится — рядом с превью и отказом путала (014-Т7, тестировщик).
  saved.value = null;
  report.value = null;
  try {
    const r = await readBackupFile(file);
    if (!r.ok) {
      refusal.value = r.reason;
      step.value = 'idle';
      return;
    }
    prepared.value = r;
    step.value = 'preview';
    await nextTick();
    preview.value?.focusDefault();
  } catch {
    refusal.value = 'read';
    step.value = 'idle';
  }
}

/** Отмена и Esc: ничего не пишем, фокус — на «Загрузить файл». */
function cancel(): void {
  if (step.value !== 'preview') return;
  prepared.value = null;
  step.value = 'idle';
  void nextTick(() => loadButton.value?.focus());
}

function confirm(): void {
  // Двойной клик и Enter с повтором: вторая загрузка не начинается, пока первая не закончена.
  if (step.value !== 'preview' || prepared.value === null || !loadable.value || props.demo !== undefined) return;
  const file = prepared.value;
  let journalDone: Promise<number> | undefined;
  step.value = 'applying';
  try {
    const result = applyBackup(file);
    report.value = reportApply(result, file.entries);
    journalDone = 'journalDone' in result ? result.journalDone : undefined;
  } catch {
    // Исключение посреди записи: ни «отказ», ни «успех» сказать нельзя — состояние неизвестно, перезагружаем без итога.
    prepared.value = null;
    interrupted.value = true;
    step.value = 'result';
    waiting.value = true;
    reloadPlan.schedule();
    return;
  }
  prepared.value = null;
  step.value = 'result';
  if (needsReload(report.value)) {
    // Память страницы теперь старее хранилища: перезагрузка нужна всегда, и при частичном итоге (Р11).
    tabFlag(REPORT_FLAG, encodeReport(report.value));
    waiting.value = true;
    reloadPlan.schedule(journalDone);
  }
}

// Ушли со страницы, пока перезагрузка назначена: старая память затрёт загруженное — перезагружаем сразу, ключ итога снимаем.
onBeforeUnmount(() => reloadPlan.leave());
</script>

<template>
  <section class="block">
    <h2>{{ t.title }}</h2>
    <p class="muted">
      {{ t.lead }}
    </p>
    <p
      v-if="info.storageFull"
      class="note alarm"
      role="alert"
    >
      {{ t.storageFull }}
    </p>
    <p
      v-for="name in foundList"
      :key="name"
      class="note"
      role="status"
    >
      {{ t.foundBefore }} {{ name }} {{ t.foundAfter }}
    </p>
    <p
      v-if="!info.v1"
      class="last"
    >
      {{ lastText }}
    </p>
    <div class="row">
      <button
        type="button"
        class="btn"
        :disabled="saving"
        @click="save"
      >
        {{ t.save }}
      </button>
      <button
        ref="loadButton"
        type="button"
        class="btn"
        :disabled="info.v1 || waiting || step === 'reading' || step === 'preview' || step === 'applying'"
        @click="pick"
      >
        {{ t.load }}
      </button>
      <input
        ref="picker"
        type="file"
        accept=".json,application/json"
        hidden
        @change="onFile"
      >
    </div>
    <p class="muted">
      {{ info.v1 ? t.reasons.v1 : t.loadHint }}
    </p>

    <p
      v-if="saved === 'failed'"
      class="note"
      role="alert"
    >
      {{ t.saveFailed }}
    </p>
    <template v-else-if="saved !== null">
      <p
        class="note"
        role="status"
      >
        {{ t.saved }} {{ saved.name }}
      </p>
      <p
        v-if="saved.fromMemory"
        class="muted"
      >
        {{ t.savedFromMemory }}
      </p>
    </template>

    <p
      v-if="refusal !== null"
      class="note"
      role="alert"
    >
      {{ t.reasons[refusal] }}
    </p>

    <ParentBackupPreview
      v-if="step === 'preview' && prepared !== null"
      ref="preview"
      :rows="rows"
      :loadable="loadable"
      :file-date="fileDate"
      :app="prepared.file.app"
      @confirm="confirm"
      @cancel="cancel"
    />

    <p
      v-if="step === 'applying'"
      class="note"
      role="status"
    >
      {{ t.working }}
    </p>

    <p
      v-if="interrupted"
      class="note"
      role="alert"
    >
      {{ t.interrupted }}
    </p>

    <ParentBackupResult
      v-if="step === 'result' && report !== null"
      :report="report"
      :reloaded="reloaded"
    />
  </section>
</template>

<style scoped src="./paper.css"></style>
<style scoped>
.last {
  margin: var(--space-3) 0;
  font-weight: 700;
}
</style>
