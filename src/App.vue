<script setup lang="ts">
/** Оболочка: сцена-масштаб, шапка, окно маршрута, плашка сеанса, служебные окна (обновление, квота). Входные экраны (`meta.bare`) — без шапки; меню игрока — в шапке (068-Р82). */
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useSession } from './app/save/session';
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
      :page="route.query.win === 'club' ? 'club' : String(route.meta.menu ?? route.name ?? '')"
    />
    <RouterView />
    <SessionNotice
      :status="session.status.value"
      :player-name="name"
    />
    <SystemWindows />
  </StageScale>
</template>
