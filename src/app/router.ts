/**
 * Роутер на хэше: GitHub Pages не умеет отдавать index.html на любой путь,
 * а с #/match обновление страницы не даёт 404.
 * Родительская панель открывается только ссылкой #/parent — с карты на неё не ведёт ничего.
 * Игроков двое и больше, а в этой вкладке ещё не выбран — сначала «Кто играет?» (кроме родителя).
 * Вход в игру — карта (`/` ведёт на неё). Без клуба любой адрес игры уводит на `/start`; урок «впереди» — на карту
 * (охрана входа — `firstRun/entry`, спека 019-Т11).
 */
import { watch } from 'vue';
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { recheckStorage, reportError } from './crash/crash';
import { entryRedirect } from './firstRun/entry';
import { startGuard } from './firstRun/firstRun';
import { clubRef } from './club/club';
import { MAP_PATH, MATCH_PATH, PATH_PATH } from './map/go';
import { needsChoice } from './players/list';
import { tabPlayerRemoved } from './roster';
import { logEvent } from './save/eventLog';
import { hasClub } from '../engine/club/create';

export const routes: RouteRecordRaw[] = [
  // Главная v1 и клуб v1 убраны (019-Т11, Т13): вход в игру — карта.
  { path: '/', redirect: MAP_PATH },
  // Матч v2 (спека 017-Т8): урок по `?lesson=`; витрина `?at=` — только в dev-сборке (охрана входа).
  { path: MATCH_PATH, name: 'match', component: () => import('../screens/match/MatchFlowScreen.vue'), meta: { v2: true } },
  // Прежний временный адрес матча v2 (кадры, закладки) — тот же матч с теми же параметрами (017-Р38).
  { path: '/match2', redirect: (to) => ({ path: MATCH_PATH, query: to.query }) },
  { path: '/parent', name: 'parent', component: () => import('../screens/ParentScreen.vue') },
  { path: '/players', name: 'players', component: () => import('../screens/players/PlayersScreen.vue') },
  // Первый запуск (спека 019-Т6): клуб уже есть — сразу дальше; остальные адреса без клуба сюда уводит `router.beforeEach`.
  {
    path: '/start',
    name: 'start',
    component: () => import('../screens/firstRun/FirstRunScreen.vue'),
    meta: { v2: true },
    beforeEnter: (to) => startGuard(to),
  },
  // Карта Двора (спека 019-Т7): вход в игру, `/` ведёт сюда.
  { path: MAP_PATH, name: 'map', component: () => import('../screens/map/MapScreen.vue'), meta: { v2: true } },
  // «Путь клуба» (спека 019-Т9): шесть мест лиг; ничего не пишет.
  { path: PATH_PATH, name: 'path', component: () => import('../screens/map/PathScreen.vue'), meta: { v2: true } },
  { path: '/:rest(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // Новый экран открывается сверху: иначе матч наследует прокрутку длинной страницы клуба.
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  // meta.free — служебная страница без выбора игрока (обходчик кадров в dev-сборке, добавляется из main.ts).
  const free = to.meta.free === true;
  if (to.name !== 'players' && to.name !== 'parent' && !free && needsChoice.value) return { name: 'players' };
  // Расчёт карты нужен только матчу урока: в общий пакет роутера он не входит.
  const playable = to.path === MATCH_PATH ? (await import('./map/state')).playableNow : () => true;
  const res = entryRedirect({ path: to.path, query: to.query, free }, { hasClub: hasClub(clubRef.value), dev: import.meta.env.DEV, playable });
  return res === true ? true : { path: res };
});

// Игрока этой вкладки удалили в другой (014-Р18): идущую игру бросаем и спрашиваем «Кто играет?».
// Страницы родителя и выбора остаются на месте.
watch(tabPlayerRemoved, () => {
  const cur = router.currentRoute.value;
  if (cur.name === 'players' || cur.name === 'parent' || cur.meta.free === true) return;
  void router.push({ name: 'players' });
});

// Ошибка перехода (в том числе не загрузился чанк экрана после выпуска) — в перехватчик; RouterLink глотает отказ сам.
router.onError((err) => reportError(err, 'router'));
// Журнал событий (спека 014, design §6): куда ходил игрок до сбоя.
router.afterEach((to) => {
  logEvent('screen', to.fullPath);
  // Слой сохранения мог за время игры стать «новее» или «переполнен» — экран по состоянию, без таймера.
  recheckStorage();
});
