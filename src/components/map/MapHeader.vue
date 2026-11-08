<script setup lang="ts">
// Шапка карты (спека 019-Т8): название клуба и город, звёзды, монеты и три входа — «Путь клуба», «Клуб»
// (правка; «Исправить», если у клуба нет названия или города), «Лист лиги». Ничего не пишет и никуда не ходит:
// сообщает события. Первая кнопка — вход шапки для клавиатуры карты (`data-focus="header"`, design §5.3): на неё
// фокус приходит с последнего здания по Tab; остальные кнопки Tab проходит сам. Окно открывают с `from` — кнопкой,
// на которую экран вернёт фокус при закрытии.
import { computed } from 'vue';
import { HEADER_FOCUS } from '../../engine/map/focus';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  name: string;
  city: string;
  stars: { got: number; max: number };
  coins: number;
  /** У клуба нет названия или города: кнопка правки зовётся «Исправить». */
  fix: boolean;
}>();
const emit = defineEmits<{ open: [what: 'sheet' | 'edit', from: HTMLElement]; path: [] }>();

const t = ru.map.header;
const starsText = computed(() => `${props.stars.got}/${props.stars.max}`);

const from = (e: Event): HTMLElement => e.currentTarget as HTMLElement;
</script>

<template>
  <header class="bar">
    <h1>
      {{ name }}<span
        v-if="city"
        class="city"
      > · {{ city }}</span>
    </h1>
    <span
      class="stat"
      role="img"
      :aria-label="`${t.stars}: ${starsText}`"
    >
      <b aria-hidden="true">★</b> {{ starsText }}
    </span>
    <span
      class="stat"
      role="img"
      :aria-label="`${t.coins}: ${coins}`"
    >
      <b aria-hidden="true">●</b> {{ coins }}
    </span>
    <nav class="nav">
      <button
        type="button"
        class="btn"
        :data-focus="HEADER_FOCUS"
        @click="emit('path')"
      >
        {{ t.path }}
      </button>
      <button
        type="button"
        class="btn"
        :class="{ fix }"
        @click="emit('open', 'edit', from($event))"
      >
        {{ fix ? t.fix : t.club }}
      </button>
      <button
        type="button"
        class="btn"
        @click="emit('open', 'sheet', from($event))"
      >
        {{ t.sheet }}
      </button>
    </nav>
  </header>
</template>

<style scoped>
.bar {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  color: var(--text);
}

h1 {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 1.5rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.city {
  color: var(--text-muted);
  font-weight: 600;
}

.stat {
  font-size: 1.2rem;
  font-weight: 800;
  white-space: nowrap;
}

.stat b {
  color: var(--accent);
}

.nav {
  display: flex;
  gap: var(--space-2);
}

.btn {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 2px solid var(--field-border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.btn.fix {
  border-color: var(--accent);
}

.btn:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 2px;
}
</style>
