<script setup lang="ts">
/*
 * Экран матча: показ хода матча (app/matchFlow — фазы, удары, счёт, сохранение), ввод и справка.
 * Ввод — с клавиатуры всего окна: ребёнку не нужно никуда кликать перед печатью.
 * Пенальти по ходу матча (спека 005) — слой с задачей вместо строки и клавиатуры: буквы идут
 * в поле ответа, а не в печать; «Не бить» — только кнопкой (005-Р25), после ответа Пробел — играем дальше.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ErrorReserve from '../components/ErrorReserve.vue';
import HandsHelp from '../components/HandsHelp.vue';
import HandsView from '../components/HandsView.vue';
import KeyboardView from '../components/KeyboardView.vue';
import LineProgress from '../components/LineProgress.vue';
import MatchHalftime from '../components/MatchHalftime.vue';
import MatchIntro from '../components/MatchIntro.vue';
import MatchPenalty from '../components/MatchPenalty.vue';
import MatchPitch from '../components/MatchPitch.vue';
import MatchResult from '../components/MatchResult.vue';
import MatchSide from '../components/MatchSide.vue';
import TypingLine from '../components/TypingLine.vue';
import { cupMatch, openLeagueOf } from '../app/cup';
import { decisiveCaption } from '../app/decisiveText';
import { keymap } from '../app/keymap';
import { clubData } from '../app/kits';
import { jump, previewOf } from '../app/matchJump';
import { useMatchFlow } from '../app/matchFlow';
import { basicBoots } from '../app/boots';
import { lessons } from '../app/lessons';
import { currentLesson, markHandsHelpSeen, ourBoots, ourKit, progress } from '../app/progress';
import { featureFresh } from '../app/unlocks';
import { viewport } from '../app/viewport';
import { pickRival, rivalKit, shirtBack } from '../engine/club';
import { shiftFor } from '../engine/keymap';
import { MATCH_HALVES, decisiveReserve, seriesIsNew } from '../engine/match';
import { minigameAt } from '../engine/minigames';
import { expectedHit, expectedThumb, formatClock, halfTime, type KeyPress } from '../engine/typing';
import { cupOfUnlock } from '../engine/unlocks';
import { ru } from '../i18n/ru';

/** Пустая подсказка держит высоту строки, чтобы клавиатура не прыгала. */
const NBSP = String.fromCharCode(0xa0);

/*
 * Быстрые проверки (app/matchJump): #/match?at=…, &lesson=…, &cup=…&round=…, ?minigame=… — сразу
 * в нужное место матча, в сохранение ничего не пишется. На сайте ведут к ним только ссылки
 * со страницы родителя (ParentCheck), при разработке — и адрес руками.
 */
const route = useRoute();
const check = previewOf(route.query);
const preview = check !== null;

// Матч кубка (#/match?cup=yard): урок и соперник — текущего раунда, урок игрока он не сдвигает.
const cupLeague = check?.cup?.league ?? openLeagueOf(route.query.cup);
const cup = cupLeague ? cupMatch(cupLeague, check?.cup?.round) : null;
// Зерно — от часов: каждый матч новый. Движок сам часов не видит.
const flow = useMatchFlow({
  lesson: check?.lesson ?? cup?.lesson ?? currentLesson(),
  seed: Date.now() % 2147483647,
  cup,
  preview,
});
const { lesson, seed, warmKicks, phase, half, lines, lineIndex, warming, typing, score, decisive, typingNow } = flow;
const { shot, banner, stars, unlocked, decisiveErrors, totalStats, cupNote, record, opened } = flow;
const { rowsTotal, rowsDone, rowsBefore, rowsAfter, begin, startSecondHalf } = flow;
const { rules, passed, seriesStart, seriesNo } = flow;
const { turn, penaltyTask, matchPenaltyCoins } = flow;
// «Новое!» у пенальти — на первом уроке после его вехи; в быстрой проверке — всегда, чтобы видеть.
const penaltyFresh = preview || featureFresh('midPenalty');
// «Новое!» у правила решающей серии — на первом уроке лиги, где серия длиннее прошлой (008-Р6).
const seriesFresh = seriesIsNew(lessons, lesson.id);
// &task=<id> — задача пенальти в at=penalty (проверка листа на любой задаче).
if (check?.at) jump(flow, check.at, check.stars, typeof route.query.task === 'string' ? route.query.task : undefined);

// Соперник-персонаж урока («Фыва», «Олдж») — без города; иначе — выдуманный клуб.
// Зерно соперника — номер матча, а не часы: вернулся на вступление — тот же соперник.
const rivalSeed = Math.ceil(progress.matches / MATCH_HALVES) * 7919 + 1;
// Форма на матч — надетая в шкафчике (или домашняя); соперник — в заметно другой.
// Соперник кубка постоянный для раунда — и форма его по постоянному зерну.
const usKit = ourKit();
const rival = cup
  ? { ...cup.rival, kit: rivalKit(clubData, cup.rival.name, usKit, 1) }
  : lesson.rival
    ? { name: lesson.rival, city: null, kit: rivalKit(clubData, lesson.rival, usKit, rivalSeed) }
    : pickRival(clubData, progress.club, rivalSeed, usKit);
