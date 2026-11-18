<script setup lang="ts">
/**
 * Блок «Игроки»: корзина (063 Т12, кадры Э6.89–96, 064 §3.5, 063-Р62). «Удалить игрока» — в корзину, «Вернуть» — назад, «Очистить корзину» —
 * удаление данных вводом имени. Запись — `session.bin` (замки и отказы там); у последнего игрока «Удалить» нет. Esc закрывает окно шага.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { saveOnePlayerFile } from '../../app/save/exportFile';
import { useSession } from '../../app/save/session';
import KeyButton from '../../components/kit/KeyButton.vue';
import { binNoteKey, clearTyped } from '../../engine/parent/progress';
import type { TroubleRow } from '../../engine/parent/repair';
import { clearPhrase, type BinEntry } from '../../engine/save/bin';
import { ru } from '../../i18n/ru';
import ParentStuck from './ParentStuck.vue';
import { useParentStand } from './stand';

/**
 * Игрок, которого показывает страница (вкладка); `deletable` — «Удалить» разрешено (`canDelete(устройство)`, считает страница: последнего игрока не удалить);
 * `rev` — страница перечитала диск (например, после «Загрузить» файл): корзина и открытый шаг перечитываются сразу (063-Р66).
 * `stuck` — игроки, которых не открыть (063-Р65): строки с «Загрузить файл» и «Начать заново» (`ParentStuck`); `load` — выбрать файл (его принимает блок «Файл сохранения»).
 * Игрока вкладки может не быть (все битые): тогда `pid` пуст, а «Удалить» страница не разрешает.
 */
const props = defineProps<{ pid: string; name: string; deletable: boolean; stuck: readonly TroubleRow[]; rev?: number }>();
/** `act` — в блоке сделали действие: заметка устройства со страницы («Новый клуб создан…») устарела и сбрасывается. */
const emit = defineEmits<{ changed: []; load: []; act: [] }>();

const session = useSession();
const p = ru.parent;
const day = (): string => new Date().toLocaleDateString('sv-SE');
type Step = 'idle' | 'ask' | 'clear';
const step = ref<Step>('idle');
const typed = ref('');
const entries = ref<BinEntry[]>([]);
const note = ref('');
const working = ref(false);

// Шаг открылся — фокус на «Отмена» (063-Р66: Enter не должен удалять; Esc ловит блок, пока фокус в нём; в Safari кнопка после клика фокус не берёт);
// шаг закрылся — фокус возвращается на кнопку, открывшую его (`data-opens`).
const root = ref<HTMLElement | null>(null);
let opener: Step = 'idle';
watch(step, async (s, was) => {
  await nextTick();
  if (s !== 'idle') {
    opener = s;
    root.value?.querySelector<HTMLElement>('[role="alertdialog"] [data-cancel]')?.focus();
  } else if (was !== 'idle') root.value?.querySelector<HTMLElement>(`[data-opens="${opener}"]`)?.focus();
});

const stand = useParentStand();
const list = (): void => {
  entries.value = session.bin.list(day());
};
const reload = (): void => {
  list();
  emit('changed');
};
// страница перечитала диск: корзина — заново; нечего очищать — окно «Очистить корзину» закрывается
watch(
  () => props.rev,
  () => {
    list();
    if (entries.value.length === 0 && step.value === 'clear') close();
  },
);
onMounted(() => {
  session.bin.settle(day()); // оборванное удаление (перезагрузка посреди): игрок в корзине, а в списке ещё есть
  reload();
  // стенд кадров (только в разработке): открытый шаг блока; «back» — «Вернуть» уже нажато
  const want = stand().step;
  if (want === 'ask') step.value = 'ask';
  if (want === 'clear' && entries.value.length > 0) {
    step.value = 'clear';
    typed.value = phrase.value;
  }
  if (want === 'back' && entries.value[0]) restore(entries.value[0]);
});

/** Блок пуст — единственный игрок и корзина пуста (удалять нечего, возвращать нечего): заголовок без текста не показываем (Э6.47 блока без содержимого не знает). */
const shown = computed(() => props.deletable || props.stuck.length > 0 || entries.value.length > 0 || step.value !== 'idle' || note.value !== '');
const phrase = computed(() => clearPhrase(entries.value));
const ready = computed(() => clearTyped(entries.value.map((e) => e.name ?? e.pid), typed.value));
const dateOf = (e: BinEntry): string => (e.day === null ? '' : `— ${e.day.slice(8)}.${e.day.slice(5, 7)}`);

