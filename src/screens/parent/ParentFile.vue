<script setup lang="ts">
/**
 * Блок «Файл сохранения» страницы родителя (кадры Э6.47–48, 54): выгрузка клуба, загрузка файла с выбором при совпадении игрока («Что изменится»).
 * Страница только смотрит (063-Р59): числа и выгрузка — с диска, запись файла — `transfer.apply` со своими замками. Всё о сохранении — через `session.transfer`.
 * После выгрузки и записи блок говорит `changed` — страница перечитывает диск.
 */
import { onMounted, ref, watch } from 'vue';
import { useSession } from '../../app/save/session';
import { factLine, fileLine } from '../../components/club/restoreLines';
import KeyButton from '../../components/kit/KeyButton.vue';
import { badReason, restoreFile } from '../../engine/club/start';
import { changeRows, defaultPicks, type ChangeRow } from '../../engine/parent/progress';
import { binLeftNames } from '../../engine/parent/repair';
import type { ImportPlan } from '../../engine/save/import';
import type { Pick } from '../../engine/save/restore';
import { ru } from '../../i18n/ru';
import { saveFileNow } from './saveFile';
import { useParentStand } from './stand';

const props = defineProps<{ last: string; order: readonly string[] }>();
const emit = defineEmits<{ changed: [] }>();

const session = useSession();
const transfer = session.transfer;
const p = ru.parent;

// ---------- выгрузка ----------
const saveNote = ref<'' | 'saved' | 'fail'>('');
function saveFile(): void {
  saveNote.value = saveFileNow();
  emit('changed');
}

// ---------- загрузка ----------
type Phase = 'idle' | 'check' | 'bad' | 'newer' | 'over' | 'busy' | 'done' | 'fail' | 'refused' | 'newerHere' | 'conflict';
const phase = ref<Phase>('idle');
const busyWho = ref('');
const picker = ref<HTMLInputElement | null>(null);
/** Игроки, чей прежний конверт остался в корзине после загрузки (063-Р64): о каждом — своя строка. */
const binLeft = ref<string[]>([]);
const rows = ref<ChangeRow[]>([]);
const picks = ref<Record<string, Pick>>({});
const fileFrom = ref('');
let plan: ImportPlan | undefined;

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // тот же файл можно выбрать снова
  if (!file) return;
  check(await file.text().catch(() => ''));
}

/** Строки «Что изменится»: игроки из корзины помечены — в колонке «Сейчас» у них «в корзине». */
const rowsOf = (from: ImportPlan): ChangeRow[] =>
  changeRows(from, transfer.here().players, [...props.order], new Set(session.bin.list(new Date().toLocaleDateString('sv-SE')).map((e) => e.pid)));

/** Разбор текста файла: «Что изменится» или причина отказа. */
function check(text: string): void {
  plan = transfer.plan(text);
  if (plan.kind !== 'ok') {
    phase.value = badReason(plan);
    return;
  }
  if (plan.overLimit) {
    phase.value = 'over';
    return;
  }
  rows.value = rowsOf(plan);
  picks.value = defaultPicks(plan);
  fileFrom.value = fileLine(restoreFile(plan.file));
  phase.value = 'check';
}

// порядок уроков приходит по сети позже страницы: сводка уже открыта — строки «Урок N» дописываются
watch(
  () => props.order,
  () => {
    if (plan?.kind === 'ok' && phase.value === 'check') rows.value = rowsOf(plan);
  },
);

// стенд кадров (только в разработке, 065 К-Г): файл уже выбран — кадр «Что изменится»
const stand = useParentStand();
onMounted(() => {
  const text = stand().fileText;
  if (text) check(text);
});

/** Отказ записи → что сказать: нет места или доступа — «не записалось», клуб на компьютере новее игры — «обновите», остальное — «выберите файл снова». */
const REFUSAL = {
  quota: 'fail',
  denied: 'fail',
  readonly: 'newerHere',
  conflict: 'conflict',
  'over-limit': 'over',
  invalid: 'refused',
  'pick-missing': 'refused',
  'not-ok': 'refused',
} as const satisfies Record<Exclude<Extract<Awaited<ReturnType<typeof transfer.apply>>, { ok: false }>['why'], 'busy'>, Phase>;

async function load(): Promise<void> {
  if (phase.value !== 'check' || !plan) return;
  phase.value = 'idle'; // двойной клик: второй вызов уже не в «check»
  const done = await transfer.apply(plan, picks.value);
  binLeft.value = done.ok ? binLeftNames(done.binLeft, plan, ru.start.lost.player) : [];
  emit('changed');
  if (done.ok) phase.value = 'done';
  else if (done.why === 'busy') {
    busyWho.value = done.name;
    phase.value = 'busy';
  } else phase.value = REFUSAL[done.why];
}

