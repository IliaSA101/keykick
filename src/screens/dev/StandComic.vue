<script setup lang="ts">
/**
 * Окно комикса на стенде кадров (068 Т7): отдельный компонент по образцу `StandNews` — `useComicView` берёт сеанс фикстуры, а не браузера.
 * Комикс и число открытых панелей — из фикстуры (`story.window.comic`, `panel`); в игре окно открывает вход на Дом.
 */
import ComicWindow from '../../components/story/ComicWindow.vue';
import { useComicView } from '../../app/story/useComicView';
import type { ComicId } from '../../engine/story';
import type { FrameFixture } from './frameSession';

const p = defineProps<{ story: NonNullable<FrameFixture['story']> }>();

const comic = useComicView(() => (p.story.window?.comic ?? null) as ComicId | null);
</script>

<template>
  <ComicWindow
    v-if="comic"
    :view="comic.view"
    :coach="comic.coach"
    :panel="story.window?.panel ?? 2"
  />
</template>
