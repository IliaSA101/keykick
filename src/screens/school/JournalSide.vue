<script setup lang="ts">
/**
 * Левая панель журнала «Школы» (067 Т14, Э3.09–14): эмблема, щит с частями по две в ряд, тактики и «Знаток».
 * Группы стоят по высоте панели (`space-between`), как в макете `s-hub-*`; собранная эмблема — «Эмблема собрана» и строка про вывеску (Э3.12).
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { fill } from '../../app/home/texts';
import type { JournalView } from '../../app/school/journal';
import KitPanel from '../../components/kit/KitPanel.vue';
import CrestShield from '../../components/school/CrestShield.vue';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const props = defineProps<{ view: JournalView; knower: number; narrow: boolean }>();
const t = ru.school;
const done = computed(() => props.view.done);
const crestH = computed(() => (props.narrow ? 150 : 168));
/** Части эмблемы по две в строке (как в макете): пары слов общей колонкой, разрыв между парами равный. */
const pairs = computed(() => {
  const out: JournalView['parts'][] = [];
  for (let i = 0; i < props.view.parts.length; i += 2) out.push(props.view.parts.slice(i, i + 2));
  return out;
});
const knowerHead = computed(() => fill(t.knower.head, { n: String(props.knower), word: plural(props.knower, t.knower.words) }));
const knowerSub = computed(() => (props.view.expert.done ? fill(t.knower.doneSub, { n: String(props.knower) }) : fill(t.knower.left, { n: String(props.view.expert.left), tours: plural(props.view.expert.left, t.knower.tours) })));
</script>

<template>
  <KitPanel
    soft
    class="side"
  >
    <div class="emb">
      {{ done ? t.emblemDone : t.emblem }} {{ view.emblem }}<small>/10</small>
    </div>
    <div class="crest">
      <CrestShield
        :on="view.parts.map((p) => p.on)"
        :height="crestH"
      />
      <div
        class="parts"
        :style="{ height: `${crestH * 0.95}px` }"
      >
        <div
          v-for="(pair, i) in pairs"
          :key="i"
        >
          <span
            v-for="p in pair"
            :key="p.kind"
            :class="{ on: p.on }"
          >{{ t.parts[p.kind] ?? t.kinds[p.kind] ?? p.kind }}</span>
        </div>
      </div>
    </div>
    <p
      v-if="done"
      class="note"
    >
      {{ t.emblemNote }}
    </p>
    <p class="tac">
      {{ fill(t.tactics.head, { n: String(view.tactics.n), of: String(view.tactics.of) }) }}<span>{{ t.tactics.tours }}</span>
    </p>
    <hr>
    <div class="xp">
      <img
        :src="artUrl('schoolExpert')"
        alt=""
      >
      <div class="tx">
        {{ view.expert.done ? t.knower.done : knowerHead }}<small>{{ knowerSub }}</small>
        <i
          v-if="!view.expert.done"
          class="bar"
        ><b :style="{ width: `${view.expert.pct}%` }" /></i>
      </div>
    </div>
  </KitPanel>
</template>

<style scoped>
/* числа — базовые px сцены, как кадры Э3.09–Э3.14 (на узкой сцене 1024 — панель 316 и щит 150, как Э3.10) */
.side { position: absolute; left: 16px; top: 96px; width: 372px; height: 452px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; }
.narrow .side { width: 316px; }
.emb { font-size: 20px; font-weight: 800; }
.emb small { font-size: 14px; color: var(--text-muted); font-weight: 700; }
.crest { display: flex; gap: 12px; align-items: center; }
.parts { display: flex; flex-direction: column; justify-content: space-around; align-self: stretch; font-size: 12.5px; line-height: 1.25; color: var(--text-muted); }
.narrow .parts { font-size: 14px; }
.parts div { display: flex; flex-direction: column; }
.parts span.on { color: var(--text); font-weight: 700; }
.parts span.on::before { content: '✓ '; color: #8fe3a8; }
.note { margin: 0; font-size: 12.5px; color: var(--text-muted); }
.tac { margin: 0; font-size: 15px; font-weight: 700; }
.tac span { display: block; font-size: 12.5px; color: var(--text-muted); }
hr { width: 100%; height: 1px; margin: 0; border: 0; background: rgb(255 255 255 / 0.12); }
.xp { display: flex; gap: 10px; align-items: center; }
.xp img { width: 37px; height: 52px; object-fit: cover; object-position: top; border-radius: 4px; background: var(--award-plate); padding: 3px; }
.tx { flex: 1; font-size: 15px; font-weight: 700; }
.tx small { display: block; font-size: 12.5px; color: var(--text-muted); font-weight: 700; }
.bar { display: block; height: 7px; margin-top: 4px; border-radius: 4px; background: rgb(255 255 255 / 0.16); overflow: hidden; }
.bar b { display: block; height: 100%; background: #6fd493; }
</style>
