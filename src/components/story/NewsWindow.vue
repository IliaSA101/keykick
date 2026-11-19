<script setup lang="ts">
/**
 * Окно выпуска газеты (068 Т7, Э6.01–Э6.11): стенд под строкой меню, на нём лист (`NewsSheet`), кнопка закрытия — на полочке под листом.
 * Enter и Esc закрывают окно (`close`); `foot="home"` — выпуск вместо полосы в итоге дня (Э6.12): рядом с «В Дом · Enter» кнопка «Ещё матч» (`more`; подпись можно заменить `moreLabel` — «На карту» у Кубка); Enter — не раньше паузы после открытия (двойной Enter прошлого окна не пролетает). `back` — куда ведёт
 * закрытие: на подписи «Дом · Esc» или «Музей · Esc»; `archive` — выпуск из архива Музея: внизу листа строка про архив вместо «Дальше».
 * Показывает хозяин (Дом — по очереди входа, Музей — по полке, стенд кадров — из фикстуры); сам ничего не читает и не пишет.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { storyArtUrl } from '../../app/art/storyArt';
import type { PaperView } from '../../app/story/paperView';
import { ru } from '../../i18n/ru';
import { useStageWidth } from '../home/useStageWidth';
import { isNarrowStage } from '../shell/stageScale';
import KeyButton from '../kit/KeyButton.vue';
import NewsSheet from './NewsSheet.vue';
import { newsFoot, newsKey } from './news';

const props = defineProps<{ view: PaperView; back: 'home' | 'museum'; color: string; archive?: boolean; foot?: 'close' | 'home'; moreLabel?: string }>();
const emit = defineEmits<{ close: []; more: [] }>();

const width = useStageWidth();
const wide = computed(() => !isNarrowStage(width.value));
const sheet = computed<PaperView>(() => (props.archive === true ? { ...props.view, next: ru.story.paper.next.archive } : props.view));
const btns = computed(() => {
  const f = newsFoot(props.foot ?? 'close', props.back);
  return f.more !== null && props.moreLabel !== undefined ? { ...f, more: props.moreLabel } : f;
});
const openedAt = globalThis.performance.now();

function onKey(e: KeyboardEvent): void {
  if (newsKey({ key: e.key, repeat: e.repeat, openedAt, now: e.timeStamp }) === null) {
    if (e.key === 'Enter') e.preventDefault(); // слишком рано или удержание: и кнопка Enter не получает
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  emit('close');
}
onMounted(() => globalThis.addEventListener('keydown', onKey, true));
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey, true));
</script>

<template>
  <div
    class="nw"
    :class="wide ? 'wide' : 'narrow'"
    role="dialog"
    aria-modal="true"
    :aria-label="view.head"
  >
    <div
      class="nw-stand"
      :style="{ '--u-stand': `url(${storyArtUrl('storyPaperStandV21920')})` }"
    >
      <NewsSheet
        :view="sheet"
        :wide="wide"
        :color="color"
      />
    </div>
    <div class="nw-shelf">
      <KeyButton
        v-if="btns.more !== null"
        md
        @click="emit('more')"
      >
        {{ btns.more }}
      </KeyButton>
      <KeyButton
        md
        :primary="btns.sub !== null"
        v-bind="btns.sub === null ? {} : { sub: btns.sub }"
        @click="emit('close')"
      >
        {{ btns.main }}
      </KeyButton>
    </div>
  </div>
</template>
