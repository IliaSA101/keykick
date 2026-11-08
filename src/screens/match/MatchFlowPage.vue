<script setup lang="ts">
/*
 * Содержимое страницы матча v2 (#/match, спека 017-Т5в, Т8); оболочка с ключом — `MatchFlowScreen`. Поток (`app/match/flow`) + экран `MatchScreen` + итог `MatchResult`.
 * Клавиши ловит сам экран (на всё окно); здесь события экрана превращаются в действия потока.
 * `?lesson=<id>` — обычный матч этого урока: итог, звёзды, монеты, «следующий урок» и F5 (017-Р4) пишутся в сохранение
 * игрока (`app/match/saveStore`), нажатия — в журнал (`logMatchKeys`, 018-Р24).
 * `?at=<фаза>&lesson=<id>` — витрина (прыжок к фазе, app/match/jump), только в dev-сборке: хранилище в памяти, ничего не пишет.
 * Выход из итога (019-Т10): «Дальше» — `startMatchday(итог матча)`, цепочка шагов и карта; «На сегодня хватит» — сразу карта.
 */
import { computed, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MatchResult from '../../components/matchResult/MatchResult.vue';
import { courseLessons } from '../../app/course/load';
import { matchCtx, matchSides, resultExtras, rivalSeed, yardSides } from '../../app/match/context';
import { createMatchFlow, type MatchFlow } from '../../app/match/flow';
import { jumpQuery, jumpWith } from '../../app/match/jump';
import { hasAt } from '../../app/match/showcase';
import { lessonById, matchRival, matchRules } from '../../app/match/load';
import { MAP_PATH } from '../../app/map/go';
import { startMatchday } from '../../app/matchday/run';
import { createSaveMatchStore } from '../../app/match/saveStore';
import { logMatchKeys } from '../../app/journal/boot';
import { readSection, updatePlayer } from '../../app/save/sections';
import { activeId } from '../../app/players/active';
import { localDay } from '../../app/session';
import { memoryMatchStore } from '../../app/match/store';
import { tallyStore, type TalliedStore } from '../../app/match/tally';
import { clubRef } from '../../app/club/club';
import { clubData } from '../../app/kits';
import { tasks } from '../../app/tasks';
import { hasClub } from '../../engine/club/create';
import { resultModel } from '../../engine/matchResult/resultModel';
import type { Offer } from '../../engine/match/verdict';
import { dev } from '../../i18n/ru/dev';
import { ru } from '../../i18n/ru';
import MatchScreen from './MatchScreen.vue';

const t = dev.match2;
const route = useRoute();
const router = useRouter();
const jq = jumpQuery(route.query);
const asked = jq?.lessonId ?? (typeof route.query.lesson === 'string' ? route.query.lesson : null);
const found = asked ? lessonById(asked) : undefined;
const lesson = found ?? courseLessons.find((l) => !l.friendly) ?? courseLessons[0];
if (!lesson) throw new Error('no lessons');
const unknownLesson = asked !== null && !found;

// Хранилище с подсчётом: итогу нужны данные до матча и верные нажатия с его начала.
const held: { store?: TalliedStore } = {};
const wrap = (s: Parameters<typeof tallyStore>[0]): TalliedStore => (held.store = tallyStore(s));
// Любой `at` в адресе — витрина (общее правило `hasAt`): хранилище в памяти, в сохранение ничего не пишется, даже при незнакомой фазе.
const showcase = hasAt(route.query);
const saving = (): Parameters<typeof tallyStore>[0] =>
  createSaveMatchStore({ layer: { updatePlayer, readSection }, player: activeId, rules: matchRules, keys: logMatchKeys });
const flow: MatchFlow = jq
  ? jumpWith(jq.at, lesson, true, wrap).flow
  : createMatchFlow({ lesson, store: wrap(showcase ? memoryMatchStore(matchRules, {}) : saving()) });
const tally = held.store;
if (!tally) throw new Error('no store');
const view = flow.view;

// Соперник и форма — один на матч (зерно от урока и клуба, 017-Р43): «Ещё раз» и F5 играют с тем же.
// Клуб v2 — «Двор на <улица>» его города; без клуба (витрина dev-сборки на чистом профиле) — прежний выбор соперника.
const club = clubRef.value;
const seed = rivalSeed(lesson.id, hasClub(club) ? club.name : '');
const sides = hasClub(club)
  ? yardSides({ club, worn: null, rivalOf: (kit) => matchRival({ city: club.city, kit }, seed) })
  : matchSides({ club: null, usKit: null, usDefault: ru.match.us, data: clubData, seed });

const ctx = computed(() => {
  void view.value; // вид меняется после каждого действия — состояние машины читаем за ним
  // Урок — тот, что идёт в матче: при смягчении (017-Р55) это копия с длинами и порогами прошлого урока.
  return matchCtx({ lesson: flow.state().cfg.lesson, rules: matchRules, tasks, sides, state: flow.state(), comeback: flow.comeback, softened: flow.state().cfg.softened });
});
const extras = computed(() => {
  void view.value;
  return resultExtras(flow.state(), tally.read(), tally.totals());
});

// Выход из итога: двойной щелчок и Enter подряд уводят один раз.
let leaving = false;

/** «Дальше»: итог → цепочка матчдэя (пока шагов нет — карта). */
function onNext(): void {
  const info = view.value.result;
  const summary = info ? flow.summary(resultModel(info, extras.value), localDay) : null;
  if (leaving || !summary) return;
  leaving = true;
  startMatchday(summary);
}

/** Выбор после провала; «На сегодня хватит» — матч закрыт, дальше карта без цепочки. */
function onChoose(offer: Offer): void {
  if (leaving) return;
  flow.choose(offer);
  if (offer !== 'quit') return;
  leaving = true;
  void router.push(MAP_PATH);
}

/** Пауза → «Выйти»: матч брошен (что записано — остаётся, как при F5), дальше карта. */
function onQuit(): void {
  if (leaving) return;
  leaving = true;
  flow.quit();
  void router.push(MAP_PATH);
}

onBeforeUnmount(() => flow.dispose());
</script>

<template>
  <div>
    <p
      v-if="unknownLesson"
      class="note"
    >
      {{ t.unknownLesson }}
    </p>
    <MatchScreen
      :view="view"
      :ctx="ctx"
      @start="flow.start()"
      @press="(p) => flow.press(p)"
      @kick-answer="(r) => flow.answerKick(r)"
      @skip-kick="flow.skipKick()"
      @to-second-half="flow.toSecondHalf()"
      @pause="flow.pause()"
      @resume="flow.resume()"
      @quit="onQuit"
    >
      <template #result="{ view: v }">
        <MatchResult
          v-if="v.result"
          :info="v.result"
          :extras="extras"
          :us="ctx.usName"
          :rival="ctx.rivalName"
          @choose="onChoose"
          @next="onNext"
        />
      </template>
    </MatchScreen>
    <p v-if="view.phase === 'quit'">
      <RouterLink :to="MAP_PATH">
        {{ t.home }}
      </RouterLink>
    </p>
  </div>
</template>

<style scoped>
.note {
  font-weight: 700;
}
</style>
