<script setup lang="ts">
/*
 * Статистика ребёнка: счётчики из сохранения и трудные клавиши (их же генератор даёт чаще).
 * Только показ: подсчёт трудных клавиш — в движке (engine/stats).
 */
import { computed } from 'vue';
import KeyButton from '../components/KeyButton.vue';
import TrophyShelf from '../components/TrophyShelf.vue';
import { keymap } from '../app/keymap';
import { kits } from '../app/kits';
import { lessons } from '../app/lessons';
import { currentLesson, progress } from '../app/progress';
import { weakKeys } from '../engine/stats';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

const lesson = currentLesson();
const lessonNumber = lessons.indexOf(lesson) + 1;

// Клубная форма — тоже место в коллекции, как в шкафчике.
const kitsTotal = kits.length + 1;
const kitsOwned = computed(() => progress.ownedKits.length + (progress.club ? 1 : 0));

const tiles = computed(() => [
  { label: ru.stats.matches, value: String(progress.matches) },
  { label: ru.stats.goals, value: String(progress.goals) },
  { label: ru.stats.penalties, value: String(progress.solvedTasks.length) },
  { label: ru.stats.kits, value: `${kitsOwned.value} ${ru.stats.of} ${kitsTotal}` },
]);

const weak = computed(() =>
  weakKeys(progress.keyErrors, keymap, lesson.layout).map((w) => ({
    ...w,
    label: w.label.trim() === '' ? ru.stats.space : w.label,
    // Знак — с именем под плашкой: одна «.» на плашке читается как пустая клавиша (009-Р22).
    name: ru.keyboard.marks[w.label] ?? null,
    count: `${w.errors} ${plural(w.errors, ru.stats.errors)}`,
  })),
);
// Есть знак с именем — строка имени у всех плашек (у букв пустая): иначе число ошибок у знака ниже соседних (009 Т5).
const anyNamed = computed(() => weak.value.some((w) => w.name !== null));
</script>

<template>
  <section class="stats">
    <div class="sheet">
      <header class="panel head">
        <div>
          <h1>{{ ru.stats.title }}</h1>
          <p>{{ ru.stats.lead }}</p>
        </div>
        <KeyButton
          to="/match"
          primary
        >
          {{ ru.stats.toMatch }}
        </KeyButton>
      </header>

      <ul class="tiles">
        <li
          v-for="t in tiles"
          :key="t.label"
          class="panel tile"
        >
          <span class="value">{{ t.value }}</span>
          <span class="label">{{ t.label }}</span>
        </li>
      </ul>

      <div class="panel lesson">
        <span class="label">{{ ru.stats.lesson }} {{ lessonNumber }} {{ ru.stats.of }} {{ lessons.length }}</span>
        <b>{{ lesson.name }}</b>
      </div>

      <TrophyShelf />

      <div class="panel weak">
        <h2>{{ ru.stats.weak }}</h2>
        <template v-if="weak.length > 0">
          <ul class="keys">
            <li
              v-for="w in weak"
              :key="w.code"
              class="key"
            >
              <span class="cap">{{ w.label }}</span>
              <span
                v-if="anyNamed"
                class="name"
              >{{ w.name ?? '\u00a0' }}</span>
              <span class="count">{{ w.count }}</span>
            </li>
          </ul>
          <p class="hint">
            {{ ru.stats.weakHint }}
          </p>
        </template>
        <p
          v-else
          class="hint"
        >
          {{ ru.stats.noWeak }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * Колонка — контейнер: две колонки включаются по её ширине в единицах вёрстки (после zoom),
 * а не по окну (docs/specs/006-page-scale.md, К4). Узкая — всё одной колонкой, как раньше.
 */
.stats {
  max-width: 1240px;
  margin: 0 auto;
  container-type: inline-size;
}

.sheet {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

/* Широкая: сверху шапка и плитки, ниже слева урок и полка, справа трудные клавиши. */
@container (width >= 900px) {
  .sheet {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    grid-template-areas:
      'head head'
      'tiles tiles'
      'lesson weak'
      'shelf weak';
    align-items: start;
  }

  .head {
    grid-area: head;
  }

  .tiles {
    grid-area: tiles;
  }

  .lesson {
    grid-area: lesson;
  }

  .shelf {
    grid-area: shelf;
  }

  .weak {
    grid-area: weak;
  }
}

/* «На матч!» — в шапке: на ноутбуке низ экрана уходит за край окна. */
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.head h1 {
  margin: 0;
}

.head p {
  margin: var(--space-1) 0 0;
  color: var(--text-muted);
}

.tiles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.value {
  /* «11 из 25» в одну строку: перенос вдвое тянул все четыре плитки. */
  white-space: nowrap;
  font-size: 2.2rem;
  font-weight: 900;
  color: #f4c24a;
  font-variant-numeric: tabular-nums;
}

.label {
  color: var(--text-muted);
  font-weight: 600;
}

.lesson {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-3);
  font-size: 1.1rem;
}

.weak h2 {
  margin: 0 0 var(--space-3);
  font-size: 1.2rem;
}

.keys {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.key {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

/* Клавиша — плоский значок, а не кнопка: нажимать её незачем. */
.cap {
  min-width: 52px;
  height: 52px;
  padding: 0 var(--space-3);
  display: grid;
  place-items: center;
  border: 2px solid rgb(255 246 224 / 0.5);
  border-radius: 12px;
  background: rgb(255 255 255 / 0.1);
  color: #fff6e0;
  font-size: 1.5rem;
  font-weight: 800;
}

.name {
  color: #fff6e0;
  font-weight: 700;
}

.count {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.hint {
  margin: var(--space-3) 0 0;
  color: var(--text-muted);
}

@media (width <= 760px) {
  .tiles {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
