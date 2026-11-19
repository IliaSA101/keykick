<script setup lang="ts">
/**
 * Учебные игры Базы (067 Т19, ТЗ-7.1, кадры Э4.01–07): все по порядку каталога, две колонки; слева ступень (медаль 1–3, пустое кольцо — не играна),
 * имя, описание и подпись по ступени; закрытые — пунктиром «откроется с урока N». Играет окно `LearnWindow` (067-Р4): строка только просит открыть.
 */
import { fill } from '../../app/home/texts';
import type { LearnRow } from '../../app/base/run';
import { gameName, mmss } from '../../app/learn/view';
import { ru } from '../../i18n/ru';
import KeyButton from '../../components/kit/KeyButton.vue';
import TierMedal from '../../components/learn/TierMedal.vue';

defineProps<{ rows: LearnRow[] }>();
defineEmits<{ play: [id: string] }>();

const t = ru.base;
/** Первые четыре игры — подписи навыков перерыва (`ru.learn.brk.skill`, общий текст), остальные — «к «Школе»…». */
const subs: Record<string, string> = { ...ru.learn.brk.skill, ...t.learnSub };
const tier = (step: number): 1 | 2 | 3 => (step >= 3 ? 3 : step === 2 ? 2 : 1);
/** Вторая строка по ступени; «на золоте» называет лучшее время игры. */
const line = (r: LearnRow): string => fill(t.learnLine[r.line], { time: mmss(r.best ?? 0), n: r.lesson });
</script>

<template>
  <div class="learn">
    <h2>{{ t.learnHead }}</h2>
    <div class="lcs">
      <div
        v-for="r in rows"
        :key="r.id"
        class="lc"
        :class="{ ghost: !r.open }"
        :data-learn="r.id"
      >
        <TierMedal
          v-if="r.open && r.step > 0"
          :tier="tier(r.step)"
          :size="22"
        />
        <i
          v-else
          class="ring"
        />
        <div class="lt2">
          <b>{{ gameName(r.id) }}</b>
          <template v-if="r.open">
            <span :class="{ sch: r.toSchool }">{{ subs[r.id] }}</span>
            <span class="nx">{{ line(r) }}</span>
          </template>
          <span v-else>{{ line(r) }}</span>
        </div>
        <KeyButton
          v-if="r.open"
          quiet
          md
          @click="$emit('play', r.id)"
        >
          {{ ru.learn.start.play }}
        </KeyButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learn { flex: 1; min-width: 0; }
h2 { margin: 0 0 6px; font-size: 16px; line-height: 1.2; text-shadow: 0 1px 5px rgb(8 8 24 / 0.85); }
.lcs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; }
.lc { display: flex; align-items: center; gap: 8px; box-sizing: border-box; height: 52px; padding: 3px 10px; border-radius: 12px; background: rgb(21 20 58 / 0.85); box-shadow: inset 0 0 0 1.5px var(--border); }
.lc.ghost { border: 1.5px dashed var(--border); box-shadow: none; background: rgb(21 20 58 / 0.55); color: var(--text-muted); }
.ring { box-sizing: border-box; flex: none; width: 16px; height: 16px; border: 2px solid #fff; border-radius: 50%; margin: 0 3px; }
.ghost .ring { border-color: var(--border); }
.lt2 { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.lt2 b { font-size: 14px; }
.lt2 span { font-size: 11px; color: var(--text-muted); }
.lt2 .nx { color: #e8f0ff; }
/* метка тренажёра «к «Школе»»: 12 px, жирно, зелёным (ТАБУ 11.11: на синем без жёлтого) */
.lt2 .sch { font-size: 12px; font-weight: 800; color: #8fe3a8; }
</style>
