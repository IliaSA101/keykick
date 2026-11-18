<script setup lang="ts">
/**
 * Плашка «Капитан вернулся!» над вступлением матча (065 Т10г, Э1.25, 065-Р112): возврат после паузы в несколько дней (ТЗ-2.11).
 * Только показ. Тёмно-синяя плашка с золотым заголовком — золото здесь цвет главного, без рамки и свечения (ТАБУ 14.11).
 */
import { ru } from '../../i18n/ru';

const t = ru.match.banner;
</script>

<template>
  <p
    class="comeback"
    data-banner="comeback"
  >
    {{ t.comeback }}
    <span>{{ t.comebackSub }}</span>
  </p>
</template>

<style scoped>
.comeback {
  position: absolute;
  top: 170px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 4px 18px;
  border-radius: 16px;
  background: rgb(21 20 58 / 0.85);
  color: var(--accent);
  font-size: 26px;
  font-weight: 800;
  white-space: nowrap;
  text-align: center;
  text-shadow: 0 2px 8px rgb(0 0 0 / 0.9);
}
.comeback span { color: var(--text); font-weight: 700; font-size: 17px; }
</style>