/*
 * Широкое окно: по бокам поля — крупные формы и названия команд, на табло и во вступлении
 * тогда маленьких форм нет (одна пара форм на экране). Окно 1024 — формы на табло, как было.
 */
const sides = computed(() => viewport.sideRoom && usKit !== null);
const back = shirtBack(progress.club);
const usName = progress.club?.name ?? ru.match.us;
// «К сетке кубка» в итоге: матч кубка — к его сетке; урок-веха открыл раунд — к сетке того кубка (спека 002).
const cupTo = computed(() => {
  const league = cup?.league ?? opened.value.map(cupOfUnlock).find((c) => c !== null)?.league;
  return league ? `/cup/${league}` : null;
});
// Мини-игры по очереди: номер перерыва — сыгранные матчи (в поле matches — таймы, по два на матч).
// Вверх: матч, брошенный после первого тайма, тоже считается — иначе снова та же игра.
const minigame = check?.game ?? minigameAt(Math.ceil(progress.matches / MATCH_HALVES));

/** Справка «Как держать руки»: сама — перед первым матчем игрока, потом — кнопкой. Открыта — ввод на паузе. */
const helpOpen = ref(!preview && !progress.handsHelpSeen);

function closeHelp(): void {
  helpOpen.value = false;
  if (!preview) markHandsHelpSeen();
  // Фокус — обратно на кнопку справки (пробел и Enter с неё печать не ломают).
  void nextTick(() => globalThis.document.querySelector<HTMLElement>('.help-btn')?.focus());
}

const caption = computed(() => {
  // Матч кубка: во вступлении «Кубок дворовой лиги · 1/2 финала» — в карточке (MatchIntro), не на табло:
  // строка табло растила вступление за край окна 640. В таймах — раунд перед таймом.
  if (phase.value === 'intro') return '';
  const n = lineIndex.value + 1;
  if (warming.value) return `${ru.match.warmup.title} · ${ru.match.warmup.kick} ${n} ${ru.match.of} ${warmKicks.length}`;
  const halfName = (cup ? `${cup.roundName} · ` : '') + (ru.match.halves[half.value - 1] ?? '');
  if (decisive.value) return `${halfName} · ${decisiveCaption(rules, seriesNo.value)}`;
  if (phase.value === 'penalty') return `${halfName} · ${ru.midPenalty.caption}`;
  return `${halfName} · ${ru.match.attack} ${n} ${ru.match.of} ${lines.value.length}`;
});
// Время матча — по промежуткам между нажатиями: удары, надписи и перерыв не считаются.
const clock = computed(() => {
  if (warming.value) return null;
  const before = flow.firstStats.value ? halfTime(flow.firstStats.value) : 0;
  return formatClock(before + halfTime(typing.value.stats));
});

const hit = computed(() => (typingNow.value ? expectedHit(keymap, typing.value) : null));
const target = computed(() => hit.value?.key ?? null);
// Пробел — большим другой руки, чем прошлая буква.
const thumb = computed(() => (typingNow.value ? expectedThumb(keymap, typing.value) : null));
const shiftFinger = computed(() => {
  if (!hit.value?.shift) return null;
  return keymap.byCode.get(shiftFor(hit.value.key.finger))?.finger ?? null;
});

// Ошибки решающей серии: прошлые атаки серии и текущая строка — запас общий на серию (008-Р4).
const seriesErrors = computed(() => decisiveErrors.value + typing.value.lineErrors);
// Запас ошибок решающей — мячами в строке статуса (спека 003); после 5-й атаки мячи не возвращаются.
const reserve = computed(() => (decisive.value ? decisiveReserve(seriesErrors.value, rules) : null));
// Предупреждение (раскладка, Caps Lock, цифры) длиннее «Бей пальцем: …»: пока оно горит, у мячей нет
// подписи «Можно ошибиться:» — мячи остаются, а предупреждение помещается целиком в одну строку.
const warning = computed(() => typingNow.value && typing.value.hint !== null && typing.value.hint !== 'finger');

