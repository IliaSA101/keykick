<script setup lang="ts">
/*
 * Страница родителя: общие настройки перерыва (для всех игроков). Только показ и вызов app/players/shared.
 */
import { computed } from 'vue';
import { setBreakSettings, shared } from '../../app/players/shared';
import { breakLeftMs } from '../../app/session';
import { BREAK_MINUTES, PLAY_MINUTES, type BreakSettings } from '../../engine/session';
import { ru } from '../../i18n/ru';

const t = ru.parent;

const breakClock = computed(() => {
  const s = Math.ceil(breakLeftMs.value / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});

function change(patch: Partial<BreakSettings>): void {
  setBreakSettings({ ...shared.breakSettings, ...patch });
}
</script>

<template>
  <section class="block">
    <h2>{{ t.settings }}</h2>
    <label class="row toggle">
      <input
        type="checkbox"
        :checked="shared.breakSettings.enabled"
        @change="change({ enabled: ($event.target as HTMLInputElement).checked })"
      >
      {{ t.breakOn }}
    </label>
    <fieldset :disabled="!shared.breakSettings.enabled">
      <legend>{{ t.playFor }}</legend>
      <label
        v-for="m in PLAY_MINUTES"
        :key="m"
        class="choice"
      >
        <input
          type="radio"
          name="play"
          :checked="shared.breakSettings.playMinutes === m"
          @change="change({ playMinutes: m })"
        >
        {{ m }} {{ t.minutes }}
      </label>
    </fieldset>
    <fieldset :disabled="!shared.breakSettings.enabled">
      <legend>{{ t.breakFor }}</legend>
      <label
        v-for="m in BREAK_MINUTES"
        :key="m"
        class="choice"
      >
        <input
          type="radio"
          name="rest"
          :checked="shared.breakSettings.breakMinutes === m"
          @change="change({ breakMinutes: m })"
        >
        {{ m }} {{ t.minutes }}
      </label>
    </fieldset>
    <p class="muted">
      {{ t.breakHint }}
    </p>
    <p
      v-if="breakLeftMs > 0"
      class="note"
    >
      {{ t.breakNow }} {{ breakClock }}
    </p>
  </section>
</template>

<style scoped src="./paper.css"></style>
<style scoped>
fieldset {
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3) var(--space-3);
  border: 1px solid var(--paper-border);
  border-radius: var(--radius);
}

fieldset:disabled {
  opacity: 0.5;
}

fieldset:disabled .choice {
  cursor: default;
}

/* Подпись нажимается вместе с галочкой — и выглядит нажимаемой; по пустому месту справа — нет. */
.toggle {
  display: inline-flex;
  min-height: 44px;
  cursor: pointer;
}

.choice {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  gap: var(--space-1);
  min-height: 44px;
  margin-right: var(--space-4);
}

input[type='checkbox'],
input[type='radio'] {
  width: 20px;
  height: 20px;
  accent-color: var(--paper-button);
}
</style>
