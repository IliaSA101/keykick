/**
 * Список кадров обходчика (спека 015, design.md §3). Страница FramesScreen показывает его ссылками
 * `a[data-frame]`, tools/shots.mjs читает ссылки со страницы и снимает каждую. Новые экраны v2 добавляют сюда кадры.
 */
import { PATH_PATH } from '../app/map/go';
import { JUMPS } from '../app/match/jump';
import type { SeedName } from './seed';

export interface Frame {
  /** Латиницей: попадает в имя PNG. */
  id: string;
  /** Раздел страницы и листа. */
  group: string;
  seed: SeedName;
  /** Путь роутера (после #). */
  path: string;
  /** Селектор ссылок на странице: каждая из них — отдельный кадр (блок проверки матча на #/parent). */
  expand?: string;
}

export const FRAMES: readonly Frame[] = [
  // Главная v1 и экран клуба v1 ушли (019-Т11, Т13): вход в игру — карта, клуб правится окном на карте (`map-club-edit`).
  { id: 'players', group: 'players', seed: 'two', path: '/players' },
  { id: 'parent', group: 'parent', seed: 'mid', path: '/parent' },
  // Экран сбоя (спека 014-Т5): сбой, повтор («Позови папу»), «Игра обновилась», миграция, карточка переполнения.
  ...(
    [
      ['crash-error', 'error', 0],
      ['crash-error-again', 'error', 1],
      ['crash-newer', 'newer', 0],
      ['crash-newer-again', 'newer', 1],
      ['crash-migrate', 'migrate', 1],
      ['crash-full', 'full', 1],
    ] as const
  ).map(([id, kind, again]): Frame => ({ id, group: 'crash', seed: 'mid', path: `/dev/crash?kind=${kind}&again=${again}` })),
  // Первый запуск (спека 019-Т6): три шага с образцом в черновике, ничего не пишется (`?at=` — только в dev).
  ...(['card', 'club', 'city'] as const).map(
    (at): Frame => ({ id: `start-${at}`, group: 'start', seed: 'v2-fresh', path: `/start?${new URLSearchParams({ at }).toString()}` }),
  ),
  // Файл сохранения у родителя (спека 014-Т6): блок в готовых состояниях.
  ...(
    [
      'never', 'saved', 'saved-memory', 'save-failed', 'preview', 'preview-broken', 'nothing', 'done', 'done-reloaded',
      'partial', 'partial-reloaded', 'refused', 'newer', 'full', 'found', 'v1', 'copies',
    ] as const
  ).map((state): Frame => ({ id: `parent-backup-${state}`, group: 'parent', seed: 'mid', path: `/dev/backup?state=${state}` })),
  // Карта Двора (спека 019-Т7): день 1 (пузырь тренера), середина, конец; карточка пройденного и «продолжить» —
  // через `?focus=` (только в dev).
  { id: 'map-day1', group: 'map', seed: 'v2-day1', path: '/map' },
  { id: 'map-mid', group: 'map', seed: 'v2-mid', path: '/map' },
  { id: 'map-end', group: 'map', seed: 'v2-end', path: '/map' },
  { id: 'map-card-passed', group: 'map', seed: 'v2-mid', path: '/map?focus=yard-05' },
  { id: 'map-resume', group: 'map', seed: 'v2-mid', path: '/map?focus=yard-17' },
  // «Путь клуба» (спека 019-Т9, design §9): день 1, середина, «Район строится» после 32 уроков.
  { id: 'path-day1', group: 'path', seed: 'v2-day1', path: PATH_PATH },
  { id: 'path-mid', group: 'path', seed: 'v2-mid', path: PATH_PATH },
  { id: 'path-end', group: 'path', seed: 'v2-end', path: PATH_PATH },
  // Т8: лист лиги, «Что нового» (в dev `?news=1` показывает карточку «ещё раз»), карточка флажка, правка клуба.
  { id: 'map-sheet', group: 'map', seed: 'v2-mid', path: '/map?sheet=1' },
  { id: 'map-news', group: 'map', seed: 'v2-mid', path: '/map?news=1' },
  { id: 'map-flag', group: 'map', seed: 'v2-mid', path: '/map?focus=flag-9' },
  { id: 'map-club-edit', group: 'map', seed: 'v2-mid', path: '/map?edit=1' },
  // Матч v2 по фазам (спека 017-Т5а): прыжки app/match/jump, в хранилище ничего не пишется.
  // Ничья — только в уроке, где есть сейв (yard-05): без урока снимался проигрыш 0:8 (017-Р34).
  ...JUMPS.map((at): Frame => ({
    id: `match2-${at}`, group: 'match2', seed: 'mid',
    path: `/match?${new URLSearchParams(at === 'draw' ? { at, lesson: 'yard-05' } : { at }).toString()}`,
  })),
  // Настоящий экран матча (017-Т5в): вступление урока yard-05 и итог победы с монетами.
  { id: 'match2-intro-yard05', group: 'match2', seed: 'v2-mid', path: '/match?lesson=yard-05' },
  { id: 'match2-win-yard05', group: 'match2', seed: 'mid', path: `/match?${new URLSearchParams({ at: 'win', lesson: 'yard-05' }).toString()}` },
];
