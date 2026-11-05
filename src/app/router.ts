/**
 * Роутер на хэше: GitHub Pages не умеет отдавать index.html на любой путь,
 * а с #/match обновление страницы не даёт 404.
 * Родительская панель открывается только ссылкой #/parent — с главной на неё не ведёт ничего.
 * Игроков двое и больше, а в этой вкладке ещё не выбран — сначала «Кто играет?» (кроме родителя).
 */
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import HomeScreen from '../screens/HomeScreen.vue';
import { cupGuard } from './cup';
import { needsChoice } from './players';
import { clubFirst } from './progress';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeScreen },
  {
    path: '/match',
    name: 'match',
    component: () => import('../screens/MatchScreen.vue'),
    // Без своего клуба матч не начинается: в него ведёт и верхнее меню, не только главная.
    // Матч кубка (?cup=yard) — только у открытого кубка.
    beforeEnter: [clubFirst, cupGuard],
  },
  {
    path: '/cup/:league',
    name: 'cup',
    component: () => import('../screens/CupScreen.vue'),
    beforeEnter: cupGuard,
  },
  { path: '/penalty', name: 'penalty', component: () => import('../screens/PenaltyScreen.vue') },
  { path: '/club', name: 'club', component: () => import('../screens/ClubScreen.vue') },
  { path: '/pack', name: 'pack', component: () => import('../screens/PackScreen.vue') },
  { path: '/locker', name: 'locker', component: () => import('../screens/LockerScreen.vue') },
  { path: '/stats', name: 'stats', component: () => import('../screens/StatsScreen.vue') },
  { path: '/parent', name: 'parent', component: () => import('../screens/ParentScreen.vue') },
  { path: '/players', name: 'players', component: () => import('../screens/PlayersScreen.vue') },
  { path: '/:rest(.*)*', redirect: '/' },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  // Новый экран открывается сверху: иначе матч наследует прокрутку длинной страницы клуба.
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  if (to.name === 'players' || to.name === 'parent' || !needsChoice.value) return true;
  return { name: 'players' };
});
