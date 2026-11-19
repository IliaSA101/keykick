<script setup lang="ts">
/**
 * Шкала лиг Пути клуба (Э7.113, 052-Р2, Р42): шесть делений — Двор · Район · Город · Страна · Европа · Мир (кубок мира на конце).
 * «Здесь» — флажок клуба над делением Двора, кольцо — камера (054-Р1: камера = выбор = Двор), галочка — Двор пройден (Э7.184).
 * Наведение мыши — подсказка, не выбор (Z1): сообщаем наверх. `nudge` растёт при упоре колёсика — шкала качается, «Район» светлеет (М7).
 */
import type { PathDot } from '../../engine/path';
import { artFiles } from '../../art/assets';
import ClubFlag from '../../components/league/ClubFlag.vue';
import { ru } from '../../i18n/ru';

defineProps<{ scale: PathDot[]; nudge: number; hover: string | null; flag: string }>();
const base = import.meta.env.BASE_URL;
const emit = defineEmits<{ hover: [league: string | null] }>();
const names: Record<string, string> = ru.league.names;
</script>

<template>
  <div
    :key="nudge"
    class="scale"
    :class="{ nudge: nudge > 0 }"
  >
    <div
      v-for="d in scale"
      :key="d.league"
      class="dv"
      :class="[d.kind, { on: d.league === 'yard', done: d.done, hov: hover === d.league, stop: nudge > 0 && d.league === 'district' }]"
      @mouseenter="emit('hover', d.league)"
      @mouseleave="emit('hover', null)"
    >
      <i
        v-if="d.kind === 'here'"
        class="fl"
      >
        <ClubFlag
          mini
          :fill="flag"
        />
      </i>
      <i class="dot"><img
        v-if="d.kind === 'world'"
        :src="`${base}${artFiles.pathWorldcup}`"
        alt=""
      ></i>
      <span>{{ names[d.league] }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Вид и размеры — шкала макета Э7 (tools/mock-path/scale/bar.mjs, .sc-bar.r42): плашка как у панели «На матч», деления 64 px */
.scale {
  position: absolute;
  right: 16px;
  bottom: 12px;
  z-index: 3;
  display: flex;
  padding: 13px 12px 10px;
  border-radius: 12px;
  background: linear-gradient(160deg, rgb(58 63 134 / 0.96), rgb(31 33 82 / 0.96));
  box-shadow:
    inset 0 0 0 1.5px var(--border),
    0 10px 22px rgb(0 0 0 / 0.35);
}
.scale.nudge {
  animation: nudge var(--motion-base) var(--motion-ease-out) both;
}
.dv {
  position: relative;
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.1;
  color: #cfd6c8;
}
.dv::before {
  /* линия шкалы между точками */
  content: '';
  position: absolute;
  top: 15.5px;
  left: 0;
  right: 0;
  height: 3px;
  background: rgb(255 246 224 / 0.3);
}
.dv:first-child::before {
  left: 50%;
}
.dv:last-child::before {
  right: 50%;
}
.dot {
  position: relative;
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  margin: 9px 0;
  border-radius: 50%;
  background: #183428;
  border: 2px solid rgb(255 246 224 / 0.45);
}
.dv.here .dot {
  background: #3fa36b;
  border-color: #e8efe9;
}
.dv.next .dot {
  background: transparent;
  border: 2.5px solid #3fa36b;
}
.dv.on {
  color: #fff;
  font-weight: 700;
  letter-spacing: -0.6px;
}
.dv.on .dot {
  box-shadow: 0 0 0 3px #fff;
  border-color: #fff;
}
.dv.world .dot {
  width: 30px;
  height: 30px;
  margin: 2px 0;
  display: grid;
  place-items: center;
  background: #1f6b47;
  border-color: #3fa36b;
}
.dv.world .dot img {
  width: 14px;
  height: auto;
}
.dv.done .dot {
  width: 22px;
  height: 22px;
  margin: 6px 0;
  background: #3fa36b;
  border: 2px solid #fff;
}
.dv.done .dot::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2.5px 2.5px 0;
  transform: rotate(45deg);
}
.dv.hov {
  color: #fff;
}
.dv.stop {
  animation: stop-in 700ms ease-out both;
}
/* маленький флаг клуба над текущим делением (Р42) */
.fl {
  position: absolute;
  left: 50%;
  top: -9px;
  margin-left: -1px;
  line-height: 0;
  pointer-events: none;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
}
.dv.done .fl {
  top: -12px;
}
@keyframes nudge {
  0%,
  100% {
    transform: none;
  }
  30% {
    transform: translateX(calc(6px * var(--motion-k)));
  }
  65% {
    transform: translateX(calc(-3px * var(--motion-k)));
  }
}
/* М7: на время упора «Район» подсвечен — светлая подложка и белая подпись (как .sc-dv.foc блока 3 Э7) */
@keyframes stop-in {
  15%,
  80% {
    background: rgb(255 255 255 / 0.18);
    color: #fff;
  }
}
</style>
