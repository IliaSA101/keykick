<script setup lang="ts">
/**
 * Картинка вещи для карточки Лавки (Э2К.01): готовая вырезка из кадра вещи макета (`public/art/shop`, строит `tools/mock-collection/shop_cut.py`),
 * вещь стоит на своём месте во дворе. Бутсы — пара на тёмной подложке (макет: `.ce-cut.boots`).
 * Высота — единицы макета: 70 у плитки, 116 у «мечты» и окна покупки (`tall`).
 */
import { computed } from 'vue';
import { artUrl, type ArtKey } from '../../art/assets';

const props = defineProps<{ id: string; height: number; tall?: boolean; off?: boolean }>();
const ART: Record<string, ArtKey> = {
  'gate-sticker': 'shopGateSticker',
  'center-circle': 'shopCenterCircle',
  'seats-club': 'shopSeatsClub',
  'net-flags': 'shopNetFlags',
  graffiti: 'shopGraffiti',
  drum: 'shopDrum',
  banner: 'shopBanner',
  garland: 'shopGarland',
  'goal-anim': 'shopGoalAnim',
  'yard-whole': 'shopYardWhole',
  'boots-yard': 'shopBootsYard',
  'boots-box': 'shopBootsBox',
};
const boots = computed(() => props.id.startsWith('boots'));
const src = computed(() => (ART[props.id] ? artUrl(ART[props.id]!) : ''));
</script>

<template>
  <div
    class="cut"
    :class="{ off, boots, tall }"
    :style="{ height: `${height}px` }"
    aria-hidden="true"
  >
    <img
      v-if="src"
      :class="boots ? 'shoe' : 'pic'"
      :style="boots ? { height: `${height - 8}px` } : undefined"
      :src="src"
      alt=""
    >
  </div>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css: .ce-cut) */
.cut { position: relative; border-radius: 8px; background-color: #11132e; overflow: hidden; }
.cut.tall { margin: 3px 0; }
.cut.off { filter: grayscale(0.6) brightness(0.8); }
.cut.boots { display: grid; place-items: center; background: radial-gradient(ellipse at 50% 45%, #23265d, #11122c 75%); }
.pic { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
.shoe { display: block; width: auto; }
</style>
