<script setup lang="ts">
/*
 * Вступление матча: урок, соперник, новые буквы, совет тренера и правила; кнопка «Начать».
 * Пробел вместо кнопки ловит экран матча — он слушает клавиатуру всего окна.
 * Третье правило — решающая по лиге урока (спека 008); на первом уроке лиги с серией длиннее
 * прошлой правила открыты, у правила — «Новое!» (008-Р6).
 */
import { computed, ref } from 'vue';
import KeyButton from './KeyButton.vue';
import KitView from './KitView.vue';
import { decisiveRule } from '../app/decisiveText';
import { progress } from '../app/progress';
import { shirtBack } from '../engine/club';
import type { Kit } from '../engine/kit';
import { isLetter } from '../engine/keymap';
import { tipAt, type Lesson } from '../engine/lessons';
import { MATCH_HALVES, type LeagueRules } from '../engine/match';
import { ru } from '../i18n/ru';

const props = defineProps<{
  lesson: Lesson;
  /** Формы команд по бокам карточки — крупнее, чем на табло; null — без формы. */
  usKit?: Kit | null;
  rivalKit?: Kit | null;
  /** Матч кубка: урок не открывает, решающая серия решает ничью (docs/design.md, кубок). */
  cup?: boolean;
  /** «Кубок районной лиги · 1/8 финала» — над уроком, в пустом месте слева от «Начать» (не на табло:
   *  строка табло растила вступление за край окна 640). */
  cupTitle?: string | null;
  /** Правила решающей у лиги урока. */
  rules: LeagueRules;
  /** Правило решающей новое для игрока (первый урок лиги с серией длиннее, match.ts, seriesIsNew). */
  freshRule?: boolean;
}>();

defineEmits<{ start: [] }>();

/*
 * Клавиатура под вступлением видна всегда (как в окне задания «Соло»), поэтому карточка короткая:
 * в окне 1024×640 она не выше поля во время печати. Правила и совет тренера — на одном месте,
 * кнопка переключает. В первых двух матчах сначала правила, дальше — совет.
 * В progress.matches — таймы: два матча — четыре тайма.
 */
const RULES_OPEN_MATCHES = 4;
const rulesOpen = ref(progress.matches < RULES_OPEN_MATCHES || props.freshRule);

// Правила в ряд: общие и решающая по лиге урока (в кубке — про ничью); fresh — с «Новое!».
const rules = computed(() => [
  ...ru.match.rules.map((r) => ({ ...r, fresh: false })),
  { ...decisiveRule(props.rules, props.cup), fresh: props.freshRule },
]);

// Урок со знаком (точка, спека 009) — «Новые клавиши:», а не «Новые буквы:» (009-Р10).
const freshLabel = computed(() =>
  [...props.lesson.newKeys].every(isLetter) ? ru.match.newKeys : ru.match.newMarks,
);

// Номер матча игрока: советов у урока бывает несколько, следующий матч — следующий совет (спека 003).
const matchNo = Math.floor(progress.matches / MATCH_HALVES);

// Своя форма — спиной, с именем и номером игрока, как надетая в шкафчике; без них — спереди.
const back = shirtBack(progress.club);
</script>

