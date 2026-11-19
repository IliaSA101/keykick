<script setup lang="ts">
/**
 * Щит эмблемы «Школы» (067 Т14, Э3.09–14, Э3.20): герб клуба `iconCrest`, поделённый на 10 долей (сетка 2×5, как в макете `shield`).
 * Собранная доля — герб виден, пустая — крем с пунктиром; целый щит (10/10) — без сетки. Какая доля собрана — по виду тура, а не по счёту.
 * Щит всегда на светлой плашке: золото и синий на вещах не касаются (ТАБУ).
 */
import { computed, useId } from 'vue';
import { artUrl } from '../../art/assets';
import { ru } from '../../i18n/ru';

const props = withDefaults(defineProps<{ on: readonly boolean[]; height?: number; fresh?: number }>(), { height: 170, fresh: -1 });
const uid = `cs${useId()}`;
const VH = 118.5; // высота viewBox: герб 128×152 при ширине 100
const CH = VH / 5;
const cell = (i: number): { x: number; y: number } => ({ x: (i % 2) * 50, y: Math.floor(i / 2) * CH });
const full = computed(() => props.on.length >= 10 && props.on.every(Boolean));
const count = computed(() => props.on.filter(Boolean).length);
const w = computed(() => (props.height * 100) / VH);
const label = computed(() => ru.home.emblem.replace('{n}', String(count.value)));
</script>

<template>
  <span class="plate">
    <svg
      :width="w"
      :height="height"
      :viewBox="`0 0 100 ${VH}`"
      role="img"
      :aria-label="label"
    >
      <defs>
        <mask
          :id="`${uid}m`"
          mask-type="alpha"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="100"
          :height="VH"
        >
          <image
            :href="artUrl('iconCrest')"
            x="0"
            y="0"
            width="100"
            :height="VH"
            preserveAspectRatio="none"
          />
        </mask>
        <clipPath :id="`${uid}c`">
          <template
            v-for="(got, i) in on"
            :key="`c${i}`"
          >
            <rect
              v-if="got"
              :x="cell(i).x"
              :y="cell(i).y"
              width="50"
              :height="CH + 0.2"
            />
          </template>
        </clipPath>
      </defs>
      <image
        v-if="full"
        :href="artUrl('iconCrest')"
        x="0"
        y="0"
        width="100"
        :height="VH"
        preserveAspectRatio="none"
      />
      <g
        v-else
        class="body"
      >
        <g :mask="`url(#${uid}m)`">
          <template
            v-for="(got, i) in on"
            :key="`o${i}`"
          >
            <rect
              v-if="!got"
              class="off"
              :x="cell(i).x + 0.8"
              :y="cell(i).y + 0.8"
              width="48.4"
              :height="CH - 1.6"
            />
          </template>
          <image
            :href="artUrl('iconCrest')"
            x="0"
            y="0"
            width="100"
            :height="VH"
            preserveAspectRatio="none"
            :clip-path="`url(#${uid}c)`"
          />
        </g>
        <template
          v-for="(got, i) in on"
          :key="`l${i}`"
        >
          <rect
            v-if="got"
            :class="['line', { fresh: i === fresh }]"
            :x="cell(i).x"
            :y="cell(i).y"
            width="50"
            :height="CH"
          />
        </template>
      </g>
    </svg>
  </span>
</template>

<style scoped>
.plate { display: inline-block; padding: 6px; border-radius: 8px; background: var(--award-plate); line-height: 0; }
.body { filter: drop-shadow(0 0 0.8px #766e60); }
.off { fill: #f8f5ec; stroke: var(--paper-border); stroke-width: 1.3; stroke-dasharray: 3 2.5; }
.line { fill: none; stroke: #fff; stroke-width: 1.1; }
.line.fresh { stroke: #14683a; stroke-width: 2.2; }
</style>
