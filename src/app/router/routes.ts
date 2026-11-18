/**
 * Маршруты (хэш, F5 без 404). Адреса Двора — те же, что знает модель навигации (`engine/nav/address.ts`):
 * `/home`, `/map`, `/cup`, `/path`, `/club`; остальные — входы приложения (063 §1). Экраны — заглушки, пока их не сделают волны.
 */
import type { RouteRecordRaw } from 'vue-router';
import { ru } from '../../i18n/ru';

const stub = () => import('../../screens/stubs/ScreenStub.vue');

/** Пункты меню Двора и их заглушки: id совпадает с экраном модели навигации. */
export const MENU_ROUTES = ['home', 'map', 'cup', 'path', 'club'] as const;
/** Входы вне меню: первый запуск, «Кто играет?», родитель (на него с экранов игры ссылок нет). */
export const ENTRY_ROUTES = ['start', 'who', 'parent'] as const;

const title = (id: string): string => (id in ru.frame.menu ? ru.frame.menu[id as keyof typeof ru.frame.menu] : ru.shell.building);

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  ...MENU_ROUTES.map((id) => ({ path: `/${id}`, name: id, component: id === 'home' ? () => import('../../screens/home/HomeScreen.vue') : id === 'map' ? () => import('../../screens/map/MapScreen.vue') : stub, props: { title: title(id) } })),
  // входы: оболочка без шапки и строки низа (`meta.bare`), экраны — Т6 и Т11
  ...ENTRY_ROUTES.map((id) => ({
    path: `/${id}`,
    name: id,
    meta: { bare: true },
    component: id === 'start' ? () => import('../../screens/start/StartScreen.vue') : id === 'parent' ? () => import('../../screens/parent/ParentScreen.vue') : stub,
    props: { title: title(id) },
  })),
  // «Открой на компьютере» (059-В7, 063 Т12б): куда охрана ведёт телефон и планшет без клавиатуры; на компьютере адрес ведёт домой
  { path: '/phone', name: 'phone', meta: { bare: true }, component: () => import('../../screens/phone/PhoneScreen.vue') },
  // матч (065 Т9): сам рисует шапку «матч»; итог (065 Т10а) забирает `takeFinished`
  { path: '/match', name: 'match', meta: { bare: true }, component: () => import('../../screens/match/MatchScreen.vue') },
  { path: '/result', name: 'result', meta: { bare: true }, component: () => import('../../screens/result/ResultScreen.vue') },
  // лист сверки частей ЭБ: только в разработке; в выпускную сборку ветка не попадает (страж С5)
  ...(import.meta.env.DEV ? [{ path: '/dev/kit', name: 'dev-kit', meta: { bare: true }, component: () => import('../../screens/dev/KitSheet.vue') }] : []),
  // стенд кадров (065 К-Г): экран в состоянии фикстуры, сеанс в памяти; только в разработке
  ...(import.meta.env.DEV ? [{ path: '/dev/frame/:id', name: 'dev-frame', meta: { bare: true }, component: () => import('../../screens/dev/FrameStand.vue') }] : []),
  { path: '/:rest(.*)*', redirect: '/home' },
];
