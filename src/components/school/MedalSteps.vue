<script setup lang="ts">
/**
 * Пороги медалей тура «Школы» (Э3.19, Э3.39): «бронза — 3 верных · серебро — 4 · золото — 5». Нужны, чтобы ребёнок видел, до чего
 * тянуться. Порог 0 (у тура из 3 нет золота) не показываем. Пороги — `content/school.json`, как у `medalOf`; только показ.
 * `bar` — шкала с метками (колонка тура): заливка по верным, медаль и число под своей отметкой; медали на синей колонке — прямо на синем, без плашки (награда в синем окне, 067-Р107).
 */
import { computed } from 'vue';
import cfg from '../../content/school.json';
import { fill } from '../../app/home/texts';
import { ru } from '../../i18n/ru';
import MedalMark from './MedalMark.vue';

const props = defineProps<{ size: number; bar?: boolean; right?: number }>();
const t = ru.school.tour;
const row = computed(() => (cfg.medals as Record<string, readonly number[]>)[String(Math.min(props.size, 5))] ?? [0, 0, 0]);
const steps = computed(() => ([1, 2, 3] as const).map((m) => ({ medal: m, at: row.value[m - 1] ?? 0 })).filter((s) => s.at > 0));
const pct = (n: number): string => `${Math.min(100, (n / Math.max(props.size, 1)) * 100)}%`;
const line = (m: 1 | 2 | 3, at: number): string => fill(m === 1 ? t.stepFirst : t.step, { medal: ru.school.medal[m] ?? '', n: String(at) });
</script>

<template>
  <div
    v-if="bar"
    class="bar"
  >
    <div class="rail">
      <b :style="{ width: pct(right ?? 0) }" />
      <i
        v-for="s in steps"
        :key="s.medal"
        :style="{ left: pct(s.at) }"
      />
    </div>
    <div class="marks">
      <div
        v-for="s in steps"
        :key="s.medal"
        :style="{ left: pct(s.at) }"
      >
        <MedalMark
          :medal="s.medal"
          :size="30"
        />
        <span>{{ s.at }}</span>
      </div>
    </div>
  </div>
  <div
    v-else
    class="line"
  >
    <div
      v-for="s in steps"
      :key="s.medal"
    >
      <MedalMark
        :medal="s.medal"
        :size="32"
      />{{ line(s.medal, s.at) }}
    </div>
  </div>
</template>

<style scoped>
.line { display: flex; gap: 22px; font-size: 15px; font-weight: 700; }
.line > div { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.bar { padding: 0 16px; }
.rail { position: relative; height: 10px; border-radius: 5px; background: rgb(255 255 255 / 0.28); }
.rail b { position: absolute; left: 0; top: 0; height: 10px; border-radius: 5px; background: #1b8a3a; }
.rail i { position: absolute; top: -3px; width: 2px; height: 16px; margin-left: -1px; background: #fff; }
.marks { position: relative; height: 56px; margin-top: 12px; }
.marks > div { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 1px; font-size: 14px; font-weight: 700; }
</style>
