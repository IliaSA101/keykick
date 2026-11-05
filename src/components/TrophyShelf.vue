<script setup lang="ts">
/*
 * Полка трофеев: кубки трёх лиг. Полученный — в цвете; нет — тёмный силуэт и подпись, как его
 * получить. Открытый кубок — ссылка на его сетку (так с экрана кубка попадают в кубки младших лиг).
 */
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { firstMilestoneNumber, isCupVisible } from '../app/cup';
import { progress } from '../app/progress';
import { artUrl, type ArtKey } from '../art/assets';
import { LEAGUES, type League } from '../engine/cup';
import { ru } from '../i18n/ru';

const props = defineProps<{
  /** Кубок этого экрана: выделен и не ссылка. */
  current?: League;
}>();

const ART: Record<League, ArtKey> = { yard: 'cupYard', district: 'cupDistrict', city: 'cupCity' };

const cups = computed(() =>
  LEAGUES.map((league) => {
    const won = progress.cups[league]?.won === true;
    const open = isCupVisible(league);
    // Закрытый кубок: подпись с номером урока 1/8 — ребёнок видит, сколько осталось (вопрос владельца 04.11).
    const how = open ? ru.cup.shelf.howCup : `${ru.cup.shelf.howLesson} ${firstMilestoneNumber(league)}`;
    return {
      league,
      won,
      src: artUrl(ART[league]),
      title: ru.cup.titles[league],
      how: won ? null : how,
      to: open && league !== props.current ? `/cup/${league}` : null,
    };
  }),
);
</script>

<template>
  <section
    class="shelf panel"
    :aria-label="ru.cup.shelf.title"
  >
    <h2>{{ ru.cup.shelf.title }}</h2>
    <ul>
      <li
        v-for="c in cups"
        :key="c.league"
        :class="{ won: c.won, current: c.league === current }"
      >
        <component
          :is="c.to ? RouterLink : 'div'"
          :to="c.to ?? undefined"
          class="cup"
        >
          <img
            :src="c.src"
            :alt="c.won ? c.title : ''"
            width="384"
            height="384"
          >
          <b>{{ c.title }}</b>
          <span
            v-if="c.how"
            class="how"
          >{{ c.how }}</span>
        </component>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.shelf h2 {
  margin: 0 0 var(--space-2);
  font-size: 1.1rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.cup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-2);
  border-radius: 12px;
  color: inherit;
  text-align: center;
  text-decoration: none;
  line-height: 1.2;
}

a.cup:hover {
  background: rgb(255 255 255 / 0.08);
}

a.cup:focus-visible {
  outline: 3px solid var(--accent);
}

.current .cup {
  background: var(--accent-soft);
}

img {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

/* Не получен — тёмный силуэт: форму кубка видно, а цвета — нет. */
li:not(.won) img {
  filter: brightness(0) opacity(0.45);
}

b {
  font-size: 0.95rem;
}

.how {
  color: var(--text-muted);
  font-size: 0.85rem;
}

@media (width <= 560px) {
  img {
    width: 48px;
    height: 48px;
  }
}
</style>
