<script setup lang="ts">
/**
 * Стенд кадра (065 К-Г, только в разработке): `#/dev/frame/<id реестра>` — сеанс в памяти из фикстуры
 * `tests/fixtures/accepted/<id>.json`, экран кадра открыт в этом состоянии. Хранилище браузера не трогаем.
 * Экрана ещё нет (маршрут — заглушка или нет вовсе) — показываем строку с id и маршрутом, не падаем.
 * Пометка «нет экрана» стоит только на заглушке: у настоящего экрана кадр чистый — его снимает `tools/accepted/shoot.mjs`.
 */
import { computed, provide, shallowRef, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { gameOfPath } from '../../app/base/run';
import type { SchoolStand } from '../../app/school/frame';
import { setSession } from '../../app/save/session';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import LearnWindow from '../../components/learn/LearnWindow.vue';
import StandComic from './StandComic.vue';
import StandNews from './StandNews.vue';
import UpdateWindow from '../system/UpdateWindow.vue';
import { PARENT_STAND, type ParentStand } from '../parent/stand';
import { PATH_STAND, type PathStand } from '../path/stand';
import { cupMatchFrame } from '../../app/cup/frame';
import { frameSession, type FrameFixture } from './frameSession';
import { learnStandOf, type LearnStand } from './learnStand';

const files = import.meta.glob<FrameFixture>('../../../tests/fixtures/accepted/*.json', { import: 'default' });

const id = String(useRoute().params.id ?? '');
const router = useRouter();
const note = shallowRef('');
const view = shallowRef<Component | null>(null);
const props = shallowRef<Record<string, unknown>>({});
// оболочка (шапка и строка низа) — как у App.vue: только экранам без `meta.bare`
const shell = shallowRef('');
// часы кадра для Дома: «сегодня» берётся из фикстуры, а не из браузера (065 К-Г)
const clock = shallowRef({ now: Date.now(), day: new Date().toLocaleDateString('sv-SE') });
provide('kk-home-clock', () => clock.value);
// состояние кадра Дома: семя рассадки, поставщики следующих волн (Кубок, лавка, База…) и окна кадра — из фикстуры; в игре их нет (065-Р64)
const homeStand = shallowRef<Record<string, unknown>>({});
provide('kk-home-stand', () => homeStand.value);
// страница родителя: файл, выбранный на кадре «Загрузить файл» (063 Т11), вкладка и шаг блока «Игроки» (Т12), окно поверх экрана (обновление) — из фикстуры
const parentStand = shallowRef<ParentStand>({});
provide(PARENT_STAND, () => parentStand.value);
// окно «Клуб»: трудные клавиши и открытое окно кадра — из фикстуры (в игре поставщик пуст, 067 Т11)
const clubStand = shallowRef<FrameFixture['club']>({});
provide('kk-club-stand', () => clubStand.value);
// Музей: покупки Двора и ролики кадра — из фикстуры (источники — 068 Т7)
const museumStand = shallowRef<FrameFixture['museum']>({});
provide('kk-museum-stand', () => museumStand.value);
// Путь клуба (067 Т10): вид входа, доля отъезда, деление под мышью — из фикстуры; в игре ключа нет
const pathStand = shallowRef<PathStand>({});
provide(PATH_STAND, () => pathStand.value);
// Лавка: подтверждение покупки на кадре — из фикстуры (067 Т12)
const shopStand = shallowRef<FrameFixture['shop']>({});
provide('kk-shop-stand', () => shopStand.value);
// Пак: открытая фаза на кадре — из фикстуры (067 Т12); в игре пак всегда начинается закрытым
const packStand = shallowRef<FrameFixture['pack']>({});
provide('kk-pack-stand', () => packStand.value);
// Раздевалка: окно «Рассмотреть» или «Игроки», открытое на кадре, — из фикстуры (067 Т13); в игре его открывает ребёнок
const lockerStand = shallowRef<FrameFixture['locker']>({});
provide('kk-locker-stand', () => lockerStand.value);
// Школа (067 Т14): строка журнала под мышью и шаг тура — из фикстуры; в игре поставщика нет
const schoolStand = shallowRef<SchoolStand>({});
provide('kk-school-stand', () => schoolStand.value);
// База (067 Т19): открыта ли доска рекордов на кадре — из фикстуры; в игре поставщика нет
const baseStand = shallowRef<FrameFixture['base']>({});
provide('kk-base-stand', () => baseStand.value);
// Кубок (068 Т5): вкладка, команда под мышью и праздничная доска кадра — из фикстуры; в игре вкладку держит адрес
const cupStand = shallowRef<{ tab?: 'group' | 'bracket'; hover?: string; festive?: boolean }>({});
provide('kk-cup-stand', () => cupStand.value);
// Сюжет (068 Т7): окно газеты поверх экрана кадра — из фикстуры (`story.window.paper`); в игре его открывает вход на Дом или полка Музея
const storyStand = shallowRef<FrameFixture['story']>({});
provide('kk-story-stand', () => storyStand.value);
const newsOpen = computed(() => storyStand.value?.window?.paper !== undefined);
const comicOpen = computed(() => storyStand.value?.window?.comic !== undefined && storyStand.value.window.coachBoard !== true); // доска «плашка × 4 облика» — слой сборки макета, не экран (068-Р28)
// Поля Дома, которых нет в фикстуре, не перекрывают сеанс: `bought: undefined` ронял Дом под окном газеты (кадры Э6)
const defined = (o: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const win = shallowRef<FrameFixture['window']>();
// учебная игра 1–4 (067 Т17): окно поверх перерыва или Базы; время кадра не тикает (`frozenNow`)
const learn = shallowRef<LearnStand | null>(null);
const learnNow = shallowRef(0);

/** Кадры, где макет не рисует баннер «Новая ступень» (проверка длины имён, наведение на стенд): ступень на них та же, что на соседних (065-Р80). */
const NO_BANNER = /^(home\.(long|long-city|news)|paper\.stand)$/;

async function open(): Promise<void> {
  const load = files[`../../../tests/fixtures/accepted/${id}.json`];
  if (!load) {
    note.value = `no fixture: ${id}`;
    return;
  }
  const fx = await load();
  clock.value = fx.clock;
  const h = (fx.home ?? {}) as Record<string, unknown>;
  homeStand.value = { seed: fx.seed, over: defined({ bought: h.bought, round: h.round, end: h.end, region: h.region, festive: /^(home\.(end|long-end)|map\.title)$/.test(id) ? true : undefined, extras: h.extras ?? {} }), peek: id === 'home.peek', coach: id === 'home.coach', noBanner: NO_BANNER.test(id), travel: fx.travel === true, pick: fx.mapPick, win: fx.mapWindow, hardKeys: fx.club?.hardKeys };
  setSession(await frameSession(fx));
  win.value = fx.window;
  learn.value = learnStandOf(fx);
  learnNow.value = fx.clock.now;
  clubStand.value = fx.club ?? {};
  museumStand.value = fx.museum ?? {};
  storyStand.value = fx.story ?? {};
  shopStand.value = fx.shop ?? {};
  packStand.value = fx.pack ?? {};
  lockerStand.value = fx.locker ?? {};
  parentStand.value = { ...fx.stand };
  pathStand.value = { ...fx.path };
  schoolStand.value = { ...fx.school };
  baseStand.value = fx.base ?? {};
  cupStand.value = { ...(fx.tab ? { tab: fx.tab } : {}), ...(fx.hover ? { hover: fx.hover } : {}), ...(fx.festive ? { festive: true } : {}) };
  if (fx.file) {
    const [first] = fx.file.players;
    if (first) {
      const made = await frameSession({ ...fx, exportedAgo: 0, player: first, sections: first.sections, players: fx.file.players });
      const out = made.transfer.exportText(fx.file.made, 'https://example.org/keykick/next/');
      if (out.ok) parentStand.value = { ...parentStand.value, fileText: out.text };
    }
  }
  const rec = router.resolve(fx.route).matched[0];
  const loader = rec?.components?.default;
  if (!rec?.name || !loader) {
    note.value = `${id} · ${fx.route} · no screen yet`;
    return;
  }
  const comp = typeof loader === 'function' && !('__vccOpts' in loader) && !('setup' in loader) ? ((await (loader as () => Promise<{ default: Component }>)()).default) : (loader as Component);
  if ((comp as { __name?: string }).__name === 'ScreenStub') note.value = `${id} · ${fx.route} · stub screen`;
  view.value = comp;
  // карточка клуба поверх Карты: в шапке горит «Клуб», а не «Карта» (Э2.31)
  shell.value = rec.meta.bare === true ? '' : fx.mapWindow === 'club' ? 'club' : typeof rec.meta.menu === 'string' ? rec.meta.menu : String(rec.name);
  props.value = (typeof rec.props === 'object' && rec.props !== null ? (rec.props as { default?: Record<string, unknown> }).default : undefined) ?? {};
  // экран матча (настоящий) получает состояние кадра из фикстуры; заглушкам оно не нужно (065 Т9г)
  if (fx.route === '/match' && (fx.match || fx.cupFrame) && note.value === '') props.value = { ...props.value, frame: fx.cupFrame ? cupMatchFrame(fx.cupFrame, fx.seed) : fx.match };
  // игра на Базе: адрес `/base/<игра>` на стенде не настоящий — игру в экран передаём свойством (067 Т19)
  if (note.value === '' && gameOfPath(fx.route) !== undefined) props.value = { ...props.value, game: gameOfPath(fx.route) };
  // первый запуск: шаг кадра (тренер, приветствие) — из фикстуры (067 Т11)
  if (fx.route === '/start' && fx.start && note.value === '') props.value = { ...props.value, frame: fx.start };
  // «Минута тренера» (067 Т25): шаг кадра, ход минуты и итог — из фикстуры
  if (fx.route === '/coach' && fx.coach && note.value === '') props.value = { ...props.value, frame: fx.coach };
  // экран итога (065 Т10а): готовый вид итога из фикстуры, без записи и без клавиш
  if (fx.route === '/result' && fx.result && note.value === '') props.value = { ...props.value, frame: fx.result };
  // итог матча Кубка (068 Т6): вид строит настоящий свисток по разделам фикстуры и счёту кадра
  if (fx.route === '/result' && fx.cupFrame?.score && note.value === '') props.value = { ...props.value, cupFrame: { round: fx.cupFrame.round, score: fx.cupFrame.score, correct: fx.cupFrame.correct, series: fx.cupFrame.series, award: fx.cupFrame.award, rhythm: fx.cupFrame.rhythm, open: fx.cupFrame.open } };
}
void open();
</script>

<template>
  <div
    class="frame-stand"
    :data-frame="id"
  >
    <ShellHeader
      v-if="shell"
      :page="shell"
    />
    <!-- окно поверх экрана: экран размыт и без подписей, как в кадрах Э6.63/.97 (`overSys` макета) -->
    <component
      :is="view"
      v-if="view"
      v-bind="props"
      :style="win ? 'filter: blur(3px)' : undefined"
    />
    <UpdateWindow
      v-if="win"
      :lines="win.lines ?? []"
    />
    <LearnWindow
      v-if="learn"
      :flow="learn.flow"
      :before="learn.before"
      :kit-body="learn.kitBody"
      :rival-body="learn.rivalBody"
      :layout="learn.layout"
      :stake="learn.stake"
      :frozen-now="learnNow"
      :miss="learn.miss"
    />
    <StandNews
      v-if="newsOpen && view && storyStand"
      :story="storyStand"
    />
    <StandComic
      v-if="comicOpen && view && storyStand"
      :story="storyStand"
    />
    <p
      v-if="note"
      class="frame-stand__note"
    >
      {{ note }}
    </p>
  </div>
</template>

<style scoped>
.frame-stand {
  position: absolute;
  inset: 0;
}
.frame-stand__note {
  position: absolute;
  left: 8px;
  bottom: 8px;
  margin: 0;
  font: 12px/1.2 monospace;
  color: var(--color-text, #fff);
  opacity: 0.7;
}
</style>
