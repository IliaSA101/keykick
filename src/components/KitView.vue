<script setup lang="ts">
// Предмет комплекта на canvas: общая основа + перекраска движком в цвета формы.
// view: футболка (front; с back — вид сзади: имя и номер поверх корпуса, цвет надписи выбирает
// движок), шорты и гетры — цвета из outfitFor, бутсы — из пары boots. Предмет обрезается
// по своей рамке (opaqueBox): поля вокруг шорт, гетр и бутс на слоях разные.
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { loadedKitBase, loadKitBase, type View } from '../app/kitBase';
import { bootsColors, type Boots } from '../engine/boots';
import { shirtInk } from '../engine/club';
import { outfitFor, paintKit, paintZones, type BodyBox, type Kit, type OpaqueBox } from '../engine/kit';
import { ru } from '../i18n/ru';

export interface ShirtBack {
  name: string;
  number: number | null;
}

/** Что показать: футболку (с back — спиной), шорты, гетры или бутсы. */
export type ItemView = Exclude<View, 'back'>;

const props = withDefaults(
  defineProps<{ kit?: Kit | null; back?: ShirtBack | null; view?: ItemView; boots?: Boots | null }>(),
  { kit: null, back: null, view: 'front', boots: null },
);
/** drawn — холст нарисован (шкафчик берёт с него маску блика кубковых бутс). */
const emit = defineEmits<{ drawn: [canvas: HTMLCanvasElement] }>();
const canvas = ref<HTMLCanvasElement | null>(null);
/** Номер рисовки: рисовка ждёт загрузки — более новая за это время отменяет старую. */
let drawing = 0;

const base = computed<View>(() => (props.view === 'front' && props.back ? 'back' : props.view));

interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Часть слоя на холсте, в пикселях: у футболки — весь квадрат, у остальных — рамка предмета. */
function cropOf(frame: OpaqueBox | null, w: number, h: number): Crop {
  if (props.view === 'front' || !frame) return { x: 0, y: 0, w, h };
  const x = Math.round(frame.x * w);
  const y = Math.round(frame.y * h);
  return { x, y, w: Math.round(frame.w * w), h: Math.round(frame.h * h) };
}

/** Размер холста: основа уже загружена — сразу нужный (без скачка вёрстки), иначе квадрат 640. */
function sizeNow(): { w: number; h: number } {
  const known = loadedKitBase(base.value);
  if (!known) return { w: 640, h: 640 };
  const c = cropOf(known.frame, known.layers.width, known.layers.height);
  return { w: c.w, h: c.h };
}
const size = ref(sizeNow());

/** Надпись с обводкой; шрифт ужимается, чтобы влезть в ширину. */
function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxWidth: number) {
  const family = globalThis.getComputedStyle(g.canvas).fontFamily;
  let px = size;
  g.font = `900 ${px}px ${family}`;
  const w = g.measureText(text).width;
  if (w > maxWidth) {
    px = Math.floor((px * maxWidth) / w);
    g.font = `900 ${px}px ${family}`;
  }
  g.lineWidth = Math.max(4, px * 0.14);
  g.strokeText(text, x, y);
  g.fillText(text, x, y);
}

function drawBack(g: CanvasRenderingContext2D, kit: Kit, box: BodyBox, back: ShirtBack): void {
  const w = 1 / box.sx;
  const h = 1 / box.sy;
  const cx = box.x0 + w / 2;
  const ink = shirtInk(kit);
  g.fillStyle = ink.fill;
  g.strokeStyle = ink.outline;
  g.lineJoin = 'round';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (back.name !== '') label(g, back.name.toUpperCase(), cx, box.y0 + h * 0.24, h * 0.11, w * 0.72);
  if (back.number !== null) label(g, String(back.number), cx, box.y0 + h * 0.56, h * 0.4, w * 0.7);
}

/** Цвета трёх зон шорт, гетр или бутс; нечего красить (нет формы или пары) — null. */
function zoneColors(): readonly [string, string, string] | null {
  if (props.view === 'boots') return props.boots ? bootsColors(props.boots) : null;
  if (!props.kit) return null;
  const { shorts, socks } = outfitFor(props.kit);
  if (props.view === 'shorts') return [shorts.body, shorts.stripe, shorts.waist];
  return [socks.leg, socks.top, socks.foot];
}

async function draw(): Promise<void> {
  const mine = ++drawing;
  const { layers, box, frame } = await loadKitBase(base.value);
  if (mine !== drawing) return;
  const { width: w, height: h } = layers;
  const c = cropOf(frame, w, h);
  // Размер холста ставит Vue (атрибуты width/height): смена размера стирает картинку, поэтому
  // рисуем после того, как он применён, а не до.
  size.value = { w: c.w, h: c.h };
  await nextTick();
  const el = canvas.value;
  const g = el?.getContext('2d');
  if (!el || !g || mine !== drawing) return;
  const kit = props.kit;
  let rgba: Uint8ClampedArray<ArrayBuffer> | null = null;
  if (props.view === 'front') {
    if (kit) rgba = paintKit(layers, kit, box ?? undefined);
  } else {
    const colors = zoneColors();
    if (colors) rgba = paintZones(layers, colors);
  }
  if (!rgba) return;
  // putImageData заменяет все пиксели холста (с прозрачностью): прежняя картинка не просвечивает.
  g.putImageData(new ImageData(rgba, w, h), -c.x, -c.y, c.x, c.y, c.w, c.h);
  if (props.view === 'front' && props.back && kit && box) {
    // Шрифт мог ещё не загрузиться — тогда надпись вышла бы запасным шрифтом.
    await el.ownerDocument.fonts.ready;
    if (mine !== drawing) return;
    drawBack(g, kit, box, props.back);
  }
  emit('drawn', el);
}

const ariaLabel = computed(() => {
  if (props.view === 'boots') return props.boots?.name ?? '';
  const name = props.kit?.name ?? '';
  if (props.view === 'shorts') return `${name}: ${ru.boots.shorts}`;
  if (props.view === 'socks') return `${name}: ${ru.boots.socks}`;
  return props.back ? `${name}: ${props.back.name} ${props.back.number ?? ''}`.trim() : name;
});

onMounted(() => void draw());
watch(
  () => [props.kit, props.view, props.boots, props.back === null, props.back?.name, props.back?.number],
  () => void draw(),
);
</script>

<template>
  <canvas
    ref="canvas"
    class="kit"
    :class="{ item: view !== 'front' }"
    role="img"
    :aria-label="ariaLabel"
    :width="size.w"
    :height="size.h"
  />
</template>

<style scoped>
.kit {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  filter: drop-shadow(0 8px 12px rgb(0 0 0 / 0.55));
}

/* Шорты, гетры, бутсы обрезаны по рамке: пропорции — от холста. */
.kit.item {
  aspect-ratio: auto;
  filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.5));
}
</style>
