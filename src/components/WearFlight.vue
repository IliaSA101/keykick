<script setup lang="ts">
/*
 * «Надеть» в шкафчике: подписи со спины (имя и номер) перелетают с прежней надетой формы
 * на новую (~0,5 с). Компонент живёт один полёт: появился — полетел, долетел — «done».
 * Пропал раньше (новый «Надеть», уход со страницы) — полёт отменяется.
 * Слой — в body, вне увеличенного каркаса (zoom, app/viewport): замеры getBoundingClientRect —
 * в px окна, и px полёта — тоже окна, без пересчёта на множитель. Читалка его не видит.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';

/** Рамка формы в px окна. */
type FlightRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

const props = defineProps<{
  from: FlightRect;
  to: FlightRect;
  back: { name: string; number: number | null };
  ink: { fill: string; outline: string };
}>();
const emit = defineEmits<{ done: [] }>();

const FLY_MS = 500;
const el = ref<HTMLElement | null>(null);
let anim: Animation | null = null;

/**
 * Размер летящего имени в долях ширины формы: как на холсте — 10,6 %, а длинное ужимается
 * в 46 % ширины (буква жирного шрифта ≈ 0,7 своего размера).
 */
function nameSize(name: string): string {
  return `${Math.min(10.6, 46 / (name.length * 0.7)).toFixed(2)}cqi`;
}

onMounted(() => {
  if (!el.value) {
    emit('done');
    return;
  }
  const dx = props.to.left - props.from.left;
  const dy = props.to.top - props.from.top;
  const k = props.to.width / props.from.width;
  anim = el.value.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], {
    duration: FLY_MS,
    easing: 'ease-in-out',
    fill: 'forwards',
  });
  anim.onfinish = () => emit('done');
});

onBeforeUnmount(() => {
  if (anim) anim.onfinish = null;
  anim?.cancel();
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="el"
      class="ghost"
      aria-hidden="true"
      :style="{
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        color: ink.fill,
        '--outline': ink.outline,
      }"
    >
      <span
        v-if="back.name"
        class="ghost-name"
        :style="{ fontSize: nameSize(back.name) }"
      >{{ back.name.toUpperCase() }}</span>
      <span
        v-if="back.number !== null"
        class="ghost-number"
      >{{ back.number }}</span>
    </div>
  </Teleport>
</template>

<style scoped>
/*
 * Подписи в полёте: в тех же долях холста, что рисует KitView на спине (drawBack: имя на 0,24
 * высоты корпуса, номер на 0,56; корпус — 2,5…99 % высоты картинки). Длинное имя ужимается
 * по ширине — так же, как на холсте (nameSize в скрипте).
 */
.ghost {
  position: fixed;
  z-index: 20;
  transform-origin: 0 0;
  pointer-events: none;
  font-weight: 900;
  text-align: center;
  container-type: inline-size;
}

.ghost-name,
.ghost-number {
  position: absolute;
  left: 0;
  right: 0;
  line-height: 1;
  transform: translateY(-50%);
  white-space: nowrap;
  paint-order: stroke fill;
  -webkit-text-stroke: 0.14em var(--outline);
}

.ghost-name {
  top: 25.6%;
}

.ghost-number {
  top: 56.5%;
  font-size: 38.5cqi;
}
</style>
