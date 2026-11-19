<script setup lang="ts">
/** «Остальные группы» (038-Р40): все 4 команды семи групп; на узкой сцене — без эмблем. «Выходят» (двое ярко, двое бледно) — когда группа доиграна. */
import { storyArtUrl } from '../../app/art/storyArt';
import type { OtherGroup } from '../../app/cup/groupView';
import { ru } from '../../i18n/ru';

defineProps<{ groups: OtherGroup[]; narrow: boolean }>();
</script>

<template>
  <p class="ch-ol">
    {{ ru.cup.screen.others }}
  </p>
  <div class="ch-ogs">
    <div
      v-for="g in groups"
      :key="g.letter"
      class="ch-og"
    >
      <em>{{ g.letter }}</em>
      <span
        v-for="r in g.rows"
        :key="r.name"
        class="ch-ot"
        :class="r.kind"
      >
        <img
          v-if="!narrow"
          class="ch-emi"
          :src="storyArtUrl(r.emblem)"
          alt=""
          width="11"
          height="13"
        >
        <b>{{ r.name }}</b><i v-if="r.pts !== ''">{{ r.pts }}</i>
      </span>
    </div>
  </div>
</template>
