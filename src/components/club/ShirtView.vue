<script setup lang="ts">
/**
 * Часть формы клуба на холсте (лист Э2К.36; 065 Т9д — шорты и гетры): футболка — общая основа из `public/art/kit` + перекраска движком `paintKit`; шорты и гетры (`part`) — свои слои, цвета из `outfitFor`.
 * `crop` — холст по рамке самого предмета (поля слоя убраны): ширина компонента — ширина предмета, как в раскладке кадров Э1.
 * Спереди или сзади (с именем и номером на спине, цвет надписи выбирает `shirtInk`). Основа грузится один раз на всё приложение.
 * Картинка берётся через `Image` и `createImageBitmap` без пересчёта цвета: слои без альфы, доли зон не должны сдвигаться.
 */
import { nextTick, onMounted, ref, watch } from 'vue';
import { artUrl, type ArtKey } from '../../art/assets';
import { bodyBox, paintKit, shirtInk, type BodyBox, type KitLayers } from '../../engine/club/paint';
import { opaqueBox, outfitFor, paintZones, type OpaqueBox } from '../../engine/club/outfit';
import type { ClubKit } from '../../engine/club/section';

const props = withDefaults(defineProps<{ kit: ClubKit; back?: { name: string; number: number } | null; label?: string; part?: 'shirt' | 'shorts' | 'socks'; crop?: boolean }>(), { back: null, label: '', part: 'shirt', crop: false });

interface Base {
  layers: KitLayers;
  box: BodyBox | null;
  frame: OpaqueBox | null;
}
type View = 'front' | 'back' | 'shorts' | 'socks';
const KEYS: Record<View, [ArtKey, ArtKey]> = {
  front: ['kitZones', 'kitShade'],
  back: ['kitBackZones', 'kitBackShade'],
  shorts: ['shortsZones', 'shortsShade'],
  socks: ['socksZones', 'socksShade'],
};
const pending: Partial<Record<View, Promise<Base>>> = {};

async function pixels(key: ArtKey): Promise<ImageData> {
  const img = new globalThis.Image();
  img.src = artUrl(key);
  await img.decode();
  const bitmap = await globalThis.createImageBitmap(img, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('2d context is not available');
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  return g.getImageData(0, 0, c.width, c.height);
}

function loadBase(view: View): Promise<Base> {
  pending[view] ??= Promise.all([pixels(KEYS[view][0]), pixels(KEYS[view][1])])
    .then(([zones, shade]) => {
      const layers: KitLayers = { width: zones.width, height: zones.height, zones: zones.data, shade: shade.data };
      return { layers, box: view === 'front' || view === 'back' ? bodyBox(layers, view === 'back') : null, frame: opaqueBox(layers) };
    })
    .catch((e: unknown) => {
      delete pending[view]; // сбой сети не оставляет форму пустой навсегда: следующий показ пробует снова
      throw e;
    });
  return pending[view];
}

const canvas = ref<HTMLCanvasElement | null>(null);
let drawing = 0;
const size = ref({ w: 640, h: 640 });

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, maxWidth: number): void {
  const family = globalThis.getComputedStyle(g.canvas).fontFamily;
  let px = size;
  g.font = `900 ${px}px ${family}`;
  const w = g.measureText(s).width;
  if (w > maxWidth) {
    px = Math.floor((px * maxWidth) / w);
    g.font = `900 ${px}px ${family}`;
  }
  g.lineWidth = Math.max(4, px * 0.14);
  g.strokeText(s, x, y);
  g.fillText(s, x, y);
}

async function draw(): Promise<void> {
  const mine = ++drawing;
  const view: View = props.part === 'shirt' ? (props.back ? 'back' : 'front') : props.part;
  const { layers, box, frame } = await loadBase(view);
  if (mine !== drawing) return;
  // обрезка по рамке предмета; смена размера холста стирает картинку, поэтому рисуем после того, как Vue применил размер
  const c = props.crop && frame ? { x: Math.round(frame.x * layers.width), y: Math.round(frame.y * layers.height), w: Math.round(frame.w * layers.width), h: Math.round(frame.h * layers.height) } : { x: 0, y: 0, w: layers.width, h: layers.height };
  size.value = { w: c.w, h: c.h };
  await nextTick();
  const el = canvas.value;
  const g = el?.getContext('2d');
  if (!el || !g || mine !== drawing) return;
  let rgba: Uint8ClampedArray<ArrayBuffer>;
  if (props.part === 'shirt' && box) rgba = paintKit(layers, props.kit, box);
  else {
    const o = outfitFor(props.kit);
    rgba = paintZones(layers, props.part === 'shorts' ? [o.shorts.body, o.shorts.stripe, o.shorts.waist] : [o.socks.leg, o.socks.top, o.socks.foot]);
  }
  g.putImageData(new ImageData(rgba, layers.width, layers.height), -c.x, -c.y, c.x, c.y, c.w, c.h);
  if (props.part === 'shirt' && props.back && box) {
    g.setTransform(1, 0, 0, 1, -c.x, -c.y); // надпись в координатах слоя, холст обрезан
    await el.ownerDocument.fonts.ready;
    if (mine !== drawing) return;
    const w = 1 / box.sx;
    const h = 1 / box.sy;
    const cx = box.x0 + w / 2;
    const ink = shirtInk(props.kit);
    g.fillStyle = ink.fill;
    g.strokeStyle = ink.outline;
    g.lineJoin = 'round';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (props.back.name !== '') text(g, props.back.name.toUpperCase(), cx, box.y0 + h * 0.24, h * 0.11, w * 0.72);
    if (props.back.number > 0) text(g, String(props.back.number), cx, box.y0 + h * 0.56, h * 0.4, w * 0.7);
  }
}

// сбой загрузки основы не роняет экран: форма просто не рисуется
const safe = (): void => void draw().catch(() => undefined);
onMounted(safe);
watch(() => [props.kit, props.back?.name, props.back?.number, props.part, props.crop], safe);
</script>

<template>
  <canvas
    ref="canvas"
    class="shirt"
    :class="{ crop }"
    role="img"
    :aria-label="label"
    :width="size.w"
    :height="size.h"
  />
</template>

<style scoped>
.shirt {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  filter: drop-shadow(0 8px 12px rgb(0 0 0 / 0.55));
}

/* по рамке предмета: пропорции — от холста, а не квадрат */
.shirt.crop {
  aspect-ratio: auto;
}
</style>
