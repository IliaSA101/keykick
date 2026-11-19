<script setup lang="ts">
/**
 * Кнопки итога игры на интерес (Чеканка, Мемори; 067-Р221): «Ещё раз» с остатком дня и Enter (пока игры дня есть),
 * иначе «на сегодня закончились», и «На Базу · Esc».
 */
import { fill } from '../../app/home/texts';
import KeyButton from '../../components/kit/KeyButton.vue';
import { ru } from '../../i18n/ru';

defineProps<{ left: number }>();
defineEmits<{ again: []; out: [] }>();
</script>

<template>
  <KeyButton
    v-if="left > 0"
    primary
    md
    @click="$emit('again')"
  >
    {{ ru.match.again }}
    <template #sub>
      {{ fill(ru.base.keepy.againLeft, { n: left }) }} · {{ ru.kit.enter }}
    </template>
  </KeyButton>
  <small v-else>{{ ru.base.keepy.spent }}</small>
  <KeyButton
    quiet
    md
    :sub="ru.kit.esc"
    @click="$emit('out')"
  >
    {{ ru.learn.end.base }}
  </KeyButton>
</template>

<style scoped>
small { font-size: 12px; color: var(--text-muted); }
</style>
