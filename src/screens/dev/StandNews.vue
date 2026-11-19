<script setup lang="ts">
/**
 * Окно газеты на стенде кадров (068 Т7): отдельный компонент, чтобы `useNewsView` (через `useHomeInput` — сеанс) брал сеанс
 * фикстуры. В setup стенда он брал сеанс браузера до `setSession` — кадры Э6 падали на «Ой, что-то сломалось».
 */
import NewsWindow from '../../components/story/NewsWindow.vue';
import { useNewsView } from '../../app/story/useNewsView';
import type { FrameFixture } from './frameSession';

const p = defineProps<{ story: NonNullable<FrameFixture['story']> }>();

const news = useNewsView(() => {
  const w = p.story.window;
  return w?.paper === undefined ? null : { n: w.paper, longName: p.story.longName, longCity: p.story.longCity, ...(w.archive === true ? { archive: true } : {}) };
});
</script>

<template>
  <NewsWindow
    v-if="news"
    :view="news.view"
    :color="news.color"
    :back="story.window?.archive ? 'museum' : 'home'"
    :archive="story.window?.archive === true"
    :foot="story.window?.foot === 'home' ? 'home' : 'close'"
  />
</template>
