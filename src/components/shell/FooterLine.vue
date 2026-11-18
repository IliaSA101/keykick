<script setup lang="ts">
/**
 * Строка низа (лист Э6): «Игрок: имя · сменить · v2.0 (Что нового) · Старая версия». На узкой сцене (1024) — две строки не шире 310 px,
 * левее карточки «На матч»; на широкой (1920) — одна строка, как в кадре Э2.01 (`footerHtml(s, size !== 1920)`, 065-Р160).
 * «v2.0 (Что нового)» — не ссылка (063-Р67): текст как есть, без подчёркивания и указателя; окно «Что нового» — только по Р58. Родителю ссылки нет (063 §1, З3).
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { isNarrowStage, stageScale } from './stageScale';
import { APP_VERSION } from '../../engine/save/envelope';
import { ru } from '../../i18n/ru';
import { clipName, oldVersionUrl } from './footer';

defineProps<{ name: string }>();
const version = APP_VERSION.split('.').slice(0, 2).join('.');
const oldUrl = oldVersionUrl(import.meta.env.BASE_URL);
const narrowOf = (): boolean => isNarrowStage(stageScale(globalThis.innerWidth, globalThis.innerHeight).width);
const narrow = ref(narrowOf());
const onResize = (): void => void (narrow.value = narrowOf());
onMounted(() => globalThis.addEventListener('resize', onResize));
onUnmounted(() => globalThis.removeEventListener('resize', onResize));
</script>

<template>
  <div
    class="cnote light who"
    :class="{ wide: !narrow }"
  >
    <span
      class="pl"
      :title="name"
    >{{ ru.frame.footer.player }} {{ clipName(name) }}</span> ·
    <a href="#/who">{{ ru.frame.footer.change }}</a><br v-if="narrow"><template v-else>
      ·
    </template>
    <span class="ver">v{{ version }} ({{ ru.frame.footer.news }})</span> ·
    <a
      :href="oldUrl"
      target="_blank"
      rel="noopener"
    >{{ ru.frame.footer.oldVersion }}</a>
  </div>
</template>