const say = (why: string, name?: string): void => {
  const key = binNoteKey(why);
  note.value = why === 'busy' ? `${name ?? ''} ${ru.frame.notice.busyTail}` : key === 'fail' ? p.file.fail : p.players[key];
};

async function remove(): Promise<void> {
  if (working.value) return; // двойной клик: второе удаление не стартует
  emit('act');
  working.value = true;
  const done = await session.bin.remove(props.pid, day());
  working.value = false;
  step.value = 'idle';
  note.value = done.ok ? '' : (say(done.why, done.name), note.value);
  reload();
}
function restore(e: BinEntry): void {
  emit('act');
  const done = session.bin.restore(e.pid);
  note.value = done.ok ? `${e.name ?? e.pid} ${p.players.back}` : (say(done.why), note.value);
  reload();
}
function clear(): void {
  emit('act');
  // порядок имён не важен (clearTyped); хранилище ждёт имена в порядке заголовка — отдаём ему эту фразу
  const done = session.bin.empty(ready.value ? phrase.value : typed.value);
  step.value = 'idle';
  typed.value = '';
  note.value = done.ok ? p.players.gone : (say(done.why), note.value);
  reload();
}
function download(): void {
  emit('act');
  const saved = saveOnePlayerFile(session, props.pid, new Date(), globalThis.location.origin + globalThis.location.pathname);
  note.value = saved ? '' : p.file.saveFail;
}
const close = (): void => {
  step.value = 'idle';
  typed.value = '';
};
</script>

<template>
  <section
    v-show="shown"
    id="pa-players"
    ref="root"
    class="pa-blk"
    @keydown.esc="close"
  >
    <h2>{{ p.players.title }}</h2>
    <ParentStuck
      :rows="stuck"
      @load="emit('load')"
      @changed="reload"
      @say="(text) => { emit('act'); note = text; }"
    />
    <div
      v-if="props.deletable"
      class="pa-row"
    >
      <KeyButton
        md
        quiet
        data-opens="ask"
        @click="step = 'ask'"
      >
        {{ p.players.delete }}
      </KeyButton>
    </div>
    <div
      v-if="step === 'ask'"
      class="pa-flow"
      role="alertdialog"
    >
      <h3>{{ p.players.delete }} {{ name }}?</h3>
      <p>{{ name }} {{ p.players.askTail }}</p>
      <p class="pa-hint">
        {{ p.players.tip }}
      </p>
      <div class="pa-row">
        <KeyButton
          md
          class="pa-red"
          @click="remove"
        >
          {{ p.players.confirm }}
        </KeyButton>
        <KeyButton
          md
          quiet
          @click="download"
        >
          {{ p.players.download }} {{ name }}
        </KeyButton>
        <KeyButton
          md
          quiet
          data-cancel
          @click="close"
        >
          {{ ru.start.club.cancel }}
        </KeyButton>
      </div>
    </div>

    <template v-if="entries.length > 0">
      <p
        v-for="e in entries"
        :key="e.pid"
        class="pa-note pa-bin"
      >
        <b>{{ p.players.bin }}</b> {{ e.name ?? e.pid }} {{ dateOf(e) }}
        <KeyButton
          md
          quiet
          @click="restore(e)"
        >
          {{ p.players.restore }}
        </KeyButton>
      </p>
      <div class="pa-row">
        <KeyButton
          md
          quiet
          class="pa-redline"
          data-opens="clear"
          @click="step = 'clear'"
        >
          {{ p.players.clear }}
        </KeyButton>
      </div>
    </template>
    <div
      v-if="step === 'clear' && entries.length > 0"
      class="pa-flow"
      role="alertdialog"
    >
      <h3>{{ p.players.clearTitle }} {{ phrase }}</h3>
      <p><b>{{ p.players.clearBold }}</b> {{ p.players.clearTail }}</p>
      <label class="pa-fld"><span class="pa-hint">{{ p.players.clearLabel }}</span>
        <input
          v-model="typed"
          type="text"
          autocomplete="off"
          @keydown.enter="ready && clear()"
        ></label>
      <div class="pa-row">
        <KeyButton
          md
          class="pa-red"
          :state="ready ? undefined : 'off'"
          @click="clear"
        >
          {{ p.players.clear }}
        </KeyButton>
        <KeyButton
          md
          quiet
          data-cancel
          @click="close"
        >
          {{ ru.start.club.cancel }}
        </KeyButton>
      </div>
    </div>
    <p
      v-if="note"
      class="pa-note"
      role="status"
    >
      {{ note }}
    </p>
  </section>
</template>
