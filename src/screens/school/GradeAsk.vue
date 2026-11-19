<script setup lang="ts">
/**
 * Вопрос «В каком ты классе?» (Э3.08): один раз при первом входе в Школу. Цифры 1–8 или клик; Esc — Дом (класс не записан,
 * вопрос повторится). Что делать после ответа — решает экран: он пишет класс, вопрос исчезает сам (`needsGrade`).
 */
import { onMounted, onUnmounted } from 'vue';
import KitModal from '../../components/panel/KitModal.vue';
import { ru } from '../../i18n/ru';

const emit = defineEmits<{ pick: [grade: number]; close: [] }>();
const t = ru.school.grade;
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];
function onKey(e: KeyboardEvent): void {
  if (/^[1-8]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) emit('pick', Number(e.key));
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onUnmounted(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <KitModal
    :title="t.ask"
    :lead="t.lead"
    :note="t.note"
    :width="560"
    :top="150"
    @close="emit('close')"
  >
    <div class="row">
      <button
        v-for="g in GRADES"
        :key="g"
        type="button"
        class="g"
        @click="emit('pick', g)"
      >
        {{ g }}
      </button>
    </div>
  </KitModal>
</template>

<style scoped>
.row { display: flex; gap: 6px; justify-content: center; }
.g { box-sizing: border-box; width: 56px; height: 56px; border: 0; border-radius: 12px; background: rgb(255 255 255 / 0.14); box-shadow: inset 0 0 0 1.5px var(--border); color: var(--text); font: inherit; font-size: 22px; font-weight: 800; cursor: pointer; }
.g:hover, .g:focus-visible { background: #fff; color: #1c1c48; outline: none; }
</style>
