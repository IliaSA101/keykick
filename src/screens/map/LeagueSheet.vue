<script setup lang="ts">
/**
 * Окно «Лист лиги» поверх Карты (068-Р17, Э2.29, Э2.30/.37): четыре строки с полосой — звёзды, альбом, эмблема двора, права
 * на компьютер; до урока 17 «N / M», с него «ещё K». Ничего не считает: строки даёт `engine/map/sheet.ts`. Esc и «Закрыть» — закрыть.
 */
import { computed } from 'vue';
import { fill } from '../../app/home/texts';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import type { LeagueSheet } from '../../engine/map';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const props = defineProps<{ sheet: LeagueSheet }>();
defineEmits<{ close: [] }>();
const t = ru.map.sheet;
/** Единица строки: у звёзд — значок ★, у остальных — слово по числу. */
const unitOf = (key: string, n: number): string => (key === 'stars' ? t.star : plural(n, key === 'album' ? t.cards : key === 'emblem' ? t.parts : t.skills));
const rows = computed(() =>
  props.sheet.rows.map((r) => {
    const n = props.sheet.left ? r.left : r.have;
    return { key: r.key, label: r.key === 'rights' ? ru.learn.brk.rights.title : t[r.key], pct: Math.round(r.pct), n, total: r.total, unit: unitOf(r.key, props.sheet.left ? r.left : r.total) };
  }),
);
const lead = computed(() => fill(props.sheet.left ? t.leadLeft : t.leadDone, { n: props.sheet.cur }));
</script>

<template>
  <KitModal
    :title="ru.map.leagueSheet"
    :lead="lead"
    :width="440"
    :top="120"
    left
    @close="$emit('close')"
  >
    <template #head>
      <KeyButton
        quiet
        :sub="ru.kit.esc"
        @click="$emit('close')"
      >
        {{ ru.kit.close }}
      </KeyButton>
    </template>
    <div class="rows">
      <div
        v-for="r in rows"
        :key="r.key"
        class="kb-row"
      >
        <span>{{ r.label }}</span>
        <span v-if="sheet.left">{{ t.left }} <em>{{ r.n }}</em> {{ r.unit }}</span>
        <span v-else><em>{{ r.n }}</em> / {{ r.total }} {{ r.unit }}</span>
        <i><b :style="{ width: `${r.pct}%` }" /></i>
      </div>
    </div>
  </KitModal>
</template>

<style scoped>
.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
</style>
