/**
 * Подписи экрана матча v2 (спека 017): правила вступления, подпись под счётом, подсказка над мячами запаса.
 * Подписи итога — в `components/matchResult/labels.ts`. Отдельно от .vue, чтобы тест видел дословные подписи.
 */
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import { saveExists, type ReserveHint } from '../../engine/match/score';
import type { MatchView } from '../../engine/match/view';

/** Значок строки правил вступления: гол, сейв, гол соперника. */
export interface IntroRule {
  kind: 'goal' | 'save' | 'conceded';
  text: string;
}

/**
 * Правила вступления тремя короткими строками (017-Р31): «0–1 ошибка — гол», «2–4 — вратарь отбил», «5 и больше — гол соперника».
 * Строка про вратаря есть, только если между «гол» (g) и «гол соперника» (c) бывает число ошибок; пенальти не упоминаем.
 */
export function introRules(g: number, c: number): IntroRule[] {
  const r = ru.match2.intro.rules;
  const words = ru.match2.intro.errorWords;
  const out: IntroRule[] = [{ kind: 'goal', text: g === 0 ? r.goalZero : r.goal.replace('{g}', String(g)).replace('{w}', plural(g, words)) }];
  if (saveExists(g, c)) {
    const [a, b] = [g + 1, c - 1];
    out.push({ kind: 'save', text: (a === b ? r.saveOne : r.save).replace('{a}', String(a)).replace('{b}', String(b)) });
  }
  out.push({ kind: 'conceded', text: r.conceded.replace('{c}', String(c)) });
  return out;
}

/** Подпись под счётом на табло: «1-й тайм · Атака 2 из 4 · Решающая атака!», «Перерыв», «Минута тренера». */
export function captionOf(x: MatchView): string {
  const c = ru.match2.caption;
  const half = c.halves[x.half - 1] ?? '';
  switch (x.phase) {
    case 'warmup': return c.warmup;
    case 'half1':
    case 'half2': {
      const base = `${half} · ${c.attack} ${x.attack} ${c.of} ${x.attacks}`;
      return x.decisive ? `${base} · ${c.decisive}` : base;
    }
    case 'extra': return `${c.extra} · ${c.decisive}`;
    case 'break': return c.break;
    case 'kick': return `${half} · ${c.kick}`;
    case 'coach': return ru.match2.coach.title;
    default: return '';
  }
}

/** Подпись над мячами запаса матча v2 — она же единственное, что зачитывает диктор (017-Р33): «Можно ошибиться ещё 1 — гол твой». */
export function reserveHintText(h: ReserveHint | undefined): string {
  const r = ru.match2.reserve;
  if (!h || h.kind === 'none') return '';
  return h.kind === 'last' ? r.last : `${r.more} ${h.n} ${r.moreEnd}`;
}
