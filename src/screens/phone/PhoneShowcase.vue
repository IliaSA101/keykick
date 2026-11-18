<script setup lang="ts">
/**
 * Витрина «Путь клуба» (Э6.101–102): две картинки без игры, как на принятых кадрах. Дом — настоящая сцена Дома
 * (`components/home/HomeBackdrop`, вид `show`) на уроке 17 выдуманного игрока (063-Р61: `app/home/preview`, сохранение не
 * читается); уровень Двора — пока готовая картинка карты `map/base` (рамка до Т13: карта «Путь клуба» с шкалой лиг и «Ты здесь»).
 * Сцена 1024×640 под шапкой оболочки, уменьшенная на ширину окна. Всё неактивно (`inert`): играть — на компьютере. Esc и «Назад» — к странице.
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { usePack } from '../../app/packs/usePack';
import KeyButton from '../../components/kit/KeyButton.vue';
import { K, offOf } from '../../components/home/geometry';
import HomeBackdrop from '../../components/home/HomeBackdrop.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import { BASE_H, BASE_W } from '../../components/shell/stageScale';
import { ru } from '../../i18n/ru';

const props = defineProps<{ width: number }>();
const emit = defineEmits<{ back: [] }>();
const t = ru.phone;

/** Поля витрины с боков, px. */
const SIDE = 16;
const k = computed(() => (props.width - 2 * SIDE) / BASE_W);
const pic = computed(() => ({ width: `${props.width - 2 * SIDE}px`, height: `${Math.round(BASE_H * k.value)}px` }));
const stage = computed(() => ({ transform: `scale(${k.value})` }));
/** Картинка кадра 1920×1072 по высоте сцены (как «cover» в Доме), по центру. */
const picture = { left: `${offOf(BASE_W)}px`, width: `${1920 * K}px`, height: `${BASE_H}px` };
const base = import.meta.env.BASE_URL;
/** Урок, на котором стоит выдуманный игрок (кадр Э2.04). */
const LESSON = 17;
/** Порядок и названия уроков — из пакета Двора (он открыт всем): нет пакета — Дом не рисуем, пустая рамка. */
const pack = usePack('ru.yard');
const preview = computed(() => {
  const p = pack.pack.value;
  if (!p) return null;
  return { lesson: LESSON, order: p.lessons.order, lessonName: (n: number): string => p.text.ru?.lessons[p.lessons.order[n - 1] ?? '']?.name ?? '' };
});

const onKey = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') emit('back');
};
onMounted(() => globalThis.addEventListener('keydown', onKey));
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <div
    class="vit"
    :class="{ big: width > 500 }"
  >
    <h1>{{ t.showcaseTitle }}</h1>
    <p>{{ t.showcaseLead }}</p>
    <div
      class="pic"
      :style="pic"
      inert
      aria-hidden="true"
    >
      <div
        class="stage-box"
        :style="stage"
      >
        <HomeBackdrop
          v-if="preview"
          mode="show"
          :preview="preview"
        />
        <ShellHeader page="home" />
      </div>
    </div>
    <div
      class="pic"
      :style="pic"
      inert
      aria-hidden="true"
    >
      <div
        class="stage-box"
        :style="stage"
      >
        <img
          :src="`${base}art/map/base.webp`"
          alt=""
          :style="picture"
        >
        <ShellHeader page="path" />
      </div>
    </div>
    <KeyButton
      quiet
      md
      @click="emit('back')"
    >
      {{ ru.handsHelp.back }}
    </KeyButton>
  </div>
</template>

<style scoped>
.vit {
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 16px 24px;
  text-align: center;
}
h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
}
p {
  margin: 0;
  font-size: 17px;
}
.big h1 {
  font-size: 36px;
}
.big p {
  font-size: 22px;
}
.pic {
  position: relative;
  flex: none;
  overflow: hidden;
  border-radius: 12px;
  background: #0d0c2a;
}
.stage-box {
  position: absolute;
  left: 0;
  top: 0;
  width: 1024px;
  height: 640px;
  transform-origin: 0 0;
}
.stage-box img {
  position: absolute;
  top: 0;
  max-width: none;
}
</style>
