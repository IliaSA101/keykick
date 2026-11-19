<script setup lang="ts">
/** Итог игры (Э8.03/.06/.09/.12): медаль ступени, что получилось и что дальше, награда на плашке (монеты или «Рекорд»), судья «палец вверх». Золото — только на светлой плашке. */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { endLines, mmss, type EndModel } from '../../app/learn/view';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import LearnCoin from './LearnCoin.vue';
import TierMedal from './TierMedal.vue';

const props = defineProps<{ end: EndModel; name: string; goldTime: string }>();
const t = ru.learn.end;
const lines = computed(() => endLines(props.end, props.name, props.goldTime));
</script>

<template>
  <div class="end">
    <div class="txt">
      <div class="row">
        <TierMedal
          :tier="end.tier || 1"
          :size="92"
        />
        <div class="lines">
          <b>{{ lines.title }}</b>
          <span>{{ lines.sub }}.</span>
          <span>{{ lines.note }}</span>
        </div>
      </div>
      <div class="award-plate pay">
        <template v-if="end.goldRepeat">
          <small>{{ t.record }}</small><b class="rec">{{ mmss(end.best) }}</b>
        </template>
        <template v-else>
          <b>+{{ end.coins }} {{ plural(end.coins, ru.result.purse.coins) }}</b><LearnCoin
            v-for="i in end.coins"
            :key="i"
          /><small>{{ t.perGame }}</small>
        </template>
      </div>
      <span
        v-if="end.goldRepeat"
        class="zero"
      >{{ t.zero }}</span>
    </div>
    <img
      class="ref"
      :src="artUrl('baseRefereeThumbsUp')"
      alt=""
    >
  </div>
</template>

<style scoped>
.end { position: relative; width: 100%; height: 100%; }
.txt { position: absolute; inset: 0 auto 0 0; width: 436px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 16px 0 16px 22px; }
.row { display: flex; align-items: center; gap: 16px; }
.lines { display: flex; flex-direction: column; gap: 4px; }
.lines b { font-size: 21px; line-height: 1.15; }
.lines span { font-size: 15px; line-height: 1.25; color: var(--text-muted); }
.pay { display: inline-flex; align-items: center; gap: 8px; --award-pad: 8px; }
.pay b { font-size: 24px; font-weight: 800; white-space: nowrap; }
.pay b.rec { font-size: 30px; color: #3a2a00; }
.pay small { font-size: 13px; font-weight: 600; color: #5a5668; white-space: nowrap; }
.zero { margin-top: -6px; font-size: 15px; line-height: 1.25; color: var(--text-muted); }
.ref { position: absolute; right: 16px; bottom: 8px; height: 180px; width: auto; }
</style>
