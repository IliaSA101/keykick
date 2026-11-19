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

/** Адреса экранов волны 4: Школа (журнал, тур, штрафные), Раздевалка, База и игра Базы. */
const WAVE4_ROUTES = [
  ['school', '/school'],
  ['school-tour', '/school/tour'],
  ['school-waits', '/school/waits'],
  ['school-kicks', '/school/kicks'],
  ['locker', '/locker'],
  ['base', '/base'],
  ['base-game', '/base/:game'],
  ['coach', '/coach'],
] as const;

/** Готовые экраны волны 4 по имени маршрута; остальные — заглушка. Заглушка получает `title`, живой экран — нет (проп ушёл бы атрибутом на корень). */
const WAVE4_SCREENS: Partial<Record<(typeof WAVE4_ROUTES)[number][0], () => Promise<unknown>>> = {
  school: () => import('../../screens/school/SchoolScreen.vue'),
  'school-tour': () => import('../../screens/school/TourScreen.vue'),
  'school-waits': () => import('../../screens/school/TourWaits.vue'),
  'school-kicks': () => import('../../screens/school/KicksScreen.vue'),
  locker: () => import('../../screens/album/LockerScreen.vue'),
  base: () => import('../../screens/base/BaseScreen.vue'),
  'base-game': () => import('../../screens/fun/FunShell.vue'),
  // «Минута тренера» (067 Т25): с панели Базы и из «Застрял»; шапка — как у Базы (пункт «Дом»), строку экрана рисует сам
  coach: () => import('../../screens/coach/CoachScreen.vue'),
};

const title = (id: string): string => (id in ru.frame.menu ? ru.frame.menu[id as keyof typeof ru.frame.menu] : ru.shell.building);

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  // `title` получает только заглушка: у живых экранов проп уходил бы атрибутом на корень (всплывала подсказка «Клуб» над экраном)
  ...MENU_ROUTES.map((id) => {
    const screen = id === 'home' ? () => import('../../screens/home/HomeScreen.vue') : id === 'path' ? () => import('../../screens/path/PathScreen.vue') : id === 'map' ? () => import('../../screens/map/MapScreen.vue') : id === 'club' ? () => import('../../screens/club/ClubScreen.vue') : null;
    return screen ? { path: `/${id}`, name: id, component: screen } : { path: `/${id}`, name: id, component: stub, props: { title: title(id) } };
  }),
  // Музей клуба (067 Т11): здание Дома — в шапке подсвечен пункт «Дом» (`meta.menu`); ярлык открывает его, когда замок снят
  { path: '/museum', name: 'museum', meta: { menu: 'home' }, component: () => import('../../screens/museum/MuseumScreen.vue') },
  // Лавка (067 Т12): здание Дома — в шапке подсвечен «Дом»; пак после матча — сам рисует шапку «матч», как итог
  { path: '/shop', name: 'shop', meta: { menu: 'home' }, component: () => import('../../screens/shop/ShopScreen.vue') },
  { path: '/pack', name: 'pack', meta: { bare: true }, component: () => import('../../screens/album/PackScreen.vue') },
  // адреса волны 4 (067 К-А): заглушки, пока экраны не сделаны; каждая задача меняет только свою строку
  ...WAVE4_ROUTES.map(([name, path]) => {
    const screen = WAVE4_SCREENS[name];
    // «Тур ждёт» — звено цепочки после матча: сама рисует шапку «матч» (067-Р133), как пак
    if (name === 'school-waits') return { path, name, meta: { bare: true }, component: WAVE4_SCREENS[name] ?? stub };
    const meta = path.startsWith('/school') || path.startsWith('/base') || name === 'locker' || name === 'coach' ? { menu: 'home' } : {};
    return screen ? { path, name, meta, component: screen } : { path, name, meta, component: stub, props: { title: ru.shell.building } };
  }),
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
