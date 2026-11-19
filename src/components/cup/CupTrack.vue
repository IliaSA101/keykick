<script setup lang="ts">
/** Дорожка «дальше: 1/8 → 1/4 → 1/2 → финал» с кубком на конце; подсвечена до раунда, к которому вышли (макет `track`). Позиция — снизу поля, левее мяча. */
import { computed } from 'vue';
import { storyArtUrl } from '../../app/art/storyArt';
import { fill } from '../../app/home/texts';
import type { TrackNode } from '../../app/cup/groupView';
import { ru } from '../../i18n/ru';
import type { CupGeo } from './cupGeo';

const props = defineProps<{ nodes: TrackNode[]; geo: CupGeo; narrow: boolean }>();
const t = ru.cup.screen;
/** Высота: под таблицей и панелью, кубок целиком внутри рамки; на узкой сцене ниже и сдвинута вниз — карточки F–H не под ней. */
const th = computed(() => Math.round(Math.min(props.narrow ? 58 : 52, props.geo.h - 308)) - (props.narrow ? 4 : 0));
const style = computed(() => ({ right: `${props.geo.ball.toFixed(0)}px`, top: `${(props.geo.h - th.value + (props.narrow ? 8 : 0)).toFixed(0)}px`, height: `${th.value}px` }));
const cupH = computed(() => th.value - 10);
</script>

<template>
  <div
    class="ch-trk"
    :style="style"
  >
    <span class="ch-tl">{{ t.trackLead }}</span>
    <template
      v-for="(n, i) in nodes"
      :key="n.name"
    >
      <span
        class="ch-node"
        :class="{ lit: n.lit }"
      ><i /><b>{{ n.name }}</b><small>{{ fill(t.colAfter, { n: n.after }) }}</small></span>
      <s
        v-if="i < nodes.length - 1"
        class="ch-seg"
        :class="{ lit: n.seg }"
      />
    </template>
    <s class="ch-seg to" />
    <img
      class="ch-tcup"
      :src="storyArtUrl('cupCup')"
      alt=""
      :width="Math.round((cupH * 499) / 640)"
      :height="cupH"
    >
  </div>
</template>
