<script setup lang="ts">
/** Строка экрана под шапкой (ЭБ.09, ЭБ.10) — `screenHead` из kit.mjs: «название · город», ★, болельщики, монеты с копилкой, ярлыки. Копилка — подсказкой по наведению. */
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import KitChip from '../kit/KitChip.vue';

const props = defineProps<{ title: string; city: string; stars?: string; fans?: number; coins?: number; dreamText?: string; dreamPct?: number; chips?: string[]; coinsLink?: boolean; /** Ярлык, чьё окно открыто (золотой). */ open?: string | undefined }>();
defineEmits<{ chip: [name: string]; coins: [] }>();
const NB = String.fromCharCode(160);
const num = (n: number): string => n.toLocaleString('ru-RU').replace(/\s/g, NB);
const fansLine = (): string => `${num(props.fans ?? 0)}${NB}${plural(props.fans ?? 0, ru.home.fansWord)}`;
</script>

<template>
  <div class="kb-head">
    <h1>{{ title }} <span>· {{ city }}</span></h1>
    <div class="kb-stats">
      <b
        v-if="stars"
        class="st"
      ><i>★</i>{{ stars }}</b>
      <b
        v-if="fans !== undefined"
        class="fa"
      ><span :title="ru.home.fansTitle"><svg
        class="fan-ic"
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      ><circle
        cx="5"
        cy="4.5"
        r="2.6"
      /><circle
        cx="11.5"
        cy="5.5"
        r="2.2"
      /><path d="M0.5 15c0-3.3 2-5.6 4.5-5.6S9.5 11.7 9.5 15z" /><path d="M8.8 10.3c.8-.8 1.7-1.2 2.7-1.2 2.2 0 4 2 4 5H10.3c-.2-1.5-.7-2.8-1.5-3.8z" /></svg>{{ fansLine() }}</span></b>
      <b
        v-if="coins !== undefined"
        class="co shop"
        :class="{ link: coinsLink }"
        :title="dreamText"
        :role="coinsLink ? 'button' : undefined"
        :tabindex="coinsLink ? 0 : undefined"
        @click="coinsLink && $emit('coins')"
        @keydown.enter.stop.prevent="coinsLink && $emit('coins')"
      ><i>●</i>{{ coins }}<i
        v-if="dreamPct !== undefined"
        class="bar"
      ><u :style="{ width: `${dreamPct}%` }" /></i></b>
      <KitChip
        v-for="c in chips ?? []"
        :key="c"
        :class="{ over: c === open }"
        :on="c === open"
        @click="$emit('chip', c)"
      >
        {{ c }}
      </KitChip>
    </div>
  </div>
</template>

<style scoped>
/* монеты Дома — вход в Лавку (049): рука на числе */
.co.link { cursor: pointer; }
/* значок болельщиков — как FAN_ICON в kit.mjs: рядом с числом, не отдельным блоком */
.fan-ic {
  vertical-align: -2px;
  margin-right: 4px;
}
/* ярлык открытого окна — над затемнением, золотой (Э2.30) */
.over {
  position: relative;
  z-index: 11;
}
</style>
