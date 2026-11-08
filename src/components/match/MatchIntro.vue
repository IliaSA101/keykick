<script setup lang="ts">
/*
 * Вступление матча v2 (спека 017, design §1): урок, новые клавиши, совет тренера, правила по порогам урока
 * (g — гол, c — гол соперника) тремя строками со значками, «Начать». Пробел и Enter ловит экран матча (слушает всё окно).
 * Карточка короткая: клавиатура под ней видна всегда, окно 1024×640 без прокрутки.
 */
import { computed } from 'vue';
import KeyButton from '../KeyButton.vue';
import { ru } from '../../i18n/ru';
import { introRules } from './labels';

const props = defineProps<{
  lessonName: string;
  /** Новые клавиши урока: «ыв» — подпись плашками; пусто — нет строки. */
  newKeys: string;
  /** Совет тренера; null — без совета. */
  tip: string | null;
  /** Ошибок в атаке: до g включительно — гол, c и больше — гол соперника. */
  g: number;
  c: number;
  /** Возврат после паузы ≥ 5 дней (ТЗ-2.11): баннер «Капитан вернулся!». */
  comeback?: boolean;
  /** Матч смягчённый (017-Р55, Р57): строка «Сегодня матч полегче…». */
  softened?: boolean;
}>();

defineEmits<{ start: [] }>();

const t = ru.match2.intro;

const rules = computed(() => introRules(props.g, props.c));
</script>

<template>
  <div class="intro">
    <p class="lesson">
      <b
        v-if="comeback"
        class="comeback"
      >{{ ru.match2Result.comeback }}</b>
      {{ t.lesson }}: {{ lessonName }}
    </p>
    <p
      v-if="softened"
      class="soft"
      data-soft
    >
      {{ t.soft }}
    </p>
    <p
      v-if="newKeys"
      class="focus"
    >
      {{ t.newKeys }}
      <b
        v-for="ch in [...newKeys]"
        :key="ch"
        class="letter"
      >{{ ch.toUpperCase() }}</b>
    </p>
    <p
      v-if="tip"
      class="tip"
    >
      <b>{{ t.tip }}:</b> {{ tip }}
    </p>
    <ul class="rules">
      <li
        v-for="r in rules"
        :key="r.kind"
      >
        <span
          class="dot"
          :class="r.kind"
          aria-hidden="true"
        />{{ r.text }}
      </li>
    </ul>
    <div class="start">
      <KeyButton
        primary
        @click="$emit('start')"
      >
        {{ t.start }}
      </KeyButton>
      <span>{{ t.startKey }}</span>
    </div>
  </div>
</template>

<style scoped>
.intro {
  max-width: 820px;
  margin: 0 auto;
  padding: var(--space-2) var(--space-4);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'lesson start'
    'soft start'
    'focus start'
    'tip start'
    'rules start';
  column-gap: var(--space-4);
  align-items: center;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
}

.lesson {
  grid-area: lesson;
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.comeback {
  margin-right: var(--space-2);
  padding: 0 var(--space-2);
  border-radius: 6px;
  background: var(--accent);
  color: #1b1b1b;
}

.soft {
  grid-area: soft;
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text);
}

.focus {
  grid-area: focus;
  margin: 0;
}

.letter {
  display: inline-block;
  min-width: 1.6em;
  margin: 0 2px;
  padding: 0 4px;
  border-radius: 6px;
  background: var(--accent-soft);
  text-align: center;
}

.tip {
  grid-area: tip;
  margin: var(--space-1) 0 0;
  padding: var(--space-1) var(--space-3);
  border-radius: 10px;
  /* Тёмная плашка тона страницы вместо бурой полупрозрачной: текст --text читается (контраст > 12, 017-Р49). */
  background: var(--bg);
  border-left: 4px solid var(--accent);
  font-size: 0.85rem;
  line-height: 1.35;
}

.tip b {
  color: var(--accent);
}

.rules {
  grid-area: rules;
  margin: var(--space-1) 0 0;
  padding: 0;
  list-style: none;
  color: var(--text);
  font-size: 1rem;
  line-height: 1.5;
}

/* Значок строки: цвет плюс форма (круг, квадрат, ромб) — различим и без цвета; крупный, ≥ 16 px (017-Р34). */
.dot {
  display: inline-block;
  width: 1em;
  height: 1em;
  margin-right: 0.6em;
  vertical-align: -0.1em;
  background: #2e9d4f;
  border-radius: 50%;
}

.dot.save {
  background: #e0a800;
  border-radius: 2px;
}

.dot.conceded {
  background: #d23a3a;
  border-radius: 2px;
  transform: rotate(45deg) scale(0.85);
}

.start {
  grid-area: start;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-muted);
  font-size: 0.8rem;
}
</style>
