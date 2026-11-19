<script setup lang="ts">
/** Таблица нашей группы (Э5.01–.08, `groupTable` макета e5-group.mjs): место, команда с эмблемой, три окошка туров, очки. Ничего не считает — строки готовит `app/cup/groupView`. */
import { storyArtUrl } from '../../app/art/storyArt';
import { fill } from '../../app/home/texts';
import type { GroupRow } from '../../app/cup/groupView';
import { ru } from '../../i18n/ru';

defineProps<{ rows: GroupRow[]; after: number[] }>();
const t = ru.cup.screen;
</script>

<template>
  <div class="ch-tbl">
    <div class="ch-th">
      <span /><span class="l">{{ t.colTeam }}</span>
      <span
        v-for="n in after"
        :key="n"
      >{{ fill(t.colAfter, { n }) }}</span>
      <span>{{ t.colPts }}</span>
    </div>
    <div
      v-for="r in rows"
      :key="r.name"
      class="ch-tr"
      :class="{ our: r.our, idle: r.idle, cut: r.cut }"
    >
      <span class="ch-pl">{{ r.place }}</span>
      <span class="ch-tm">
        <img
          class="ch-emi"
          :src="storyArtUrl(r.emblem)"
          alt=""
          width="32"
          height="38"
        >
        <span><b>{{ r.name }}</b><small>{{ r.sub }}</small></span>
      </span>
      <span
        v-for="(c, i) in r.cells"
        :key="i"
        class="ch-rw"
        :class="[c.kind === 'lost' ? 'l lost' : c.kind, { open: c.open }]"
      >{{ c.kind === 'no' && c.open ? '' : c.text }}</span>
      <span class="ch-pt">{{ r.pts }}</span>
    </div>
  </div>
</template>
