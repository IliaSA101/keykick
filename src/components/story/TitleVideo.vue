<script setup lang="ts">
/**
 * Окно ролика Двора (068 Т9 и Т11, ТЗ-9.7): один файл `video/yard-title.mp4` (`app/art/storyArt.ts`), грузится только при показе окна. Общее для титула
 * Кубка (после победы в финале) и телевизора Музея. Esc и Enter закрывают («пропустить»), Esc не уходит дальше — экран под окном остаётся.
 */
import { onBeforeUnmount, onMounted } from 'vue';
import { yardTitleVideoUrl } from '../../app/art/storyArt';
import KeyButton from '../kit/KeyButton.vue';

const props = defineProps<{ label: string; aria: string; /** Ролик кончился — окно закрывается само (титул Кубка); телевизор Музея ждёт кнопку. */ autoClose?: boolean }>();
const emit = defineEmits<{ close: [] }>();

function onKey(e: KeyboardEvent): void {
  const enter = e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement);
  if (e.key !== 'Escape' && !enter) return;
  e.preventDefault();
  e.stopPropagation();
  emit('close');
}
onMounted(() => globalThis.addEventListener('keydown', onKey, true));
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey, true));
</script>

<template>
  <div
    class="mv"
    role="dialog"
    aria-modal="true"
    :aria-label="aria"
  >
    <video
      :src="yardTitleVideoUrl()"
      controls
      autoplay
      playsinline
      @ended="props.autoClose && emit('close')"
    />
    <KeyButton
      md
      @click="emit('close')"
    >
      {{ label }}
    </KeyButton>
  </div>
</template>

<style scoped>
.mv {
  position: absolute;
  inset: 41px 0 0;
  z-index: 11;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #000d;
}
video {
  max-width: 80%;
  max-height: 80%;
  border-radius: 6px;
  background: #000;
}
</style>
