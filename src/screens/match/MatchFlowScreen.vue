<script setup lang="ts">
/*
 * Страница матча v2 (#/match, спека 017-Т5в): оболочка над `MatchFlowPage`. Ключ — весь адрес: смена query на том же
 * маршруте (`?lesson=…` → `?at=loss&lesson=…`, позже «следующий урок», Т8) пересоздаёт страницу, а с ней и поток
 * (старый получает `dispose()` при размонтировании) — иначе остался бы матч прежнего урока (проверка в браузере, 017-Т6д).
 */
import { useRoute } from 'vue-router';
import MatchFlowPage from './MatchFlowPage.vue';

const route = useRoute();
</script>

<template>
  <MatchFlowPage :key="route.fullPath" />
</template>