const hint = computed(() => {
  const h = typingNow.value ? typing.value.hint : null;
  if (h === null) {
    // Решающая: вызов себе, пока серия чистая; после ошибки (и в прошлой атаке серии) вызов звучал бы
    // насмешкой — поддержка (008-Р10).
    if (decisive.value) {
      return seriesErrors.value > 0 ? ru.match.decisiveHint.after : ru.match.decisiveHint.clean;
    }
    // Первый удар разминки: подсказка, что делать, — пока тренер молчит.
    return warming.value && phase.value === 'warmup' && lineIndex.value === 0 ? ru.match.warmup.hint : null;
  }
  if (h === 'finger') {
    if (!target.value) return null;
    const name = thumb.value ? ru.keyboard.thumbs[thumb.value] : ru.keyboard.fingers[target.value.finger];
    return `${ru.match.hints.finger} ${name}`;
  }
  return ru.match.hints[h];
});

/**
 * Клавиши слоя пенальти. До ответа буквы, цифры, Enter — полю ответа (PenaltyTask), здесь ничего:
 * Esc мимо поля не должен отнимать удар — «Не бить» только кнопкой (005-Р25). После ответа
 * Пробел — играем дальше (Enter нет: лишний Enter не сбивает разбор).
 */
function onPenaltyKey(e: KeyboardEvent): void {
  if (turn.value?.result === null) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) flow.resumePlay();
  }
}

function onKey(e: KeyboardEvent): void {
  // Открыта справка — клавиши её (листать, Esc), в строку не идут.
  if (helpOpen.value) return;
  if (phase.value === 'penalty') return onPenaltyKey(e);
  if (phase.value === 'intro') {
    // Пробел на кнопке «Начать» сработает и сам — не запускаем дважды. Кнопка справки
    // пробел гасит (defaultPrevented) — с неё пробел начинает тайм, как с пустого места.
    if (e.code === 'Space' && (!(e.target instanceof HTMLButtonElement) || e.defaultPrevented)) {
      e.preventDefault();
      flow.begin();
    }
    return;
  }
  if (!typingNow.value) return;
  const press: KeyPress = {
    code: e.code,
    key: e.key,
    repeat: e.repeat,
    mod: e.ctrlKey || e.altKey || e.metaKey,
    caps: e.getModifierState('CapsLock'),
    time: e.timeStamp,
  };
  // Печатный символ не должен листать страницу (пробел) или открывать поиск (/ и ' в Firefox).
  if (!press.mod && [...e.key].length === 1) e.preventDefault();
  flow.press(press);
}

// Без клуба сюда не пускает страж маршрута (clubFirst в router.ts).
onMounted(() => globalThis.addEventListener('keydown', onKey));

onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey);
  flow.dispose();
});
</script>

<template>
  <MatchResult
    v-if="phase === 'done'"
    :score="score"
    :stats="totalStats"
    :stars="stars"
    :unlocked="unlocked"
    :decisive-errors="decisiveErrors"
    :passed="passed"
    :rules="rules"
    :cup-note="cupNote"
    :record="record"
    :opened="opened"
    :cup-to="cupTo"
    :penalty-coins="matchPenaltyCoins"
  />
  <MatchHalftime
    v-else-if="phase === 'halftime'"
    :game="minigame"
    :seed="seed"
    :known="lesson.keys"
    :us="usName"
    :rival="rival.name"
    :goals="score.goals"
    :conceded="score.conceded"
    :paid="!preview"
    @done="startSecondHalf"
  />
  <div
    v-else
    class="match"
    :class="{ sides }"
  >
    <MatchSide
      v-if="sides && usKit"
      class="side"
      :kit="usKit"
      :back="back"
      :boots="ourBoots()"
      :role="ru.match.you"
      :name="usName"
    />
    <div class="column">
      <MatchPitch
        :us="usName"
        :rival="rival.name"
        :us-kit="sides ? null : usKit"
        :rival-kit="sides ? null : rival.kit"
        :goals="score.goals"
        :conceded="score.conceded"
        :penalties="score.penalties.scored"
        :caption="caption"
        :decisive="decisive"
        :clock="clock"
        :shot="shot?.result ?? null"
        :shot-id="String(shot?.no ?? 0)"
        :shot-text="shot?.warm ? ru.match.warmup.shot : null"
        :banner="banner"
      >
        <MatchIntro
          v-if="phase === 'intro'"
          :lesson="lesson"
          :us-kit="sides ? null : usKit"
          :rival-kit="sides ? null : rival.kit"
          :cup="cup !== null"
          :cup-title="cup?.title ?? null"
          :rules="rules"
          :fresh-rule="seriesFresh"
          @start="begin"
        />
        <MatchPenalty
          v-else-if="phase === 'penalty' && turn && penaltyTask"
          :task="penaltyTask"
          :turn="turn"
          :fresh="penaltyFresh"
          @answered="(correct) => flow.answerPenalty(correct ? 'scored' : 'missed')"
          @skip="flow.answerPenalty('skipped')"
          @resume="flow.resumePlay()"
        />
        <!-- Пока ждём надпись, клавиши не принимаются — строка приглушена, чтобы ребёнок не
             начинал печатать и не терял первые буквы. -->
        <TypingLine
          v-else
          :class="{ waiting: phase === 'wait' }"
          :state="typing"
          :before="rowsBefore"
          :after="rowsAfter"
        />
      </MatchPitch>

      <!-- Справка — поверх поля, в углу: и во вступлении, и во время печати. Пробел с неё идёт
           в строку (или начинает тайм); Enter открывает её только вне печати. -->
      <button
        v-if="phase !== 'penalty'"
        type="button"
        class="help-btn"
        @click="helpOpen = true"
        @keydown.space.prevent
        @keyup.space.prevent
        @keydown.enter.stop="typingNow && $event.preventDefault()"
      >
        {{ ru.match.handsHelp }}
      </button>
      <HandsHelp
        v-if="helpOpen"
        @close="closeHelp"
      />

      <!-- Во вступлении строка подсказки пуста: её место нужнее клавиатуре (окно 1024×640).
           Полоска хода — в той же строке, что подсказка: высоту экрана она не растит. -->
      <!-- Пенальти: слой с задачей занял место строки статуса и клавиатуры. -->
      <div
        v-if="phase !== 'penalty'"
        class="status"
        :class="{ idle: phase === 'intro' }"
      >
        <LineProgress
          class="line-progress"
          :total="rowsTotal"
          :done="rowsDone"
          :state="typing"
          :gold-from="!warming && half === MATCH_HALVES ? seriesStart : null"
        />
        <ErrorReserve
          v-if="reserve !== null"
          :left="reserve"
          :total="rules.maxErrors"
          :compact="warning"
        />
        <p
          class="hint"
          role="status"
        >
          {{ hint ?? NBSP }}
        </p>
      </div>

      <div
        v-if="phase !== 'penalty'"
        class="board"
      >
        <KeyboardView
          :target="target"
          :thumb="thumb"
          :shift="hit?.shift ?? false"
          :error="typing.last === 'error'"
          :errors="typing.stats.errors"
          :layout="lesson.layout"
        />
        <div class="hands">
          <HandsView
            :finger="target?.finger ?? null"
            :thumb="thumb"
            :shift-finger="shiftFinger"
          />
        </div>
      </div>
    </div>
    <MatchSide
      v-if="sides"
      class="side"
      :kit="rival.kit"
      :boots="basicBoots"
      :role="ru.match.rival"
      :name="rival.name"
      :city="rival.city"
    />
  </div>
