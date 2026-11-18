<script setup lang="ts">
/** Раздел «оболочка»: плашки сеанса по состоянию хранилища (063 К7). */
import { ref } from 'vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import SessionNotice from '../../components/shell/SessionNotice.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import type { ShellStatus } from '../../components/shell/status';
import { ru } from '../../i18n/ru';

const t = ru.kit.sheet;
const STATUSES: ShellStatus[] = ['busy', 'readonly', 'quota', 'conflict', 'broken'];
const shown = ref<ShellStatus>('busy');
</script>

<template>
  <div
    class="eb-row"
    style="top: 0"
  >
    <ShellHeader page="home" />
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 60px"
  >
    <KeyButton
      v-for="s in STATUSES"
      :key="s"
      quiet
      md
      :state="s === shown ? 'hover' : undefined"
      @click="shown = s"
    >
      {{ s }}
    </KeyButton>
  </div>
  <SessionNotice
    :status="shown"
    :player-name="t.playerName"
  />
</template>
