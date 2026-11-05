<script setup lang="ts">
/*
 * Страница родителя (#/parent, только по прямой ссылке): игроки (ParentPlayers), прогресс, урок и быстрые
 * проверки матча (ParentLesson, ParentCheck), время игры и трудные клавиши выбранного игрока, общие
 * настройки перерыва и сброс игрока. Облик спокойный — светлая панель, без игровых кнопок-клавиш.
 * Только показ и вызовы app/progress; подсчёты — в движке (stats, session).
 */
import { computed, nextTick, ref, watch } from 'vue';
import ParentCheck from '../components/ParentCheck.vue';
import ParentLesson from '../components/ParentLesson.vue';
import ParentPlayers from '../components/ParentPlayers.vue';
import ParentVersions from '../components/ParentVersions.vue';
import { keymap } from '../app/keymap';
import { kits } from '../app/kits';
import { lessons } from '../app/lessons';
import { players } from '../app/players';
import { activeId, lessonAt, peekSave, progress, setBreakSettings, shared } from '../app/progress';
import { resetPlayer } from '../app/roster';
import { breakLeftMs, playedToday, playedWeek } from '../app/session';
import type { SaveData } from '../engine/save';
import { BREAK_MINUTES, MINUTE_MS, PLAY_MINUTES, type BreakSettings } from '../engine/session';
import { weakKeys } from '../engine/stats';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

const t = ru.parent;

// Чей прогресс смотреть: по умолчанию — того, кто играет во вкладке. Он — живой progress,
// другой игрок — снимок из хранилища (перечитывается после сброса).
const viewId = ref(activeId() ?? players.players[0]?.id ?? '');
const peekVersion = ref(0);
const viewed = computed<Readonly<SaveData>>(() => {
  void peekVersion.value;
  return viewId.value === activeId() ? progress : peekSave(viewId.value);
});
const viewedName = computed(() => players.players.find((p) => p.id === viewId.value)?.name ?? '');

const lesson = computed(() => lessonAt(viewed.value.lessonIndex));
const lessonNumber = computed(() => lessons.indexOf(lesson.value) + 1);

// Клубная форма — тоже место в коллекции, как в шкафчике и статистике.
const kitsTotal = kits.length + 1;
const kitsOwned = computed(() => viewed.value.ownedKits.length + (viewed.value.club ? 1 : 0));

const facts = computed(() => [
  { label: t.matches, value: String(viewed.value.matches) },
  { label: t.goals, value: String(viewed.value.goals) },
  { label: t.tasks, value: String(viewed.value.solvedTasks.length) },
  { label: t.kits, value: `${kitsOwned.value} ${t.of} ${kitsTotal}` },
  { label: t.coins, value: String(viewed.value.coins) },
]);

const today = computed(() => playedToday(viewed.value.days));
const week = computed(() => playedWeek(viewed.value.days));

