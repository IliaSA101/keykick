<script setup lang="ts">
/**
 * Окно «Стенгазета» на Доме (068 Т7, 023-Р35, Э6.10/.65): заголовок свежего выпуска, зелёная «Читать» и «старые выпуски — в Музее».
 * Окно — влево от стенда, хвост на метке стенда: вправо оно закрывало ярлык «Тренировочная база» (макет `newsCard`, рамка 945×548 в превью 1376).
 * Ничего не читает и не пишет: хозяин (Дом) даёт заголовок и держит открытость; Esc закрывает хозяин.
 */
import { computed } from 'vue';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';
import KitPanel from '../kit/KitPanel.vue';
import { K, offOf } from '../home/geometry';

const props = defineProps<{ head: string; width: number }>();
const emit = defineEmits<{ read: []; close: [] }>();

/** Ширина окна без полей (250) и поля панели; хвост — 14 px от правого края. */
const BODY_W = 250;
const PREVIEW = 1376;
const style = computed(() => {
  const k = (1920 * K) / PREVIEW; // картинка сцены 1920·K px, рамка стенда задана в превью 1376
  const left = Math.round(offOf(props.width) + 945 * k - (BODY_W + 24) + 24 - 16);
  return { left: `${left}px`, bottom: `${640 - Math.round(548 * k) + 18}px`, width: `${BODY_W + 24}px`, '--tail-x': 'calc(100% - 14px)' };
});
</script>

<template>
  <KitPanel
    soft
    class="pop tail stand-card"
    :style="style"
    role="dialog"
    :aria-label="ru.home.stand"
  >
    <div class="ph">
      <p class="lk">
        {{ ru.home.stand }}
      </p>
      <KeyButton
        quiet
        md
        :sub="ru.kit.esc"
        @click="emit('close')"
      >
        {{ ru.kit.close }}
      </KeyButton>
    </div>
    <b class="nm">{{ head }}</b>
    <div class="pact">
      <KeyButton
        primary
        md
        @click="emit('read')"
      >
        {{ ru.story.stand.read }}
      </KeyButton>
    </div>
    <p class="arch">
      {{ ru.story.stand.archive }}
    </p>
  </KitPanel>
</template>
