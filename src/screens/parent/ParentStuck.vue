<script setup lang="ts">
/**
 * Игроки и клуб, которые не открываются (063-Р65, Р66): строка «<Имя> — не открывается» с действиями — «Загрузить файл» (выбор файла в блоке «Файл сохранения»,
 * событие `load`) и «Начать заново» / «Новый клуб» (шаг-подтверждение того же вида, что «Удалить игрока?»: фокус на «Отмена», Esc закрывает и возвращает фокус).
 * Что показывать и чем отвечать на отказ — `engine/parent/repair.ts`; запись — `session.bin` (замки и отказы там). Успех — `changed` (страница перечитывает диск) и `say` (заметка).
 */
import { nextTick, ref, watch } from 'vue';
import { useSession } from '../../app/save/session';
import KeyButton from '../../components/kit/KeyButton.vue';
import { repairNoteKey, type TroubleRow } from '../../engine/parent/repair';
import { ru } from '../../i18n/ru';

defineProps<{ rows: readonly TroubleRow[] }>();
const emit = defineEmits<{ load: []; changed: []; say: [text: string] }>();

const session = useSession();
const p = ru.parent;
const s = p.players.stuck;
const day = (): string => new Date().toLocaleDateString('sv-SE');
const keyOf = (r: TroubleRow): string => r.pid ?? 'device';
const nameOf = (r: TroubleRow): string => r.name ?? ru.start.lost.player;

/** Открытый шаг: игрок (`row` с `pid`) или устройство (`pid` — `null`). */
const asked = ref<TroubleRow | null>(null);
const working = ref(false);
const root = ref<HTMLElement | null>(null);
let opener = '';

// Шаг открылся — фокус на «Отмена» (Enter не должен стирать); закрылся — фокус на кнопку, открывшую его.
watch(asked, async (row, was) => {
  await nextTick();
  if (row) {
    opener = keyOf(row);
    root.value?.querySelector<HTMLElement>('[role="alertdialog"] [data-cancel]')?.focus();
  } else if (was) root.value?.querySelector<HTMLElement>(`[data-opens="${opener}"]`)?.focus();
});

const close = (): void => {
  asked.value = null;
};

async function go(): Promise<void> {
  const row = asked.value;
  if (!row || working.value) return; // двойной клик: вторая запись не стартует
  working.value = true;
  const done = row.pid === null ? await session.bin.newClub(day()) : await session.bin.restart(row.pid, nameOf(row));
  working.value = false;
  asked.value = null;
  if (done.ok) {
    emit('say', row.pid === null ? s.newClubDone : `${nameOf(row)} ${s.restarted}`);
    emit('changed');
    return;
  }
  const key = repairNoteKey(done.why);
  emit('say', key === 'busy' ? `${nameOf(row)} ${ru.frame.notice.busyTail}` : key === 'conflict' ? p.players.conflict : key === 'readonly' ? p.players.readonly : s[key]);
  emit('changed'); // отказ мог прийти от устаревшей страницы — диск перечитываем
}
</script>

<template>
  <div
    ref="root"
    @keydown.esc="close"
  >
    <template
      v-for="r in rows"
      :key="keyOf(r)"
    >
      <p
        class="pa-note"
        role="status"
      >
        <template v-if="r.pid !== null">
          {{ nameOf(r) }} — {{ r.kind === 'binned' ? s.inBin : s.tail }}
        </template>
        <template v-else-if="r.kind === 'broken' || r.kind === 'denied'">
          {{ s.device }}
        </template>
        <small v-if="r.kind === 'newer'">{{ ru.frame.notice.readonly }}</small>
        <small v-else-if="r.kind === 'denied'">{{ r.pid === null ? s.deviceDenied : s.noAccess }}</small>
      </p>
      <div
        v-if="r.actions.length > 0"
        class="pa-row"
      >
        <KeyButton
          v-if="r.actions.includes('load')"
          md
          quiet
          @click="emit('load')"
        >
          {{ p.file.load }}
        </KeyButton>
        <KeyButton
          v-if="r.actions.includes('restart') || r.actions.includes('newClub')"
          md
          quiet
          class="pa-redline"
          :data-opens="keyOf(r)"
          @click="asked = r"
        >
          {{ r.pid === null ? s.newClub : s.restart }}
        </KeyButton>
      </div>
    </template>
    <div
      v-if="asked"
      class="pa-flow"
      role="alertdialog"
    >
      <template v-if="asked.pid !== null">
        <h3>{{ s.restartAsk }} {{ nameOf(asked) }}?</h3>
        <p>{{ s.keep }}</p>
      </template>
      <template v-else>
        <h3>{{ s.newClubTitle }}</h3>
        <p>{{ s.keep }} {{ s.newClubTail }}</p>
      </template>
      <div class="pa-row">
        <KeyButton
          md
          class="pa-red"
          @click="go"
        >
          {{ asked.pid === null ? s.newClub : s.restart }}
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
  </div>
</template>
