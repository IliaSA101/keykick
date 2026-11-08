<script setup lang="ts">
/*
 * Страница родителя (#/parent, только по прямой ссылке): игроки (ParentPlayers), прогресс и урок (ParentLesson;
 * быстрые проверки матча ParentCheck скрыты до 019-Т13, 017-Р41), трудные клавиши (время игры — с 040, 018-Р28), перерыв, файл сохранения,
 * версии игры и сброс игрока. Облик спокойный — светлая панель, без игровых кнопок-клавиш.
 * Экран только выбирает, чей прогресс смотреть; блоки — в components/parent/ и рядом.
 */
import { computed, ref, watch } from 'vue';
import ParentLesson from '../components/ParentLesson.vue';
import ParentPlayers from '../components/ParentPlayers.vue';
import ParentVersions from '../components/ParentVersions.vue';
import ParentBackup from '../components/parent/ParentBackup.vue';
import ParentBreak from '../components/parent/ParentBreak.vue';
import ParentCopies from '../components/parent/ParentCopies.vue';
import ParentReset from '../components/parent/ParentReset.vue';
import ParentStats from '../components/parent/ParentStats.vue';
import { players } from '../app/players/list';
import { activeId, viewSave } from '../app/players/active';
import { parentView } from '../engine/parent/view';
import { ru } from '../i18n/ru';

const t = ru.parent;

// Чей прогресс смотреть: по умолчанию — того, кто играет во вкладке (его разделы — из памяти слоя),
// другой игрок — снимок из хранилища (перечитывается после сброса и после «Поставить урок»).
const viewId = ref(activeId() ?? players.players[0]?.id ?? '');
// Игрока, чей прогресс смотрим, удалили в другой вкладке — переходим к тому, кто играет здесь.
watch(
  () => players.players.some((p) => p.id === viewId.value),
  (still) => {
    if (!still) viewId.value = activeId() ?? players.current ?? players.players[0]?.id ?? '';
  },
);
const peekVersion = ref(0);
const viewed = computed(() => {
  void peekVersion.value;
  return parentView(viewSave(viewId.value));
});
/** Копии появляются после сброса и удаления игрока: список копий пересоздаётся по ключу. */
const copiesKey = ref(0);
/** Идёт перезагрузка после загрузки файла: остальная страница недоступна (ParentBackup остаётся, на нём итог). */
const waiting = ref(false);
const viewedName = computed(() => players.players.find((p) => p.id === viewId.value)?.name ?? '');
</script>

<template>
  <section class="parent">
    <header :inert="waiting || undefined">
      <h1>{{ t.title }}</h1>
      <p class="muted">
        {{ t.lead }}
      </p>
    </header>

    <ParentPlayers
      v-model="viewId"
      :inert="waiting || undefined"
      @removed="copiesKey++"
    />

    <!-- У ParentStats несколько корней и слот: `inert` на нём не переносится, поэтому обёртка. -->
    <div :inert="waiting || undefined">
      <ParentStats
        :viewed="viewed"
        :name="viewedName"
      >
        <ParentLesson
          :player-id="viewId"
          :current="viewed.lessonId"
          :passed="viewed.passed"
          @changed="peekVersion++"
        />
      </ParentStats>
    </div>

    <ParentBreak :inert="waiting || undefined" />

    <ParentBackup @waiting="waiting = $event" />

    <ParentCopies
      :key="copiesKey"
      :inert="waiting || undefined"
    />

    <ParentVersions :inert="waiting || undefined" />

    <ParentReset
      :player-id="viewId"
      :name="viewedName"
      :inert="waiting || undefined"
      @done="peekVersion++; copiesKey++"
    />
  </section>
</template>

<style scoped>
/* Светлая «бумажная» панель на тёмном фоне игры: читается как обычная страница настроек. */
.parent {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-5);
  border-radius: 16px;
  background: var(--paper);
  color: var(--paper-text);
  /* Карточка светлая и в тёмной теме: переключатели и поля — светлые, иначе пустой кружок не отличить. */
  color-scheme: light;
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.4);
}

h1 {
  margin: 0;
}

.muted {
  margin: var(--space-2) 0 0;
  color: #555;
}
</style>
