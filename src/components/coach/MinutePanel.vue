<script setup lang="ts">
/**
 * Панель «Минута тренера» на Базе (067 Т25, Р173; кадры Э4.01–07, 41): две клавиши с процентом под каждой и «Начать».
 * Клавиши и числа считает экран-хозяин (`app/coach`); здесь только вид. `primary` — главная кнопка экрана (Enter), когда игр на интерес не осталось.
 */
import { fill } from '../../app/home/texts';
import { keysText } from '../../app/coach/run';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';
import KeyCap from '../kit/KeyCap.vue';

defineProps<{ keys: { ch: string; pct: string }[]; fresh: boolean; primary: boolean; spent: boolean; /** Сеанс не `ok` (вторая вкладка, чтение): «Начать» неактивна. */ off?: boolean }>();
defineEmits<{ start: [] }>();
const t = ru.coach;
</script>

<template>
  <section
    class="min"
    data-coach-panel
  >
    <h2>{{ t.title }}</h2>
    <p class="note">
      {{ fill(fresh ? t.panel.fresh : t.panel.hard, { keys: keysText(keys.map((k) => k.ch).join('')) }) }}
    </p>
    <div class="mks">
      <div
        v-for="k in keys"
        :key="k.ch"
        class="mk"
      >
        <KeyCap class="cap">
          {{ k.ch.toUpperCase() }}
        </KeyCap>
        <span>{{ k.pct }}</span>
      </div>
    </div>
    <span class="pay">{{ t.panel.pay }}</span>
    <p
      v-if="spent"
      class="tiny"
    >
      {{ t.panel.spent }}
    </p>
    <KeyButton
      md
      :primary="primary"
      :state="off ? 'off' : undefined"
      :sub="primary ? ru.result.enter : ''"
      @click="$emit('start')"
    >
      {{ ru.match.intro.start }}
    </KeyButton>
  </section>
</template>

<style scoped>
.min { box-sizing: border-box; width: 270px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 14px; border-radius: 16px; background: linear-gradient(160deg, rgb(58 63 134 / 0.85), rgb(31 33 82 / 0.85)); box-shadow: inset 0 0 0 1.5px var(--border); }
h2 { margin: 0; font-size: 18px; }
.note { margin: 0; font-size: 14px; color: var(--text-muted); }
.mks { display: flex; gap: 18px; }
.cap { min-width: 48px; height: 48px; font-size: 26px; background: #fff; color: #1b1a3a; box-shadow: 0 3px 0 #9fb58a; }
.mk { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mk span { font-size: 12px; color: var(--text-muted); }
.pay { font-size: 12px; font-weight: 800; color: #6fd89c; }
.tiny { margin: 0; font-size: 12px; color: var(--text-muted); }
</style>
