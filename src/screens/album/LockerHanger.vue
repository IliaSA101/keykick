<script setup lang="ts">
/**
 * Форма на вешалке в открытом шкафчике (067 Т13; Э2К.11–21, 42; 049-Р32, Р41, Р44, Р48): над крючком — табличка «На тебе» с именем формы,
 * на плечиках — спина формы с именем и номером ребёнка (вид `hang`, рукава опущены), на нижней штанге шорты на вешалке с зажимами и гетры
 * парой через штангу. Блок вешалки — 160×440 на `cx − 80`, 216 (числа — `hangerGeo.ts`, макет e2k-kit.mjs); штанги, крючок и свет — `HangerRig`.
 * Заплаты стены закрывают старую вешалку и крюк фона, лампа и затемнение низа — как в макете (collection-e-locker.css). Бутсы — на полу шкафчика.
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import ShirtView from '../../components/club/ShirtView.vue';
import type { KitDeco } from '../../engine/club/paint';
import type { ClubKit } from '../../engine/club/section';
import { ru } from '../../i18n/ru';
import HangerRig from './HangerRig.vue';
import { BOOTS, HG, SHIRT, SHIRT_L, SHORTS, SOCKS } from './hangerGeo';

const props = defineProps<{ cx: number; ox: number; rodEnd: number; kit: ClubKit; deco: KitDeco; back: { name: string; number: number }; name: string; boots: string }>();
const t = ru.album.locker;
const scene = computed(() => artUrl('albumLockerIn'));
/** Заплата стены: кусок той же сцены (200 px ниже), края растушёваны; `dy` — на сколько выше взят кусок. */
const patch = (left: number, top: number, w: number, h: number, srcX: number, srcY: number, extra = ''): Record<string, string> => ({
  left: `${left}px`,
  top: `${top}px`,
  width: `${w}px`,
  height: `${h}px`,
  backgroundImage: `linear-gradient(#000d 0, #000b 55%, #0000), url(${scene.value})`,
  backgroundPosition: `0 -${top}px, ${-Math.round(srcX)}px ${-srcY}px`,
  ...(extra === '' ? {} : { maskImage: extra }),
});
const wall = computed(() => patch(props.cx - 78, 150, 156, 86, props.cx - 78 + props.ox, 250));
const roof = computed(() => patch(props.cx - 22, 104, 44, 36, props.cx - 22 + props.ox + 46, 104, 'linear-gradient(90deg,transparent,#000 14% 86%,transparent)'));
const part = (l: number, tp: number, w: number, h: number): Record<string, string> => ({ left: `${l}px`, top: `${tp}px`, width: `${w}px`, height: `${h}px` });
</script>

<template>
  <div class="hanger">
    <i
      class="wall"
      :style="wall"
    />
    <i
      class="wall"
      :style="roof"
    />
    <div
      class="lamp"
      :style="{ left: `${cx - 150}px` }"
    />
    <i
      class="dark"
      :style="{ left: `${cx - 70}px` }"
    />
    <div
      class="hg"
      :style="{ left: `${cx - 80}px` }"
    >
      <HangerRig :rod-end="rodEnd" />
      <span class="item w2">
        <span
          class="part"
          :style="part(SHIRT_L, SHIRT.t, SHIRT.w, SHIRT.h)"
        >
          <ShirtView
            class="f-shirt"
            :kit="kit"
            :deco="deco"
            :back="back"
            :label="t.hangerAlt.replace('{name}', name)"
            part="hang"
            crop
          />
        </span>
      </span>
      <span class="item w2">
        <span
          class="part"
          :style="part(SHORTS.l, SHORTS.t, SHORTS.w, SHORTS.h)"
        >
          <ShirtView
            class="f-shorts"
            :kit="kit"
            part="shortsHang"
            label=""
            crop
          />
        </span>
      </span>
      <span class="item w2">
        <span
          class="part"
          :style="part(SOCKS.l, SOCKS.t, SOCKS.w, SOCKS.h)"
        >
          <ShirtView
            class="f-base"
            :kit="kit"
            part="socksBar"
            label=""
            crop
          />
        </span>
      </span>
      <i
        class="floor"
        :style="{ left: `${80 - BOOTS.w / 2 - 12}px`, top: `${296 + HG.bootsH - 4}px`, width: `${BOOTS.w + 24}px` }"
      />
      <span class="item w2">
        <img
          class="boots"
          :src="boots"
          alt=""
          :style="{ left: `${80 - BOOTS.w / 2}px`, top: '296px', width: `${BOOTS.w}px`, height: `${BOOTS.h}px` }"
        >
      </span>
    </div>
    <div
      class="plate"
      :style="{ left: `${cx - 68}px` }"
    >
      <img
        :src="artUrl('albumPlate')"
        alt=""
      >
      <b>{{ t.worn }}</b>
      <i>{{ name }}</i>
    </div>
  </div>
</template>

<style scoped>
.hanger { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.wall { position: absolute; z-index: 2; background-repeat: no-repeat; background-size: 100% 170px, 1146px 640px; mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent), linear-gradient(180deg, transparent, #000 18%, #000 93%, transparent); mask-composite: intersect; }
/* свет лампы сцены: тёплое пятно по центру футболки, слабое, чтобы не желтить синее (ТАБУ) */
.lamp { position: absolute; top: 96px; width: 300px; height: 460px; z-index: 4; background: radial-gradient(ellipse 130px 150px at 150px 200px, rgb(255 200 140 / 0.18), transparent 100%); }
/* затемнение низа шкафчика: слой по внутренности, края растушёваны со всех сторон */
.dark { position: absolute; top: 440px; width: 140px; height: 100px; z-index: 4; background: linear-gradient(transparent, rgb(0 0 0 / 0.14)); mask-image: linear-gradient(90deg, transparent, #000 14% 86%, transparent), linear-gradient(transparent, #000 45% 80%, transparent); mask-composite: intersect; }
.hg { position: absolute; top: 216px; width: 160px; height: 440px; z-index: 3; }
.item { position: absolute; inset: 0; display: block; filter: drop-shadow(-2px 3px 1px rgb(40 14 6 / 0.5)) drop-shadow(-8px 12px 9px rgb(40 14 6 / 0.32)); }
.w2 { z-index: 2; }
.part { position: absolute; display: block; isolation: isolate; }
/* холст формы — по рамке спрайта, свет — SVG-фильтр `HangerRig` (у футболки и шорт свой, у гетр общий) */
.part :deep(.shirt) { position: absolute; inset: 0; width: 100%; height: 100%; aspect-ratio: auto; filter: none; }
.part :deep(.f-shirt) { filter: url(#hgt-shirt); }
.part :deep(.f-shorts) { filter: url(#hgt-shorts); }
.part :deep(.f-base) { filter: url(#hgt-base); }
.plate { position: absolute; top: 134px; width: 136px; height: 40px; z-index: 4; display: grid; place-items: center; text-align: center; }
.plate::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 8px; background: linear-gradient(rgb(0 0 0 / 0.18), transparent); border-radius: 3px 3px 0 0; }
.plate img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; }
.plate b, .plate i { position: relative; font-style: normal; line-height: 1.1; color: #3b2814; }
.plate b { font-size: 16px; line-height: 1; }
.plate i { font-size: 12px; font-weight: 700; }
.floor { position: absolute; height: 8px; background: radial-gradient(closest-side, rgb(30 10 4 / 0.6), #0000); z-index: 1; }
.boots { position: absolute; display: block; }
</style>
