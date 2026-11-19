<script setup lang="ts">
/**
 * Панель комикса (068 Т7, Э6.14–.21): кадр на всю панель в чёрной рамке, поверх — табло группы кодом, пузырь героя, плашка рассказчика
 * с портретом тренера и печать «САША 7». Закрытая панель (`empty`) — та же рамка, заливка краской, без содержимого. Всё содержимое — готовый
 * вид (`comicView`); здесь только вёрстка. Стили — `comic.css`.
 */
import { computed } from 'vue';
import { storyArtUrl } from '../../app/art/storyArt';
import type { ComicPanel, ComicView } from '../../app/story/comicView';
import { nbText } from './news';
import './comic.css';

const props = defineProps<{ panel: ComicPanel; print: ComicView['print']; coach: string; empty?: boolean }>();
const bubbleStyle = computed(() => {
  const b = props.panel.bubble;
  if (b === undefined) return undefined;
  return { '--tx': `${(b.at[0] * 100).toFixed(1)}cqw`, '--w': `${b.w}px`, '--sh': `${b.sh}px`, bottom: `calc(${((1 - b.at[1]) * 100).toFixed(1)}% + 14px)` };
});
const u = (k: Parameters<typeof storyArtUrl>[0]): string => `url(${storyArtUrl(k)})`;
const paper = computed(() => ({
  '--np-c': '18px',
  '--u-fold': u('storyPaperNewsprintFold'), '--u-tl': u('storyPaperNewsprintTl'), '--u-tr': u('storyPaperNewsprintTr'), '--u-bl': u('storyPaperNewsprintBl'), '--u-br': u('storyPaperNewsprintBr'),
  '--u-t': u('storyPaperNewsprintT'), '--u-b': u('storyPaperNewsprintB'), '--u-l': u('storyPaperNewsprintL'), '--u-r': u('storyPaperNewsprintR'), '--u-mid': u('storyPaperNewsprintMid'),
}));
</script>

<template>
  <div
    class="st-pan"
    :class="{ empty }"
  >
    <div
      v-if="!empty"
      class="st-art"
      :class="{ photo: true, key: panel.key, 'st-tabloart': panel.table !== undefined }"
    >
      <img
        class="st-img"
        :src="storyArtUrl(panel.art)"
        alt=""
      >
      <article
        v-if="panel.table"
        class="st-tablo kk-newsprint"
        :style="paper"
      >
        <h4>{{ panel.table.head }}</h4>
        <ol>
          <li
            v-for="r in panel.table.rows"
            :key="r.place"
            :class="{ our: r.our }"
          >
            <span>{{ r.place }}</span><b>{{ r.name }}</b><em>{{ r.pts }}</em>
          </li>
        </ol>
      </article>
      <div
        v-if="panel.narrator"
        class="st-nar"
        :class="panel.narrator.pos"
      >
        <img
          class="st-nar-ava"
          :src="coach"
          alt=""
        ><p>{{ nbText(panel.narrator.text) }}</p>
      </div>
      <p
        v-if="panel.bubble"
        class="st-bub down at"
        :style="bubbleStyle"
      >
        {{ nbText(panel.bubble.text) }}
      </p>
      <span
        v-if="panel.print === 'shirt' && print.name !== ''"
        class="st-shirt"
      ><b>{{ print.name }}</b><i v-if="print.num > 0">{{ print.num }}</i></span>
      <span
        v-else-if="panel.print === 'back' && print.name !== ''"
        class="st-backprint"
      ><b>{{ print.name }}</b><i v-if="print.num > 0">{{ print.num }}</i></span>
    </div>
  </div>
</template>
