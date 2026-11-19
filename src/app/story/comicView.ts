/**
 * Вид комикса Двора (068 Т7, Э6.14–.21): из id комикса, клуба и нашей группы — заголовок окна и две панели (050-Р42, 068-Р27: две, а не три).
 * Чистая функция: тексты — `ru.story.comic`, геометрия пузырей (точка хвоста — на голове говорящего, доли панели) — по макету `tools/mock-story/comics.mjs`.
 * Панели: кадр Magnific (`art`), «табло группы» кодом (Выход из группы, п. 1), реплика тренера плашкой, пузыри героев, «САША 7» печатью.
 */
import type { StoryArtKey } from '../art/storyArt';
import { fill } from '../home/texts';
import { ru } from '../../i18n/ru';
import { TEAMS, type GroupView } from '../../engine/cup';
import type { ComicId } from '../../engine/story';

const t = ru.story.comic;

/** Пузырь героя: `at` — точка хвоста (доли панели x, y), `w` — ширина, `sh` — сдвиг пузыря вправо относительно хвоста. */
export interface ComicBubble { text: string; at: [number, number]; w: number; sh: number }
/** Печать «САША 7»: на майке капитана «Завязки» или на спине капитана «Финала». */
export type ComicPrint = 'shirt' | 'back';
export interface TableRow { place: number; name: string; pts: number; our: boolean }
export interface ComicPanel {
  /** Кадр панели (ключ `story-art.json`); у «табло» — фон за листом. */
  art: StoryArtKey;
  /** Ключевая панель (16:9, шире боковой). */
  key: boolean;
  bubble?: ComicBubble;
  /** Реплика тренера плашкой рассказчика сверху или снизу. */
  narrator?: { text: string; pos: 'top' | 'bottom' };
  print?: ComicPrint;
  /** Табло группы кодом на листе газетной бумаги. */
  table?: { head: string; rows: TableRow[] };
}
export interface ComicView {
  id: ComicId;
  title: string;
  panels: [ComicPanel, ComicPanel];
  /** Имя и номер на печати («САША», 7); пусто и 0 — печати нет. */
  print: { name: string; num: number };
}

/** Что комиксу нужно от клуба и Кубка: имя клуба, имя и номер на спине, наша группа (нужна «Выходу из группы»). */
export interface ComicWho { club: string; backName: string; backNumber: number; group: GroupView | null }

/** Табло нашей группы: места по таблице модели, наша строка — по имени клуба. */
export function groupBoard(g: GroupView, club: string): { head: string; rows: TableRow[] } {
  const rows = g.rows.map((r, i): TableRow => ({ place: i + 1, name: r.team === 'our' ? club : (TEAMS.find((x) => x.id === r.team)?.name ?? r.team), pts: r.pts, our: r.team === 'our' }));
  const ours = rows.find((r) => r.our)?.place ?? 0;
  return { head: fill(t.place, { club, place: ours }), rows };
}

const HEAD = { boy: [0.375, 0.45], captain: [0.5, 0.45] } as const;
const say = (pos: 'top' | 'bottom', text: string): { text: string; pos: 'top' | 'bottom' } => ({ text, pos });

/** Панели комикса `id`: «Завязка», «Выход из группы», «Финал», «Серебро» (по макету Э6.14–.21). */
export function comicView(id: ComicId, who: ComicWho): ComicView {
  const print = { name: who.backName.toUpperCase(), num: who.backNumber };
  const panels = ((): [ComicPanel, ComicPanel] => {
    switch (id) {
      case 'intro':
        return [
          { art: 'storyIntro1', key: false, bubble: { text: t.boy, at: [...HEAD.boy], w: 150, sh: 20 } },
          { art: 'storyIntro3', key: true, narrator: say('top', t.coach.intro), bubble: { text: t.captain, at: [...HEAD.captain], w: 150, sh: 0 }, print: 'shirt' },
        ];
      case 'group':
        return [
          { art: 'storyBgGroupCoach', key: false, ...(who.group === null ? {} : { table: groupBoard(who.group, who.club) }) },
          { art: 'storyGroup2', key: true, narrator: say('top', t.coach.group) },
        ];
      case 'final':
        return [
          { art: 'storyFinal1', key: false, print: 'back' },
          { art: 'cupTitleKey', key: true, narrator: say('bottom', t.coach.final) },
        ];
      case 'silver':
        return [
          { art: 'storyFinal1', key: false, print: 'back' },
          { art: 'storySilver2', key: true, narrator: say('top', t.coach.silver) },
        ];
    }
  })();
  return { id, title: id === 'intro' ? ru.parent.players.stuck.newClub : t.title[id], panels, print };
}