/** «0 мин», «12 мин», «1 ч 05 мин». */
function duration(ms: number): string {
  const total = Math.floor(ms / MINUTE_MS);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} ${t.minutes}`;
  return `${h} ${t.hours} ${String(m).padStart(2, '0')} ${t.minutes}`;
}

const breakClock = computed(() => {
  const s = Math.ceil(breakLeftMs.value / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});

const weak = computed(() =>
  weakKeys(viewed.value.keyErrors, keymap, lesson.value.layout).map((w) => ({
    ...w,
    label: w.label.trim() === '' ? t.space : w.label,
    // Знак — с именем: «. точка» (009-Р22).
    name: ru.keyboard.marks[w.label] ?? '',
    count: `${w.errors} ${plural(w.errors, t.errors)}`,
  })),
);

function change(patch: Partial<BreakSettings>): void {
  setBreakSettings({ ...shared.breakSettings, ...patch });
}

// Сброс — в два шага: предупреждение и слово «сброс», только потом кнопка удаления.
const resetStep = ref<'idle' | 'confirm' | 'done'>('idle');
const resetInput = ref('');
const wordInput = ref<HTMLInputElement | null>(null);
const resetButton = ref<HTMLButtonElement | null>(null);
const wordOk = computed(() => resetInput.value.trim().toLowerCase() === t.resetWord);
// Выбран другой игрок — шаг сброса прошлого игрока не про него.
watch(viewId, () => {
  resetStep.value = 'idle';
});

function askReset(): void {
  resetStep.value = 'confirm';
  resetInput.value = '';
  void nextTick(() => wordInput.value?.focus());
}

/** Отмена: фокус обратно на кнопку сброса, а не в начало страницы. */
function cancelReset(): void {
  resetStep.value = 'idle';
  void nextTick(() => resetButton.value?.focus());
}

function doReset(): void {
  if (!wordOk.value) return;
  resetPlayer(viewId.value);
  peekVersion.value++;
  resetStep.value = 'done';
}
</script>

<template>
  <section class="parent">
    <header>
      <h1>{{ t.title }}</h1>
      <p class="muted">
        {{ t.lead }}
      </p>
    </header>

    <ParentPlayers v-model="viewId" />

    <section class="block">
      <h2>{{ t.progress }}: {{ viewedName }}</h2>
      <p class="lesson">
        {{ t.lesson }} {{ lessonNumber }} {{ t.of }} {{ lessons.length }}: <b>{{ lesson.name }}</b>
      </p>
      <dl class="facts">
        <div
          v-for="f in facts"
          :key="f.label"
        >
          <dt>{{ f.label }}</dt>
          <dd>{{ f.value }}</dd>
        </div>
      </dl>
    </section>

    <ParentLesson
      :player-id="viewId"
      :current="viewed.lessonIndex"
      @changed="peekVersion++"
    />

    <ParentCheck :current="viewed.lessonIndex" />

    <section class="block">
      <h2>{{ t.time }}</h2>
      <dl class="facts">
        <div>
          <dt>{{ t.today }}</dt>
          <dd>{{ duration(today) }}</dd>
        </div>
        <div>
          <dt>{{ t.week }}</dt>
          <dd>{{ duration(week) }}</dd>
        </div>
      </dl>
      <p class="muted">
        {{ t.timeHint }}
      </p>
    </section>

    <section class="block">
      <h2>{{ t.weak }}</h2>
      <template v-if="weak.length > 0">
        <ul class="keys">
          <li
            v-for="w in weak"
            :key="w.code"
          >
            <span class="cap">{{ w.label }}</span> {{ w.name }} {{ w.count }}
          </li>
        </ul>
        <p class="muted">
          {{ t.weakHint }}
        </p>
      </template>
      <p
        v-else
        class="muted"
      >
        {{ t.noWeak }}
      </p>
    </section>

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

    <ParentVersions />

    <section class="block danger">
      <h2>{{ t.reset }}: {{ viewedName }}</h2>
      <p class="muted">
        {{ t.resetHint }}
      </p>
      <button
        v-if="resetStep !== 'confirm'"
        ref="resetButton"
        type="button"
        class="btn"
        @click="askReset"
      >
        {{ t.resetStart }}
      </button>
      <div
        v-else
        class="confirm"
        role="alertdialog"
        aria-labelledby="reset-sure"
      >
        <p
          id="reset-sure"
          class="sure"
        >
          {{ t.resetSure }}
        </p>
        <label class="word">
          {{ t.resetType }} «{{ t.resetWord }}»
          <input
            ref="wordInput"
            v-model="resetInput"
            type="text"
            autocomplete="off"
            @keydown.enter.prevent="doReset"
          >
        </label>
        <div class="row">
          <button
            type="button"
            class="btn red"
            :disabled="!wordOk"
            @click="doReset"
          >
            {{ t.resetConfirm }}
          </button>
          <button
            type="button"
            class="btn"
            @click="cancelReset"
          >
            {{ t.resetCancel }}
          </button>
        </div>
      </div>
      <p
        v-if="resetStep === 'done'"
        class="note"
        role="status"
      >
        {{ t.resetDone }}
      </p>
    </section>
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

h2 {
  margin: 0 0 var(--space-3);
  font-size: 1.2rem;
}

.muted {
  margin: var(--space-2) 0 0;
  color: #555;
}

.block {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--paper-border);
}

.lesson {
  margin: 0 0 var(--space-3);
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-3);
  margin: 0;
}

.facts div {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--paper-note);
}

.facts dt {
  color: #555;
  font-size: 0.9rem;
}

.facts dd {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.keys {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.cap {
  display: inline-grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding: 0 var(--space-2);
  border: 1px solid var(--paper-border);
  border-radius: 8px;
  background: var(--paper-note);
  font-weight: 700;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

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

.note {
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--paper-note);
  font-weight: 700;
}

.btn {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--paper-border);
  border-radius: var(--radius);
  background: var(--paper-field);
  color: var(--paper-text);
  font: inherit;
  cursor: pointer;
}

.btn.red {
  border-color: var(--paper-wrong);
  background: var(--paper-wrong);
  color: #fff;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn:focus-visible,
input:focus-visible {
  outline: 3px solid var(--paper-focus);
  outline-offset: 2px;
}

.danger .btn {
  margin-top: var(--space-3);
}

.sure {
  margin: var(--space-3) 0;
  color: var(--paper-wrong);
  font-weight: 700;
}

.word {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 320px;
}

.word input {
  min-height: 40px;
  padding: 0 var(--space-2);
  border: 1px solid var(--paper-border);
  border-radius: 8px;
  background: var(--paper-field);
  color: var(--paper-text);
  font: inherit;
}
</style>