const cancel = (): void => {
  plan = undefined;
  phase.value = 'idle';
};

/** Выбор файла — и из кнопки блока, и из строки «Загрузить файл» у игрока, который не открывается (063-Р65). */
defineExpose({ pick: (): void => picker.value?.click() });
</script>

<template>
  <section
    class="pa-blk"
    @keydown.esc="phase === 'check' && cancel()"
  >
    <h2>{{ p.file.title }}</h2>
    <p class="pa-hint">
      {{ p.file.lead }}
    </p>
    <p class="pa-last">
      {{ p.file.last }} {{ last }}
    </p>
    <div class="pa-row">
      <KeyButton
        md
        quiet
        @click="saveFile"
      >
        {{ p.file.save }}
      </KeyButton>
      <KeyButton
        md
        quiet
        @click="picker?.click()"
      >
        {{ p.file.load }}
      </KeyButton>
      <input
        ref="picker"
        class="pa-pick"
        type="file"
        accept=".json,application/json"
        @change="onFile"
      >
    </div>
    <p
      v-if="saveNote"
      class="pa-note"
      role="status"
    >
      {{ saveNote === 'saved' ? ru.system.again.saved : p.file.saveFail }}
    </p>
    <p class="pa-hint">
      {{ p.file.note }}
    </p>

    <div
      v-if="phase === 'check'"
      class="pa-prev"
    >
      <h3>{{ ru.start.lost.changes }}</h3>
      <p class="pa-hint">
        {{ fileFrom }}
      </p>
      <table class="pa-tbl">
        <thead>
          <tr>
            <th>{{ ru.start.lost.player }}</th><th>{{ ru.start.lost.now }}</th><th>{{ ru.start.lost.inFile }}</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="r in rows"
            :key="r.pid"
          >
            <tr>
              <th>{{ r.name }}</th>
              <td v-if="r.kind === 'new'">
                {{ r.binned ? p.file.inBin : ru.start.lost.none }}
              </td>
              <td v-else>
                {{ r.mine === null ? p.file.unreadable : factLine(r.mine) }}
              </td>
              <td v-if="r.kind === 'here'">
                {{ ru.start.lost.none }}<small>{{ p.file.notInFile }}</small>
              </td>
              <td v-else>
                {{ factLine(r.theirs) }}
              </td>
            </tr>
            <tr v-if="r.kind === 'clash'">
              <td colspan="3">
                <span
                  class="pa-picks"
                  role="radiogroup"
                  :aria-label="p.file.pickLabel"
                >
                  <label><input
                    v-model="picks[r.pid]"
                    type="radio"
                    :name="`pick-${r.pid}`"
                    value="mine"
                  >{{ p.file.pickMine }}</label>
                  <label><input
                    v-model="picks[r.pid]"
                    type="radio"
                    :name="`pick-${r.pid}`"
                    value="file"
                  >{{ p.file.pickFile }}</label>
                </span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div class="pa-row">
        <KeyButton
          md
          class="pa-red"
          @click="load"
        >
          {{ p.file.load2 }}
        </KeyButton>
        <KeyButton
          md
          quiet
          @click="cancel"
        >
          {{ ru.start.club.cancel }}
        </KeyButton>
      </div>
    </div>
    <p
      v-if="phase !== 'idle' && phase !== 'check'"
      class="pa-note"
      role="status"
    >
      <template v-if="phase === 'bad'">
        {{ ru.start.lost.badLead }}
      </template>
      <template v-else-if="phase === 'newer'">
        {{ ru.start.lost.newerLead }}
      </template>
      <template v-else-if="phase === 'over'">
        {{ p.file.overLimit }}
      </template>
      <template v-else-if="phase === 'busy'">
        {{ busyWho }} {{ ru.frame.notice.busyTail }}
      </template>
      <template v-else-if="phase === 'done'">
        {{ p.file.done }}
      </template>
      <template v-else-if="phase === 'newerHere'">
        {{ p.file.newerHere }}
      </template>
      <template v-else-if="phase === 'refused'">
        {{ p.file.refused }}
      </template>
      <template v-else-if="phase === 'conflict'">
        {{ p.file.conflict }}
      </template>
      <template v-else>
        {{ p.file.fail }}
      </template>
    </p>
    <p
      v-for="(n, i) in phase === 'done' ? binLeft : []"
      :key="i"
      class="pa-note"
      role="status"
    >
      {{ n }} {{ p.file.binLeft }}
    </p>
  </section>
</template>
