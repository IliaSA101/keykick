<script setup lang="ts">
/**
 * Витрина Лавки (Э2К.01): сетка вещей 4×3, у каждой одно из состояний — «Купить ●» (хватает), «ещё N» (копим), «с урока N» (рано),
 * «куплено · на Доме». Мечта помечена. Рамка фокуса — белая, не золотая: рядом с вещами с синим (049-Р31).
 */
import { fill } from '../../app/home/texts';
import type { ShopItem } from '../../app/shop/input';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitTag from '../../components/kit/KitTag.vue';
import { ru } from '../../i18n/ru';
import ShopThumb from './ShopThumb.vue';

defineProps<{ items: ShopItem[]; dream: string | null; locked: boolean; focus?: string | undefined; height: number }>();
defineEmits<{ buy: [id: string] }>();
const t = ru.shop;
</script>

<template>
  <div class="g4">
    <div
      v-for="c in items"
      :key="c.id"
      class="item"
      :class="[c.state, { focus: c.id === focus }]"
    >
      <i
        v-if="c.id === dream"
        class="dream"
      >{{ t.dreamBadge }}</i>
      <ShopThumb
        :id="c.id"
        :height="height"
        :off="c.state === 'later'"
      />
      <b>{{ c.name }}</b>
      <span class="where">{{ t.where[c.id] }}</span>
      <div class="foot">
        <KitTag
          v-if="c.state === 'bought'"
          kind="ok"
        >
          {{ t.bought }}
        </KitTag>
        <KeyButton
          v-else-if="c.state === 'can'"
          md
          :state="locked ? 'off' : undefined"
          @click="$emit('buy', c.id)"
        >
          {{ t.buy }} {{ c.price }}&nbsp;{{ t.coin }}
        </KeyButton>
        <template v-else-if="c.state === 'save'">
          <span class="price">{{ c.price }}&nbsp;{{ t.coin }}</span><span class="left">{{ fill(t.left, { n: c.left }) }}</span>
        </template>
        <template v-else>
          <span class="price off">{{ c.price }}&nbsp;{{ t.coin }}</span><span class="left">{{ fill(t.from, { n: c.from }) }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css) */
.g4 { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, 1fr); gap: 8px; height: 100%; }
.item { position: relative; display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 6px 8px 7px; border-radius: 12px; background: #1a1c45; border: 1.5px solid #2b2f72; font-size: 12px; }
.item b { flex: none; font-size: 13px; line-height: 1.15; white-space: nowrap; letter-spacing: -0.02em; }
.item.bought { border-color: #5fae7d; }
.item.later { opacity: 0.72; }
.item.focus { outline: 3px solid #fff; outline-offset: 1px; }
.dream { position: absolute; left: 8px; top: 8px; z-index: 2; padding: 1px 7px; border-radius: 9px; background: #9fe3b8; color: #0d2a1a; font-style: normal; font-size: 11px; font-weight: 900; }
.where { font-size: 12px; line-height: 1.15; color: var(--text-muted); }
.foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.price { font-size: 13px; font-weight: 800; }
.price.off { opacity: 0.6; }
.left { font-size: 11px; font-weight: 800; color: #c9c6ec; }
</style>
