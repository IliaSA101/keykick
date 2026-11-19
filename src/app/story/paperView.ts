/**
 * Вид выпуска газеты Двора (068 Т7, story.md §2): из фактов (`paperFacts`) и строк `ru.story` — заголовок, подпись «фото», две заметки,
 * рубрика «Знаток Двора», строка «Дальше». Чистая функция, без Vue. Нет данных (0 матчей, нет скорости, нет счёта) — заметка без числа.
 */
import { fill } from '../home/texts';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import type { PaperFacts } from './paperFacts';

const t = ru.story.paper;

export interface PaperOpts {
  club: string;
  city: string;
  /** Имя игрока (рубрика) и тренера (заметка выпуска 1). */
  player: string;
  coach: string;
  /** Название урока по номеру (строка «Дальше»). */
  lessonName: (n: number) => string;
  /** Из Музея: вместо «Дальше» — строка про архив. */
  archive?: boolean;
  /** Первый выпуск со званием «Знаток» (068-Р31, `firstTitleIn`): крупное «{Имя} — Знаток Двора!» только в нём, в следующих — строкой. */
  firstTitle?: boolean;
}

export interface PaperView {
  n: number;
  /** Ключ «фото» (id картинки `ph-<id>`) и подпись под ним. */
  pic: 'day1' | 'bench' | 'match' | 'squad' | 'out' | 'board' | 'series' | 'title' | 'silver';
  caption: string;
  head: string;
  club: string;
  city: string;
  day: number;
  notes: [string, string][];
  rubric: { title: string; big: string; text: string };
  next: string;
  deco: '' | 'champ' | 'silver';
}

const PICS: PaperView['pic'][] = ['day1', 'bench', 'match', 'squad', 'out', 'board', 'series', 'title'];
const many = (n: number, f: { one: string; few: string; many: string }): string => fill(plural(n, f), { n });
const N = t.notes;

function notesOf(f: PaperFacts, o: PaperOpts): [string, string][] {
  const street = (x: { street: string } | null): string => x?.street ?? '';
  const lesson = f.nextLesson ?? 0;
  switch (f.n) {
    case 1: {
      const stat = f.played > 0 ? fill(N.first.tail, { matches: many(f.played, t.forms.matches), goals: many(f.goals, t.forms.goals) }) : '';
      return [[N.first.h, fill(N.first.b, { lesson: lesson - 1 }) + stat], [fill(N.coach.h, { coach: o.coach }), N.coach.b]];
    }
    case 2:
      return [[N.cup.h, N.cup.b], [N.benches.h, N.benches.b + (f.fans > 0 ? fill(N.benches.tail, { fans: f.fans.toLocaleString('ru-RU') }) : '')]];
    case 3:
      return [
        [fill(ru.map.pickTitle, { street: street(f.firstRival) }), fill(N.rival.b, { rival: f.firstRival?.name ?? '', where: f.firstHome ? ru.map.home : ru.map.away })],
        [fill(N.nextMatch.h, { flag: f.flag ?? '' }), fill(N.nextMatch.b, { left: many((f.flag ?? 0) - lesson + 1, t.forms.lessons) })],
      ];
    case 4:
      return [[N.squad.h, N.squad.b], f.bestSpeed > 0 ? [fill(N.record.h, { speed: fill(t.speed, { n: f.bestSpeed }) }), N.record.b] : [N.recordNone.h, N.recordNone.b]];
    case 5:
      return [[fill(N.r16.h, { flag: f.flag ?? '' }), fill(N.r16.b, { street: street(f.flagRival) }) + (f.place === null ? '' : fill(N.r16.tail, { place: f.place }))], [N.prize.h, N.prize.b]];
    case 6:
      return [[N.r16open.h, fill(N.r16open.b, { street: street(f.flagRival), flag: f.flag ?? '' })], [fill(N.lamp.h, { left: many(f.lamp - lesson + 1, t.forms.lessons) }), fill(N.lamp.b, { lamp: f.lamp })]];
    case 7: {
      const to = f.flag ?? 0;
      return [[fill(N.final.h, { flag: to }), N.final.b], [fill(N.phrases.h, { from: lesson, to }), fill(N.phrases.b, { left: many(to - lesson + 1, t.forms.trainings), a: to - 1, b: to })]];
    }
    default:
      return f.silver
        ? [[fill(f.finalScore ? N.silver.hScore : N.silver.h, { street: street(f.finalRival), opp: f.finalScore?.opp ?? '', me: f.finalScore?.me ?? '' }), N.silver.b], [N.again.h, N.again.b]]
        : [[N.box.h, N.box.b], [N.region.h, N.region.b]];
  }
}

export function paperView(f: PaperFacts, o: PaperOpts): PaperView {
  const head = f.silver ? t.headSilver : (t.heads[f.n - 1] ?? '');
  const score = f.score === null ? '' : `${f.score.me}:${f.score.opp}`;
  const stats = fill(t.rubric.stats, { tasks: f.tasks, tours: f.medalTours }) + (f.title ? '' : fill(t.rubric.of, { of: f.expertAt })) + '.';
  const next = o.archive ? t.next.archive : f.next.kind === 'lesson' ? fill(t.next.lesson, { n: f.next.lesson, name: o.lessonName(f.next.lesson) }) : t.next[f.next.kind];
  return {
    n: f.n,
    pic: f.silver ? 'silver' : (PICS[f.n - 1] ?? 'day1'),
    caption: fill(t.photo, { text: t.captions[f.silver ? 8 : f.n - 1] ?? '' }),
    head: fill(head, { club: o.club, score }).trim(),
    club: o.club,
    city: o.city,
    day: f.day,
    notes: notesOf(f, o),
    rubric: {
      title: t.rubric.title,
      big: f.title && o.firstTitle === true ? fill(t.rubric.big, { name: o.player }) : '',
      text: (f.title && o.firstTitle !== true ? `${fill(t.rubric.held, { name: o.player })} ` : '') + stats,
    },
    next,
    deco: f.n === 8 ? (f.silver ? 'silver' : 'champ') : '',
  };
}
