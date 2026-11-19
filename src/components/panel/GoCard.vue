<script setup lang="ts">
/**
 * Карточка «На матч» — `goCard` из kit.mjs: главная на экране (Дом, карта). Лента `lead` над кнопкой (первая строка; `chip` — метка вида
 * урока в её конце, `lead2` — вторая строка), главная кнопка с Enter, строка `where` под ней (`cup` — с флажком Кубка перед текстом), под ней — `record` («рекорд N знаков в минуту», как на Доме).
 * variant — 'home' (Дом) | 'map' (карта, чуть меньше). Место — style снаружи.
 */
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';

withDefaults(
  defineProps<{ lead: string; lead2?: string; chip?: string; chipKind?: '' | 'nt'; where?: string; record?: string; cup?: boolean; action?: string; variant?: 'home' | 'map' }>(),
  { lead2: '', chip: '', chipKind: '', where: '', record: '', cup: false, action: ru.kit.go, variant: 'home' },
);
defineEmits<{ go: [] }>();
</script>

<template>
  <div
    class="card panel soft gocard"
    :class="variant === 'map' ? 'sm map' : 'home'"
  >
    <p class="lk">
      <span class="gc-line">{{ lead }}<span
        v-if="chip"
        class="kb-tag"
        :class="chipKind"
      >{{ chip }}</span></span>
      <span
        v-if="lead2"
        class="gc-line"
      >{{ lead2 }}</span>
    </p>
    <KeyButton
      primary
      md
      :sub="ru.kit.enter"
      @click="$emit('go')"
    >
      {{ action }}
    </KeyButton>
    <p class="where">
      <svg
        v-if="cup && where"
        class="flag"
        viewBox="0 0 12 14"
        aria-hidden="true"
      ><path
        d="M1.5 1v12"
        stroke="currentColor"
        stroke-width="1.6"
      /><path
        d="M2.5 1.5h8l-2 3 2 3h-8z"
        fill="var(--map-flag)"
      /></svg>
      {{ where }}<template v-if="record">
        <br><span class="nb">{{ record }}</span>
      </template>
    </p>
  </div>
</template>

<style scoped>
.gc-line {
  display: block;
  white-space: nowrap;
}
.gc-line .kb-tag {
  margin-left: 6px;
}
</style>
