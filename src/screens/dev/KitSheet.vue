<script setup lang="ts">
/**
 * Лист сверки частей ЭБ живыми компонентами (`#/dev/kit?s=header|buttons|panels|modals|shell`, только в разработке).
 * Разделы — `Sheet*.vue` (по одному на кадр). «Сломать» подключает только этот файл (страж С5). Каждый раздел — кадр, который снимают на
 * 1920×1080 и 1024×640 рядом с `docs/mockups/kit/png/eb-*` (063 К7).
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ru } from '../../i18n/ru';
import BreakButton from './BreakButton.vue';
import SheetButtons from './SheetButtons.vue';
import SheetHeader from './SheetHeader.vue';
import SheetModals from './SheetModals.vue';
import SheetPanels from './SheetPanels.vue';
import SheetShell from './SheetShell.vue';

const t = ru.kit.sheet;
const SECTIONS = ['header', 'buttons', 'panels', 'modals', 'shell'] as const;
type Section = (typeof SECTIONS)[number];

const route = useRoute();
const section = computed<Section>(() => SECTIONS.find((s) => s === route.query.s) ?? 'header');
// разделы с настоящей шапкой наверху: заголовок листа — внизу, как на eb-panels и eb-modals (иначе он лежит на шапке)
const low = computed(() => section.value === 'panels' || section.value === 'modals' || section.value === 'shell');
const title: Record<Section, string> = { header: t.header, buttons: t.buttons, panels: t.panels, modals: t.modals, shell: t.shell };
</script>

<template>
  <div class="kit-sheet">
    <h1
      class="eb-title"
      :class="{ low }"
    >
      {{ t.title }} <span>{{ title[section] }}</span>
    </h1>

    <SheetHeader v-if="section === 'header'" />
    <SheetButtons v-else-if="section === 'buttons'" />
    <SheetPanels v-else-if="section === 'panels'" />
    <SheetModals v-else-if="section === 'modals'">
      <BreakButton />
    </SheetModals>
    <SheetShell v-else />

    <nav class="eb-nav">
      <a
        v-for="s in SECTIONS"
        :key="s"
        :href="`#/dev/kit?s=${s}`"
      >{{ s }}</a>
    </nav>
  </div>
</template>

<style>
/* без scoped: разделы — дочерние компоненты, их разметка не получает метку родителя; префикс .kit-sheet держит (не `.sheet`: так зовётся лист задачи, task.css) правила в листе */
.kit-sheet {
  position: absolute;
  inset: 0;
}
.kit-sheet .eb-title {
  position: absolute;
  left: 16px;
  top: 8px;
  z-index: 30;
  margin: 0;
  font-size: 19px;
  font-weight: 900;
}
.kit-sheet .eb-title.low {
  top: 612px;
}
.kit-sheet .eb-title span {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
}
.kit-sheet .eb-lab {
  position: absolute;
  z-index: 30;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.kit-sheet .eb-row {
  position: absolute;
  left: 0;
  right: 0;
  height: 40px;
}
.kit-sheet .eb-at {
  position: absolute;
}
.kit-sheet .eb-nav {
  position: absolute;
  right: 16px;
  bottom: 8px;
  z-index: 30;
  display: flex;
  gap: 12px;
  font-size: 12px;
}
.kit-sheet .eb-nav a {
  color: var(--text-muted);
}
</style>