</template>

<style scoped>
/*
 * Размеры — окна 1024×640: клавиатура 760, строка 2rem и поле 230 (TypingLine, MatchPitch).
 * На больших окнах матч растёт целиком, одним множителем (App.vue, app/viewport), — отдельные
 * части здесь не растут.
 */
.match {
  --board-w: 760px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: var(--space-3);
}

/* Колонка матча: поле, подсказка, клавиатура. Справка — в её углу. */
.column {
  flex: 0 1 calc(var(--board-w) + 60px);
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Формы по бокам занимают и поля страницы: на окне 1680 колонке формы нужно ~110 px. */
.match.sides {
  margin-inline: calc(var(--space-2) - var(--space-5));
}

.side {
  flex: 1 1 0;
  min-width: 0;
  max-width: 220px;
  padding-top: var(--space-4);
}

.waiting {
  opacity: 0.35;
  transition: opacity 0.2s;
}

.help-btn {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
  padding: 4px 12px;
  border: 1px solid rgb(244 194 74 / 0.6);
  border-radius: 999px;
  background: rgb(10 20 40 / 0.78);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.help-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 1.5em;
}

.status.idle {
  display: none;
}

.line-progress {
  flex: 0 0 230px;
}

/* Подсказка — всегда одна строка: вторая растила страницу матча за край окна 640
   (тексты держит короткими тест в guards.test.ts, обрезка — запас на узкое окно).
   Ширина — под «Бей пальцем: правый указательный» рядом с тремя мячами и подписью; предупреждения
   длиннее — рядом с мячами без подписи (warning). */
.hint {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: center;
  font-weight: 700;
  color: var(--accent);
}

/*
 * Руки поверх клавиатуры: та же ширина, тот же верх и шкала (HandsView), указательные и средние —
 * над основным рядом. Картинка полупрозрачная, чтобы буквы под пальцами читались; метки — нет.
 */
.board {
  position: relative;
  max-width: var(--board-w);
  width: 100%;
  margin: 0 auto;
  /* Запас под ногти больших пальцев (они ниже пробела); что ниже — обрезается, а не растит
     страницу (окно 1024×640 без прокрутки; 12 px из 30 взяты у отступа над полем, App.vue). */
  padding-bottom: 30px;
  overflow: hidden;
}

.hands {
  position: absolute;
  inset: 0 0 auto;
  --hands-opacity: 0.45;
  pointer-events: none;
}
</style>
