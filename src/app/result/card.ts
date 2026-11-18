/**
 * Вид итога матча (065 Т10а, кадры Э1.22–Э1.24): чистая функция от `ResultView` — какая карточка, какие слова и куда ведут кнопки.
 * Экран и карточка ничего не считают (страж С1): победа или поражение, «Застрял», звёзды и запрет М4 (пенальти звезду не даёт —
 * звёзды уже посчитаны движком по печати) читаются здесь из готового вида.
 */
import type { Missing, ResultView, Score } from '../../engine/match';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const t = ru.result;

/** Вид карточки: победа (в т. ч. засчитанная ничья), поражение, «Застрял» (3-й провал и дальше — помощь, 017 §4). */
export type ResultKind = 'win' | 'draw' | 'loss' | 'stuck';

/** Куда ведёт кнопка: Карта, тот же урок ещё раз, Дом. */
export type ResultGo = 'map' | 'replay' | 'home';

export interface ResultCardModel {
  kind: ResultKind;
  title: string;
  /** Звёзды этого матча (0…3); `null` — блока звёзд нет («Застрял»). */
  stars: number | null;
  /** Строка справа от заголовка («Застрял»): счёт и чего не хватило. */
  side: string;
  stats: { acc: string; cpm: string } | null;
  record: { badge: string | null; line: string } | null;
  /** «Ещё 3 гола — и победа» под рекордом (поражение). */
  goal: string;
  purse: { mode: 'win' | 'loss'; correct: string; coins: string; fans: string; grew: string[] } | null;
  note: { lead: string; text: string } | null;
  stuck: { title: string; lead: string; helpLabel: string; helpNote: string; rest: string; keys: string } | null;
  primary: { label: string; go: ResultGo };
  /** Кнопка помощи («С запасом»); ведёт туда же, куда главная: помощь матча задаёт счётчик провалов (065-Р18). */
  help: { label: string; note: string } | null;
  home: string;
}

export interface CardCtx {
  /** Счёт 1-го тайма — только кадр стенда; в игре движок его в вид не кладёт (065-Р110). */
  half1?: Score | undefined;
}

/** Победа и засчитанная ничья — «победа»; провал с помощью дальше — «Застрял»; остальное — «Не беда». */
export function kindOf(v: ResultView): ResultKind {
  if (v.passed) return v.verdict === 'win' ? 'win' : 'draw';
  return v.help === 'reserve' || v.help === 'coach' ? 'stuck' : 'loss';
}

const fill = (s: string, vars: Record<string, string | number>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const percent = (permille: number): string => `${Math.round(permille / 10)} %`;

/** «Ещё 3 гола — и победа»; пусто — голов не нужно. */
export function goalLine(m: Missing): string {
  return m !== null && m.kind === 'goals' ? fill(t.goals.text, { n: m.n, unit: plural(m.n, t.goals.unit) }) : '';
}

function recordOf(v: ResultView): ResultCardModel['record'] {
  const r = v.record;
  if (r.kind === 'none' || r.best === null) return null;
  if (r.kind === 'first') return { badge: null, line: fill(t.record.first, { n: r.best.cpm }) };
  if (r.kind === 'kept') return { badge: null, line: fill(t.record.kept, { n: r.best.cpm, unit: plural(r.best.cpm, t.record.unit) }) };
  if (r.kind === 'same') return { badge: t.record.badge, line: t.record.sharper };
  return { badge: t.record.badge, line: fill(t.record.faster, { n: r.delta, unit: plural(r.delta, t.record.unit) }) };
}

function noteOf(v: ResultView, ctx: CardCtx): ResultCardModel['note'] {
  if (!v.passed) {
    if (v.replay === 'both') return { lead: '', text: t.note.both };
    const h = ctx.half1;
    return { lead: '', text: h ? fill(t.note.half2, { a: h.me, b: h.opp }) : t.note.half2NoScore };
  }
  const lead = v.newStars > 0 ? `+${v.newStars} ${plural(v.newStars, t.note.star)}.` : '';
  const m = v.missing;
  const text = m === null ? '' : m.kind === 'clean' ? t.note.toTwo : m.kind === 'accuracy' ? fill(t.note.toThree, { n: Math.round(m.permille / 10) }) : '';
  return lead === '' && text === '' ? null : { lead, text };
}

export function cardOf(v: ResultView, ctx: CardCtx = {}): ResultCardModel {
  const kind = kindOf(v);
  const ok = kind === 'win' || kind === 'draw';
  const title = ok ? (kind === 'win' ? t.title.win : t.title.draw) : t.title.loss;
  const home = t.home;
  const again = v.replay === 'both' ? t.again.match : t.again.half;
  if (kind === 'stuck') {
    const coach = v.help === 'coach';
    return {
      kind,
      title,
      stars: null,
      side: `${v.total.me} : ${v.total.opp}${goalLine(v.missing) === '' ? '' : ` · ${goalLine(v.missing)}`}`,
      stats: null,
      record: null,
      goal: '',
      purse: null,
      note: null,
      stuck: { title: t.stuck.title, lead: t.stuck.lead, helpLabel: coach ? t.stuck.coach : t.stuck.reserve, helpNote: coach ? t.stuck.coachNote : t.stuck.reserveNote, rest: t.stuck.rest, keys: t.stuck.keys },
      primary: { label: t.again.match, go: 'replay' },
      help: { label: coach ? t.stuck.coach : t.stuck.reserve, note: coach ? t.stuck.coachNote : t.stuck.reserveNote },
      home: v.rest ? t.stuck.rest : home,
    };
  }
  const fans = `+${v.fans}`;
  return {
    kind,
    title,
    stars: v.stars,
    side: '',
    stats: { acc: percent(v.permille), cpm: String(v.cpm) },
    record: recordOf(v),
    goal: ok ? '' : goalLine(v.missing),
    purse: {
      mode: ok ? 'win' : 'loss',
      correct: fill(t.purse.correct, { n: v.correct }),
      coins: `${ok ? '' : '+'}${v.coins} ${plural(v.coins, t.purse.coins)}`,
      fans: `${fans} ${plural(v.fans, t.purse.fans)}`,
      grew: v.grew.map((g) => `${cap(ru.match.status.fingers[g.finger as keyof typeof ru.match.status.fingers] ?? g.finger)} — ${fill(t.purse.rank, { name: t.purse.rankNames[g.to] ?? String(g.to) })}`),
    },
    note: noteOf(v, ctx),
    stuck: null,
    primary: ok ? { label: t.next, go: 'map' } : { label: again, go: 'replay' },
    help: null,
    home,
  };
}
