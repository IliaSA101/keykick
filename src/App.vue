<script setup lang="ts">
/** Оболочка: сцена-масштаб, шапка, окно маршрута, плашка сеанса, служебные окна (обновление, квота), строка низа. Входные экраны (`meta.bare`) — без шапки и низа. */
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useSession } from './app/save/session';
import FooterLine from './components/shell/FooterLine.vue';
import SessionNotice from './components/shell/SessionNotice.vue';
import ShellHeader from './components/shell/ShellHeader.vue';
import StageScale from './components/shell/StageScale.vue';
import SystemWindows from './screens/system/SystemWindows.vue';

const route = useRoute();
const session = useSession();
const bare = computed(() => route.meta.bare === true);
const name = computed(() => (session.player.value.kind === 'ok' ? session.player.value.env.name : ''));
</script>

<template>
  <StageScale>
    <ShellHeader
      v-if="!bare"
      :page="String(route.name ?? '')"
    />
    <RouterView />
    <SessionNotice
      :status="session.status.value"
      :player-name="name"
    />
    <SystemWindows />
    <FooterLine
      v-if="!bare && name !== ''"
      :name="name"
    />
  </StageScale>
</template>
