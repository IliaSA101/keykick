<script setup lang="ts">
/** Плашка состояния сеанса под шапкой (`ok` — нет плашки): «уже играет в другой вкладке», «позови взрослого» и др. — по `status`. */
import { computed } from 'vue';
import EventPlate from '../panel/EventPlate.vue';
import { noticeFor, type ShellStatus } from './status';

const props = defineProps<{ status: ShellStatus; playerName: string }>();
const notice = computed(() => noticeFor(props.status, props.playerName));
</script>

<template>
  <EventPlate
    v-if="notice"
    class="session-notice"
    :class="`is-${notice.status}`"
    :sub="notice.hint"
  >
    {{ notice.text }}
  </EventPlate>
</template>

<style scoped>
.session-notice {
  left: 50%;
  top: 52px;
  z-index: 25;
  max-width: 640px;
  transform: translateX(-50%);
  text-align: center;
}
</style>
