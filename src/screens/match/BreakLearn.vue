<script setup lang="ts">
/**
 * Учебная игра над перерывом матча (067 Т17, этап 6; временная обвязка — сцену перерыва делает Т18): окно игры и строка
 * «итог не записан», если `session.save` отказал. Состояние — `useBreakLearn` (экран матча), здесь только показ.
 */
import { computed } from 'vue';
import type { BreakEntry } from '../../app/learn/entry';
import type { CommitDeps } from '../../app/learn/run';
import type { Status } from '../../app/save/session';
import type { EndModel } from '../../app/learn/view';
import type { RightsCard } from '../../engine/learn/steps';
import LearnWindow from '../../components/learn/LearnWindow.vue';
import { gameName } from '../../app/learn/view';
import { ru } from '../../i18n/ru';

const props = defineProps<{ entry: BreakEntry; deps: CommitDeps; fail: Status | null; kitBody: string; rivalBody: string; layout: string }>();
const emit = defineEmits<{ close: []; second: []; next: [id: string]; again: []; done: [game: string, r: { end: EndModel; rights: RightsCard | null }] }>();

const notice = ru.frame.notice as unknown as Record<string, string>;
/** «Ещё игра» — только если есть следующая; без неё окно само предлагает «Ещё раз». */
const more = computed(() => (props.entry.nextId === null ? {} : { nextId: props.entry.nextId, nextName: gameName(props.entry.nextId) }));
/** Причина отказа записи — словами сеанса: другая вкладка, новая версия, нет места. */
const why = computed(() => (props.fail === null ? '' : props.fail === 'busy' ? ru.frame.notice.busyAnon : (notice[props.fail] ?? '')));
</script>

<template>
  <LearnWindow
    :key="`${entry.flow.game}-${entry.flow.seed}`"
    :flow="entry.flow"
    :before="entry.before"
    :deps="deps"
    :kit-body="kitBody"
    :rival-body="rivalBody"
    :layout="layout"
    :stake="entry.stake"
    v-bind="more"
    @close="emit('close')"
    @second="emit('second')"
    @next="(id) => emit('next', id)"
    @again="emit('again')"
    @done="(r) => emit('done', entry.flow.game, r)"
  />
  <p
    v-if="fail !== null"
    class="fail"
    role="alert"
  >
    {{ ru.learn.end.saveFail }} {{ why }}
  </p>
</template>

<style scoped>
.fail { position: absolute; top: 608px; left: 50%; margin: 0 0 0 -450px; width: 900px; text-align: center; font-size: 17px; font-weight: 800; color: var(--text); }
</style>
