<script setup lang="ts">
/*
 * Экран кубка лиги (#/cup/<лига>, спека 002): сетка 1/8 → 1/4 → 1/2 → финал — в карточке раунд,
 * соперник и состояние с уроком-вехой (имя урока — в подсказке). Пройденные отмечены, текущий
 * выделен, закрытые — с замком и номером урока. Текущий раунд закрыт — вместо «Играть …» кнопка
 * к уроку и строка, после какого урока он откроется. Кубок пройден — трофей крупно и «Сыграть
 * кубок снова» вместо сетки. Правила кубка — в движке (engine/cup), страж — в app/cup.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import KeyButton from '../components/KeyButton.vue';
import TrophyShelf from '../components/TrophyShelf.vue';
import { cupRounds, openLeagueOf, stageName, stateOf } from '../app/cup';
import { progress, replayCup } from '../app/progress';
import { artUrl, type ArtKey } from '../art/assets';
import { playStage, type League } from '../engine/cup';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

const ART: Record<League, ArtKey> = { yard: 'cupYard', district: 'cupDistrict', city: 'cupCity' };
const t = ru.cup;

// Не видимый или чужой кубок сюда не пускает страж маршрута (cupGuard); запасной вариант — двор.
const route = useRoute();
const league = computed<League>(() => openLeagueOf(route.params.league) ?? 'yard');
const state = computed(() => stateOf(league.value));
const done = computed(() => state.value.stage === 4);
const rounds = computed(() =>
  cupRounds(league.value).map((r) => {
    const status = r.stage < state.value.stage ? 'passed' : r.stage === state.value.stage ? 'now' : 'ahead';
    // Третья строка: «✓ Пройден · урок 4», «Сейчас · урок 8», «🔒 после урока 10».
    const word = status === 'passed' ? `✓ ${t.passed}` : status === 'now' ? t.now : t.ahead;
    const line = r.open || status === 'passed' ? `${word} · ${t.lesson} ${r.lessonNumber}` : `🔒 ${ru.unlocks.after} ${r.lessonNumber}`;
    return { ...r, name: stageName(r.stage), status, line, locked: !r.open && status !== 'passed' };
  }),
);
const current = computed(() => rounds.value[playStage(state.value)] ?? null);
// Текущий раунд закрыт: «1/4 финала — после урока 8, ещё 2 урока».
const waitText = computed(() => {
  const r = current.value;
  if (!r || r.open) return null;
  const left = Math.max(1, r.lessonNumber - progress.lessonIndex);
  return `${r.name} — ${ru.unlocks.after} ${r.lessonNumber}, ${ru.unlocks.left} ${left} ${plural(left, ru.unlocks.lessons)}`;
});
const playLabel = computed(() => t.play[playStage(state.value)]);
const matchTo = computed(() => `/match?cup=${league.value}`);
</script>

<template>
  <section class="cup-screen">
    <!-- Кубок пройден — трофей крупно вместо шапки: экран остаётся в окне 1024×640. -->
    <header
      v-if="done"
      class="panel head champion"
    >
      <img
        :src="artUrl(ART[league])"
        :alt="ru.cup.titles[league]"
        width="384"
        height="384"
      >
      <div class="text">
        <h1>{{ ru.cup.titles[league] }}</h1>
        <p class="won">
          {{ ru.cup.won }}
        </p>
        <p>{{ ru.cup.wonText }}</p>
      </div>
      <KeyButton
        primary
        @click="replayCup(league)"
      >
        {{ ru.cup.again }}
      </KeyButton>
    </header>
    <header
      v-else
      class="panel head"
    >
      <div class="text">
        <h1>{{ ru.cup.titles[league] }}</h1>
        <p :class="{ wait: waitText }">
          {{ waitText ?? (state.won ? ru.cup.wonBefore : ru.cup.lead) }}
        </p>
      </div>
      <KeyButton
        :to="waitText ? '/match' : matchTo"
        primary
      >
        {{ waitText ? ru.cup.toLesson : playLabel }}
      </KeyButton>
    </header>

    <!-- Пройденный кубок — без сетки: все раунды позади, трофей говорит сам. -->
    <ol
      v-if="!done"
      class="bracket"
    >
      <li
        v-for="r in rounds"
        :key="r.stage"
        class="panel round"
        :class="[r.status, { locked: r.locked }]"
        :title="r.lesson.name"
      >
        <span class="name">{{ r.name }}</span>
        <span class="rival"><b>{{ r.rival.name }}</b>, {{ r.rival.city }}</span>
        <span class="status">{{ r.line }}</span>
      </li>
    </ol>

    <TrophyShelf :current="league" />
  </section>
</template>

<style scoped>
.cup-screen {
  max-width: 820px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

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
  max-width: 440px;
}

.champion img {
  width: 112px;
  height: 112px;
  margin: -8px 0;
  object-fit: contain;
  filter: drop-shadow(0 8px 20px rgb(0 0 0 / 0.4));
}

.champion .text {
  flex: 1;
}

.champion .won {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 900;
  color: #f4c24a;
}

.bracket {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  /* minmax(0, …): иначе колонки тянутся по содержимому, финал сжимается и экран растёт. */
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}

.round {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  /* Четыре карточки по 196 px: при отступе space-4 «🔒 после урока 10» переносится и карточка растёт. */
  padding: var(--space-2) var(--space-3);
  border: 3px solid transparent;
}

.round.now {
  border-color: #f4c24a;
}

.round.ahead {
  opacity: 0.7;
}

.name {
  font-size: 1.3rem;
  font-weight: 900;
}

.status {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-muted);
  /* «✓ Пройден · урок 12» — одной строкой в карточке 196 px. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.passed .status {
  color: var(--accent);
}

.now .status {
  color: #f4c24a;
}

/* Закрытый раунд — даже текущий: замок и номер урока приглушены, не мигают. */
.locked .status {
  color: var(--text-muted);
}

.rival {
  font-size: 0.95rem;
  /* Соперник — одной строкой: длинное имя не растит карточку (замер спеки 002 — 141 px). */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.head .wait {
  color: var(--text);
  font-weight: 700;
}

@media (width <= 760px) {
  .bracket {
    grid-template-columns: 1fr;
  }
}
</style>
