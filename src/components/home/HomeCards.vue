<script setup lang="ts">
/**
 * Нижний ряд Дома (065 Т7, 048 §4): главная карточка «На матч», чип «Карта» и карточка Кубка. Enter и переход — у экрана:
 * карточка только сообщает `play`, `map`, `cup`.
 */
import { cupText, mainText } from '../../app/home/texts';
import CupCard from '../../components/league/CupCard.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitChip from '../../components/kit/KitChip.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import KitTag from '../../components/kit/KitTag.vue';
import { ru } from '../../i18n/ru';

defineProps<{ main: ReturnType<typeof mainText>; cup: ReturnType<typeof cupText>; width: number; narrow: boolean; canPlay: boolean }>();
const emit = defineEmits<{ play: []; map: []; cup: [] }>();
const t = ru.home;
</script>

<template>
  <KitPanel
    soft
    class="gocard home"
    :style="{ left: `${width / 2 - (narrow ? 170 : 200)}px`, bottom: '8px', width: `${narrow ? 340 : 400}px` }"
  >
    <p class="lk">
      {{ main.lead }}<br v-if="main.tag">
      <KitTag
        v-if="main.tag?.kind === 'nt'"
        kind="nt"
      >
        {{ main.tag.text }}
      </KitTag>
      <KitTag v-else-if="main.tag">
        {{ main.tag.text }}
      </KitTag>
    </p>
    <KeyButton
      primary
      md
      :sub="ru.kit.enter"
      :disabled="!canPlay"
      @click="emit('play')"
    >
      {{ main.action }}
    </KeyButton>
    <p class="where">
      {{ main.where }}<template v-if="main.record">
        <br v-if="narrow"><template v-else>
          ·
        </template><span class="nb">{{ main.record }}</span>
      </template>
    </p>
  </KitPanel>
  <div
    class="homerow"
    :style="{ left: `${width / 2 + (narrow ? 170 : 200) + 10}px` }"
  >
    <KitChip @click="emit('map')">
      {{ t.mapChip }}
    </KitChip>
    <CupCard
      :name="t.cup.name"
      :state="cup.state"
      :sub="cup.sub"
      @click="emit('cup')"
    />
  </div>
</template>

<style scoped>
.gocard,
.homerow {
  position: absolute;
  z-index: 3;
}
.homerow {
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 96px;
}
</style>
