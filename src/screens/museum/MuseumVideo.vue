<script setup lang="ts">
/**
 * Ролик Двора на телевизоре Музея (068 Т11, ТЗ-9.7): после титула телевизор проигрывает ролик по запросу. Окно — общее с титулом Кубка
 * (`components/story/TitleVideo.vue`), здесь только подпись кнопки «в Музей · Esc».
 */
import { fill } from '../../app/home/texts';
import TitleVideo from '../../components/story/TitleVideo.vue';
import { ru } from '../../i18n/ru';

const emit = defineEmits<{ close: [] }>();
const label = fill(ru.story.close, { to: ru.story.museum });
</script>

<template>
  <TitleVideo
    :label="label"
    :aria="ru.museum.videoTitle"
    @close="emit('close')"
  />
</template>
