<script setup lang="ts">
/**
 * Подтверждение покупки (Э2К.03, ТЗ-3.9): после «Купить» отмены нет; «Не сейчас» (Esc) закрывает окно. Двойной Enter — одна покупка:
 * окно отдаёт `buy` один раз, дальше кнопки молчат до закрытия (`sent`), а списание держит ещё и `ref` покупки в движке.
 */
import { ref } from 'vue';
import { fill } from '../../app/home/texts';
import { coin, type ShopItem } from '../../app/shop/input';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import { ENTER_DELAY } from '../../components/panel/focusCycle';
import { ru } from '../../i18n/ru';
import ShopThumb from './ShopThumb.vue';

const props = defineProps<{ item: ShopItem; coins: number }>();
const emit = defineEmits<{ buy: []; close: [] }>();
const t = ru.shop;
const sent = ref(false);
function buy(): void {
  if (sent.value) return;
  sent.value = true;
  emit('buy');
}
</script>

<template>
  <KitModal
    :title="fill(t.confirm.title, { name: item.name })"
    :lead="fill(t.confirm.lead, { price: coin(item.price), rest: coin(coins - item.price) })"
    :width="480"
    :top="110"
    :enter-delay="ENTER_DELAY"
    @close="emit('close')"
  >
    <ShopThumb
      :id="item.id"
      :height="116"
      tall
    />
    <p class="muted">
      {{ fill(t.confirm.where, { where: t.where[props.item.id] ?? '' }) }}
    </p>
    <template #buttons>
      <KeyButton
        primary
        :sub="ru.kit.enter"
        @click="buy"
      >
        {{ t.buy }}
      </KeyButton>
      <KeyButton
        quiet
        :sub="ru.kit.esc"
        @click="emit('close')"
      >
        {{ t.confirm.no }}
      </KeyButton>
    </template>
  </KitModal>
</template>

<style scoped>
.muted { margin: 6px 0 0; font-size: 13px; color: var(--text-muted); }
</style>
