/**
 * Вид итога матча (065 Т10а): выбор карточки по `ResultView` — победа, поражение, «Застрял», звёзды без пенальти (М4), рекорд,
 * обмен итогом между экранами (итог один раз). Чистые функции `app/result/card.ts` и `app/match/handoff.ts`, без браузера.
 */
import { describe, expect, it } from 'vitest';
import { putFinished, takeFinished, takeMeta } from '../../src/app/match/handoff';
import { cardOf, goalLine, kindOf } from '../../src/app/result/card';
import { CONFETTI_COLORS, confetti } from '../../src/app/result/confetti';
import type { ResultView } from '../../src/engine/match';

const base: ResultView = {
  verdict: 'win',
  total: { me: 3, opp: 1 },
  stars: 1,
  starsAll: 1,
  newStars: 1,
  record: { kind: 'beaten', delta: 1, best: { cpm: 13, permille: 920 } },
  permille: 920,
  cpm: 13,
  correct: 552,
  coins: 27,
  fans: 552,
  grew: [],
  missing: { kind: 'clean' },
  replay: null,
  passed: true,
  help: 'none',
  rest: false,
  back: false,
  knower: false,
};
const lost: ResultView = { ...base, verdict: 'loss', total: { me: 1, opp: 3 }, stars: 0, starsAll: 0, newStars: 0, passed: false, replay: 'half2', missing: { kind: 'goals', n: 3 }, record: { kind: 'kept', delta: 0, best: { cpm: 12, permille: 900 } } };

describe('вид итога', () => {
  it('К7 победа — «Победа!», звёзды и кнопка «Дальше» ведёт на карту', () => {
    const c = cardOf(base);
    expect(kindOf(base)).toBe('win');
    expect(c.title).toBe('Победа!');
    expect(c.stars).toBe(1);
    expect(c.primary).toEqual({ label: 'Дальше', go: 'map' });
    expect(c.record?.badge).toBe('Новый рекорд!');
    expect(c.record?.line).toBe('быстрее прошлого на 1 знак в минуту');
    expect(c.note).toEqual({ lead: '+1 новая звезда.', text: 'До ★★ — выиграть, не пропустив ни одного гола.' });
  });

  it('М4 победа только за счёт пенальти: звёзд ноль, «новой звезды» нет — карточка берёт звёзды движка, не счёт', () => {
    const penaltyWin: ResultView = { ...base, total: { me: 2, opp: 1 }, stars: 0, starsAll: 2, newStars: 0, missing: null };
    const c = cardOf(penaltyWin);
    expect(c.title).toBe('Победа!');
    expect(c.stars).toBe(0);
    expect(c.note).toBeNull();
  });

  it('К7 поражение — «Не беда!», «Ещё 3 гола — и победа», «Переиграть тайм», рекорд без значка', () => {
    const c = cardOf(lost, { half1: { me: 1, opp: 1 } });
    expect(kindOf(lost)).toBe('loss');
    expect(c.title).toBe('Не беда!');
    expect(c.goal).toBe('Ещё 3 гола — и победа');
    expect(c.primary).toEqual({ label: 'Переиграть тайм', go: 'replay' });
    expect(c.record).toEqual({ badge: null, line: 'Рекорд: 12 знаков в минуту' });
    expect(c.note?.text).toBe('1-й тайм — 1 : 1, его счёт сохранится. Переиграй только второй.');
  });

  it('край: счёт 1-го тайма движок в вид не кладёт — строка без счёта, а не «undefined : undefined»', () => {
    expect(cardOf(lost).note?.text).toBe('1-й тайм сохранится. Переиграй только второй.');
    expect(cardOf({ ...lost, replay: 'both' }).primary.label).toBe('Переиграть матч');
  });

  it('К7 «Застрял»: провал с помощью дальше — вторая карточка со счётом, помощью и «На сегодня хватит»', () => {
    const stuck: ResultView = { ...lost, total: { me: 2, opp: 3 }, missing: { kind: 'goals', n: 2 }, help: 'reserve', rest: true, replay: 'both' };
    const c = cardOf(stuck);
    expect(kindOf(stuck)).toBe('stuck');
    expect(c.stars).toBeNull();
    expect(c.side).toBe('2 : 3 · Ещё 2 гола — и победа');
    expect(c.help).toEqual({ label: 'С запасом', note: '+1 ошибка в каждой атаке · звёзды до ★★' });
    expect(c.primary.label).toBe('Переиграть матч');
    expect(kindOf({ ...stuck, help: 'coach' })).toBe('stuck');
    expect(cardOf({ ...stuck, help: 'coach' }).help?.label).toBe('С тренером');
    expect(kindOf({ ...stuck, help: 'minute' })).toBe('loss'); // минута тренера — Т10б
  });

  it('край: засчитанная ничья (товарищеский) — «Ничья!», проход; склонение голов', () => {
    expect(cardOf({ ...base, verdict: 'draw', total: { me: 1, opp: 1 } }).title).toBe('Ничья!');
    expect(goalLine({ kind: 'goals', n: 1 })).toBe('Ещё 1 гол — и победа');
    expect(goalLine({ kind: 'goals', n: 5 })).toBe('Ещё 5 голов — и победа');
    expect(goalLine(null)).toBe('');
  });

  it('К7 итог забирается один раз: второй заход (F5, повтор) — пусто, экран идёт в Дом', () => {
    putFinished({ kind: 'done', view: base, saved: true }, { lesson: 'ru.yard.ao', no: 1 });
    expect(takeFinished().kind).toBe('done');
    expect(takeMeta().lesson).toBe('ru.yard.ao');
    expect(takeFinished()).toEqual({ kind: 'none' });
    expect(takeMeta().lesson).toBe('');
  });

  it('К22 конфетти победы — раскладка кадра Э1.22: 38 обрывков, одно и то же всегда, цвета без синего и красного (ТАБУ)', () => {
    const a = confetti();
    expect(a).toHaveLength(38);
    expect(confetti()).toEqual(a);
    expect(a[0]).toEqual({ left: 353, top: 83, color: '#f4c24a', rot: 21 });
    expect(a.every((p) => p.left >= 0 && p.left <= 720 && p.top >= 4 && p.top <= 144)).toBe(true);
    for (const c of CONFETTI_COLORS) {
      const [r = 0, g = 0, b = 0] = [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
      expect(b <= Math.max(r, g)).toBe(true); // синее не главный канал: нет синих обрывков
      expect(r > g + 100 && r > b + 100).toBe(false); // и нет красных
    }
  });
});