<template>
  <!-- Формы — по бокам карточки, а не над ней: вступление не становится выше (окно 1024×640). -->
  <div class="lineup">
    <figure
      v-if="usKit"
      class="side"
    >
      <KitView
        :kit="usKit"
        :back="back"
      />
      <figcaption>{{ ru.match.you }}</figcaption>
    </figure>
    <div class="intro">
      <p
        v-if="cupTitle"
        class="cup"
      >
        {{ cupTitle }}
      </p>
      <!-- Соперник — на табло над карточкой: здесь его не повторяем, строка урока не переносится. -->
      <p class="lesson">
        {{ ru.match.lesson }}: {{ lesson.name }}
      </p>
      <p
        v-if="!rulesOpen"
        class="tip"
      >
        <b>{{ ru.match.tip }}:</b> {{ tipAt(lesson, matchNo) }}
      </p>
      <div class="meta">
        <span
          v-if="lesson.newKeys"
          class="focus"
        >
          {{ freshLabel }}
          <template
            v-for="ch in [...lesson.newKeys]"
            :key="ch"
          >
            <b class="letter">{{ ch.toUpperCase() }}</b>
            <!-- Знак — с именем: плашка с крошечной точкой читается как пустая (009-Р22). -->
            <span
              v-if="ru.keyboard.marks[ch]"
              class="mark-name"
            >{{ ru.keyboard.marks[ch] }}</span>
          </template>
        </span>
        <button
          type="button"
          class="rules-toggle"
          @click="rulesOpen = !rulesOpen"
          @keydown.space.stop
        >
          ▸ {{ rulesOpen ? ru.match.tip : ru.match.rulesTitle }}
        </button>
      </div>
      <div class="start">
        <KeyButton
          primary
          @click="$emit('start')"
        >
          {{ ru.match.start }}
        </KeyButton>
        <span>{{ ru.match.startKey }}</span>
      </div>
      <ol
        v-if="rulesOpen"
        class="rules"
      >
        <li
          v-for="rule in rules"
          :key="rule.title"
        >
          <span
            v-if="rule.fresh"
            class="fresh"
          >{{ ru.unlocks.fresh }}</span>
          <b>{{ rule.title }}</b>
          {{ rule.text }}
        </li>
      </ol>
    </div>
    <figure
      v-if="rivalKit"
      class="side"
    >
      <KitView :kit="rivalKit" />
      <figcaption>{{ ru.match.rival }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.lineup {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.side {
  flex: none;
  width: 72px;
  margin: 0;
  text-align: center;
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 800;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
}

.intro {
  flex: 0 1 820px;
  min-width: 0;
  margin: 0 auto;
  max-width: 820px;
  padding: var(--space-2) var(--space-4);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  /* Урок и «Правила» слева, «Начать» справа; совет и правила — во всю ширину под ними. */
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'cup start'
    'lesson start'
    'meta start'
    'tip tip';
  column-gap: var(--space-4);
  align-items: center;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
}

.cup {
  grid-area: cup;
  margin: 0;
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1.2;
}

/* 1rem, не крупнее: «Урок: Последний тур городской лиги» — в одну строку рядом с «Начать»
   (перенос растил вступление финала кубка за край окна 640). */
.lesson {
  grid-area: lesson;
  margin: 0;
  font-weight: 800;
  font-size: 1rem;
}

.focus {
  font-weight: 400;
  font-size: 1rem;
}

.letter {
  display: inline-block;
  min-width: 1.6em;
  margin: 0 2px;
  padding: 0 4px;
  border-radius: 6px;
  background: var(--accent-soft);
}

.mark-name {
  margin-right: 4px;
  font-weight: 700;
}

/* Совет мельче основного шрифта: самый длинный (урок city-pinky) — в три строки, и вступление
   не выше окна 1024×640 (проверка — все советы lessons.json, docs/testing.md). */
.tip {
  grid-area: tip;
  margin: var(--space-1) 0 0;
  padding: var(--space-1) var(--space-3);
  font-size: 0.85rem;
  line-height: 1.35;
  border-radius: 10px;
  background: var(--accent-soft);
}

.meta {
  grid-area: meta;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.rules-toggle {
  min-height: 36px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

.rules-toggle:focus-visible {
  outline: 3px solid var(--accent);
}

.rules {
  grid-area: tip;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin: var(--space-1) 0 0;
  padding: 0;
  list-style: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.15;
}

.rules b {
  color: var(--text);
}

.rules b::after {
  content: ':';
}

/* «Новое!» у правила серии — как у пенальти по ходу матча (MatchPenalty). */
.fresh {
  margin-right: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ffd84a;
  color: #1a1a1a;
  font-weight: 800;
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
