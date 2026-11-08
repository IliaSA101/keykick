/** Маршрут обходчика и отметка готовности страницы; подключаются из main.ts только при import.meta.env.DEV. */
import type { Router } from 'vue-router';

export function addDevRoutes(router: Router): void {
  router.addRoute({
    path: '/dev/frames',
    name: 'dev-frames',
    // Список кадров открывается и без выбора игрока.
    meta: { free: true },
    component: () => import('./FramesScreen.vue'),
  });
  // Витрина экрана матча v2 по фазам (спека 017, Т6).
  router.addRoute({
    path: '/dev/match',
    name: 'dev-match',
    meta: { free: true },
    component: () => import('./match/MatchShowcase.vue'),
  });
  // Экран сбоя и настоящие сбои для проверки перехвата (спека 014-Т5).
  router.addRoute({
    path: '/dev/crash',
    name: 'dev-crash',
    meta: { free: true },
    component: () => import('./CrashDemo.vue'),
  });
  // Блок «Файл сохранения» в готовых состояниях (014-Т6).
  router.addRoute({
    path: '/dev/backup',
    name: 'dev-backup',
    meta: { free: true },
    component: () => import('./BackupDemo.vue'),
  });
  // Кнопка «Сломать» на странице родителя (014-Т6).
  void import('./breakButton').then((m) => m.mountBreakButton());
  // Снимок кадров ждёт этой отметки: переход и ленивый экран готовы, Vue дорисовал.
  void router.isReady().then(() => {
    requestAnimationFrame(() => {
      document.documentElement.dataset.kkReady = '1';
    });
  });
}
