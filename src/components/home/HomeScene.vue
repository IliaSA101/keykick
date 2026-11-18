<script setup lang="ts">
/**
 * Картинка двора Дома (065 Т7): слои печи (основа → под людьми → заготовка → люди → поверх), табло на борту, табличка полного двора,
 * затенение краёв. Моушн М4 — рост основы. Ничего не считает: слои даёт `sceneOf`, строки — `app/home/texts.ts`.
 */
import { computed, ref, watch } from 'vue';
import yard from '../../content/home-yard.json';
import type { Scene } from '../../app/home/scene';
import { tabloLine } from '../../app/home/texts';
import type { HomeInput } from '../../engine/home';
import type { HomeView } from '../../engine/home/view';
import { ru } from '../../i18n/ru';
import { tintedSprite } from './crowdTint';
import { K, offOf, pieceStyle, stepBoxOf } from './geometry';

const props = defineProps<{ view: HomeView; input: HomeInput; scene: Scene; width: number; grow: boolean; prevBase: string; peek: boolean; hue: number | null }>();
const emit = defineEmits<{ 'update:peek': [v: boolean]; grown: [] }>();
const t = ru.home;
const base = import.meta.env.BASE_URL;

/** Люди на трибуне — в цветах клуба (Р80): спрайт болельщика перекрашивается по оттенку формы; пока не готов — не показываем (иначе мелькнёт синий). */
const FAN = /sprite-fans-|team-[pk]|shield-/; // болельщики, команда на поле и щит «Школы» (Т7д); контур следующей группы (team-o) — белый, не красится
const tinted = ref<Record<string, string>>({});
watch(() => [[...props.scene.people, ...props.scene.over, ...props.scene.team], props.hue] as const, ([people, hue]) => {
  if (hue === null) return;
  for (const f of new Set(people.map((p) => p.file).filter((f) => FAN.test(f)))) {
    void tintedSprite(`${base}${f}`, hue).then((url) => void (tinted.value = { ...tinted.value, [`${hue}|${f}`]: url }));
  }
}, { immediate: true });
const crowd = computed(() => [...props.scene.people, ...props.scene.over, ...props.scene.team].flatMap((p) => {
  const src = props.hue === null || !FAN.test(p.file) ? `${base}${p.file}` : tinted.value[`${props.hue}|${p.file}`];
  return src === undefined ? [] : [{ p, src }];
}));

const off = computed(() => offOf(props.width));
const tabloAt = yard.text.tablo;
const box = computed(() => stepBoxOf(props.view.stadium.built));
const tabloShown = computed(() => props.view.stadium.tablo.kind !== 'none' || props.input.cur >= 33);
const tabloText = computed(() => tabloLine(props.view.stadium.tablo, props.input.cur));
</script>

<template>
  <div class="cam">
    <div
      class="scene"
      :class="{ grow }"
      :style="{ left: `${off}px`, transform: `scale(${K})` }"
      @animationend.self="emit('grown')"
    >
      <img
        v-if="grow"
        class="layer"
        :src="`${prevBase}`"
        alt=""
      >
      <img
        class="layer base"
        :class="{ reveal: grow }"
        :src="`${base}${scene.base}`"
        alt=""
      >
      <img
        v-for="p in scene.under"
        :key="p.key"
        class="piece"
        :src="`${base}${p.file}`"
        :style="pieceStyle(p)"
        alt=""
      >
      <img
        v-if="scene.ghost"
        class="piece ghost"
        :class="{ hover: peek }"
        :src="`${base}${scene.ghost}`"
        style="left: 0; top: 0; width: 1920px; height: 1072px"
        alt=""
      >
      <img
        v-for="{ p, src } in crowd"
        :key="p.key"
        class="piece"
        :src="src"
        :style="pieceStyle(p)"
        alt=""
      >
      <div
        v-if="box && scene.ghost"
        class="hit"
        :style="{ left: `${box[0]}px`, top: `${box[1]}px`, width: `${box[2] - box[0]}px`, height: `${box[3] - box[1]}px` }"
        @mouseenter="emit('update:peek', true)"
        @mouseleave="emit('update:peek', false)"
      />
      <div
        v-if="tabloShown"
        class="tablo"
        :style="{ left: `${tabloAt[0]}px`, top: `${tabloAt[1]}px`, width: `${tabloAt[2]! - tabloAt[0]!}px`, height: `${tabloAt[3]! - tabloAt[1]!}px` }"
      >
        {{ tabloText }}
      </div>
      <div
        v-if="view.stars.n >= view.stars.of"
        class="plaque"
        :style="{ left: `${(yard.text.plaque[0]! + yard.text.plaque[2]!) / 2}px`, top: `${yard.text.plaque[1]! - 3}px` }"
      >
        {{ t.plaque }}
      </div>
    </div>
  </div>
  <div class="shade" />
</template>

<style scoped>
.cam {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.scene {
  position: absolute;
  top: 0;
  width: 1920px;
  height: 1072px;
  transform-origin: 0 0;
}
.layer,
.piece {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1072px;
}
.piece {
  height: auto;
  overflow: hidden;
  object-fit: cover;
  object-position: 0 0;
}
.ghost {
  opacity: 0.18;
  filter: saturate(0) brightness(1.8) drop-shadow(0 0 3px rgb(244 194 74 / 0.9));
}
.ghost.hover {
  opacity: 0.5;
}
.hit {
  position: absolute;
}
/* табличка полного двора на борту трибуны: тёмно-зелёная с золотой кромкой, белый текст (зелёное с золотым — разрешено) */
.plaque {
  position: absolute;
  transform: translateX(-50%);
  padding: 3px 8px;
  border: 2px solid #d6a83c;
  border-radius: 4px;
  background: #1b6e2f;
  color: #fff;
  font: 700 12px/1.2 var(--font-ui, system-ui);
  white-space: nowrap;
  pointer-events: none;
}
.tablo {
  position: absolute;
  display: grid;
  place-items: center;
  background: repeating-linear-gradient(#10101a 0 2px, #161620 2px 3px);
  color: #ffc46e;
  font: 700 28px/1 'Liberation Sans Narrow', 'Arial Narrow', var(--font-ui, system-ui);
  text-shadow: 0 0 6px #78542899;
  pointer-events: none;
}
.shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(rgb(21 20 58 / 0.88), rgb(21 20 58 / 0.35) 14%, transparent 22%),
    linear-gradient(transparent 80%, rgb(21 20 58 / 0.55) 92%, rgb(21 20 58 / 0.8)),
    radial-gradient(ellipse at 50% 55%, transparent 50%, rgb(21 20 58 / 0.45));
}
/* М4 «рост стадиона» (061-В3): новая основа раскрывается снизу вверх; «меньше движения» — растворение */
.scene.grow {
  animation: cam-in var(--motion-scene) var(--motion-ease-out) both, cam-out var(--motion-slow) ease 2300ms both;
}
.reveal {
  animation: reveal calc(var(--motion-scene) * 1.4) ease both;
}
@keyframes reveal {
  from {
    clip-path: inset(100% 0 0 0);
  }
  to {
    clip-path: inset(0);
  }
}
@keyframes cam-in {
  to {
    transform-origin: 960px 540px;
  }
}
@keyframes cam-out {
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .reveal {
    animation: fade var(--motion-fast) ease both;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
}
</style>
