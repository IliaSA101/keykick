<script setup lang="ts">
/**
 * Окно комикса Двора на Доме (068 Т7, Э6.14–.21, 050-Р2, Р3): заголовок, две панели в белой рамке (боковая уже, ключевая шире), точки хода и «Дальше · Enter»,
 * «Пропустить · Esc» справа вверху. Enter и → — открыть панель 2, потом закрыть; Esc — закрыть сразу (`comicKey`). Enter — не раньше паузы после открытия
 * (двойной Enter не пролетает). Показывает хозяин (Дом — по очереди входа, стенд кадров — из фикстуры); сам ничего не читает и не пишет.
 * `panel` — сколько панелей открыто при показе (стенд кадра «панель 1, вторая закрыта»); в игре — с первой.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ComicView } from '../../app/story/comicView';
import { ru } from '../../i18n/ru';
import { useStageWidth } from '../home/useStageWidth';
import { isNarrowStage } from '../shell/stageScale';
import KeyButton from '../kit/KeyButton.vue';
import KitModal from '../panel/KitModal.vue';
import { coachPortrait } from '../club/coachArt';
import ComicPanel from './ComicPanel.vue';
import { comicKey, PANELS } from './comic';

const props = withDefaults(defineProps<{ view: ComicView; /** Id тренера: портрет в плашке рассказчика. */ coach: string; panel?: number }>(), { panel: 1 });
const emit = defineEmits<{ close: [] }>();

const width = useStageWidth();
const portrait = computed(() => coachPortrait(props.coach));
const W = computed(() => (isNarrowStage(width.value) ? 960 : 900));
const shown = ref(Math.min(Math.max(props.panel, 1), PANELS));
const openedAt = globalThis.performance.now();

function next(): void {
  if (shown.value >= PANELS) emit('close');
  else shown.value += 1;
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Tab') return; // обход кнопок — у KitModal
  if (e.key === 'Enter' && e.target instanceof HTMLButtonElement && !e.target.classList.contains('primary')) return; // Tab на «Пропустить» — Enter жмёт её сам
  const act = comicKey({ key: e.key, repeat: e.repeat, openedAt, now: e.timeStamp, shown: shown.value });
  if (act === null) {
    if (e.key === 'Enter') e.preventDefault(); // слишком рано или удержание: и кнопка Enter не получает
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  if (act === 'close') emit('close');
  else next();
}
onMounted(() => globalThis.addEventListener('keydown', onKey, true));
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey, true));
</script>

<template>
  <KitModal
    class="st-cwin"
    :title="view.title"
    left
    :width="W"
    :top="64"
    :esc-close="false"
  >
    <template #head>
      <KeyButton
        quiet
        md
        :sub="ru.kit.esc"
        @click="emit('close')"
      >
        {{ ru.kit.skip }}
      </KeyButton>
    </template>
    <div class="st-strip">
      <ComicPanel
        v-for="(p, i) in view.panels"
        :key="i"
        :panel="p"
        :print="view.print"
        :coach="portrait"
        :empty="i >= shown"
      />
    </div>
    <template #buttons>
      <span class="st-dots">
        <i
          v-for="n in 2"
          :key="n"
          :class="{ on: n <= shown }"
        />
      </span>
      <KeyButton
        primary
        md
        :sub="ru.kit.enter"
        @click="next"
      >
        {{ ru.result.next }}
      </KeyButton>
    </template>
  </KitModal>
</template>
