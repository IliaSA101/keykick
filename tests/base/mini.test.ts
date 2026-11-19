// Мини-футбол на экране (067 Т21): app/base/mini. Отдельный файл: finish.test.ts упёрся в 600 строк.
import { describe, expect, it } from 'vitest';
import { clockAt, finishMini, freezeClock, freshClock, GOAL_PAUSE_MS, lineupOf, matchLeft, matchLength, miniChar, miniEvent, miniRanks, miniResult, pauseOf, scoreMini, startMatch, tacticKey, tacticsOf } from '../../src/app/base/mini';
import { startMini, teamSize, type MiniState } from '../../src/engine/base/games/mini';
import { baseDef, type Base } from '../../src/engine/base/section';
import { schoolDef, type Tour } from '../../src/engine/school/section';

describe('Т21 · Мини-футбол на экране (app/base/mini)', () => {
  const state = (o: Partial<MiniState> = {}): MiniState => ({ ...startMini({ keys: ['а', 'о', 'л'], cur: 6 }, 3), ...o });
  const sectionsOf = (base: Base) => ({ base: { data: base } }) as unknown as Parameters<typeof miniRanks>[0];

  it('К21 miniChar: буква и Пробел — события матча; знаки, служебные и повтор — нет', () => {
    expect(miniChar({ code: 'KeyF' })).toBe('а');
    expect(miniChar({ code: 'Space' })).toBe(' ');
    expect(miniChar({ code: 'Digit1' })).toBeNull();
    expect(miniChar({ code: 'Enter' })).toBeNull();
    expect(miniChar({ code: 'Space', repeat: true })).toBeNull();
  });
  it('К21 miniRanks: ранг клавиши — ранг её пальца из формы; без формы — 0', () => {
    expect(miniRanks(undefined, ['а', 'о'])).toEqual({ а: 0, о: 0 });
    const form = { fingers: { lp: { w: '', max: 3, cand: { rank: 0, n: 0 } } } };
    expect(miniRanks({ form: { data: form } }, ['ф', 'о'])).toEqual({ ф: 3, о: 0 });
  });
  it('К21 startMatch (067-Р50): серия ставится на кон — lastN.mini = 0, прежняя серия возвращена, лимит дня цел', () => {
    const base: Base = { ...baseDef.empty(), lastN: { mini: { n: 4 } }, today: 1, day: '2026-11-19' };
    const saved: Base[] = [];
    const streak = startMatch(sectionsOf(base), (patch) => {
      saved.push(patch.base as Base);
      return { ok: true };
    });
    expect(streak).toBe(4);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.lastN.mini).toEqual({ n: 0 });
    expect(saved[0]?.today).toBe(1);
  });
  it('К21 miniEvent: гол, гол соперника, отбор и сейв вратаря различаются; пас и холостой тик — ничего', () => {
    const s = state();
    expect(miniEvent(s, { ...s, us: 1 })).toBe('goal');
    expect(miniEvent(s, { ...s, them: 1, steals: 3 })).toBe('foeGoal');
    expect(miniEvent(s, { ...s, steals: 1 })).toBe('steal');
    expect(miniEvent(s, { ...s, shots: 1 })).toBe('saved');
    expect(miniEvent(s, { ...s, holder: 1, passes: 1 })).toBeNull();
  });
  it('К21 pauseOf (067-Р52): часы стоят только на гол — наш или соперника', () => {
    expect(pauseOf('goal')).toBe(GOAL_PAUSE_MS);
    expect(pauseOf('foeGoal')).toBe(GOAL_PAUSE_MS);
    expect(pauseOf('steal')).toBe(0);
    expect(pauseOf(null)).toBe(0);
  });
  it('К21 miniResult и серия: победа — серия + 1, ничья и поражение — 0; осталось 0:52 через 38 с', () => {
    expect(miniResult(state({ us: 2, them: 1 }))).toBe('win');
    expect(miniResult(state({ us: 1, them: 1 }))).toBe('draw');
    expect(miniResult(state({ us: 0, them: 1 }))).toBe('lose');
    expect(scoreMini(state({ us: 2, them: 1, streak: 3 }))).toBe(4);
    expect(scoreMini(state({ us: 1, them: 1, streak: 3 }))).toBe(0);
    expect(matchLeft(state({ startedAt: 0 }), 38000)).toBe('0:52');
    expect(matchLength()).toBe('1:30');
  });
  it('К21-Р52 часы матча: на гол стоят GOAL_PAUSE_MS, показ вычтен из времени матча, без гола часы идут как есть', () => {
    const c0 = freshClock();
    expect(clockAt(c0, 5000)).toEqual({ at: 5000, frozen: false });
    const c1 = freezeClock(c0, 5000, GOAL_PAUSE_MS);
    expect(c1).toEqual({ frozenUntil: 5000 + GOAL_PAUSE_MS, paused: GOAL_PAUSE_MS });
    expect(clockAt(c1, 5000 + GOAL_PAUSE_MS - 1).frozen).toBe(true);
    expect(clockAt(c1, 5000 + GOAL_PAUSE_MS).frozen).toBe(false); // показ кончился ровно сейчас — часы идут
    expect(clockAt(c1, 7000).at).toBe(7000 - GOAL_PAUSE_MS);
    // второй гол: вычеты складываются
    const c2 = freezeClock(c1, 8000, GOAL_PAUSE_MS);
    expect(c2.paused).toBe(2 * GOAL_PAUSE_MS);
    expect(clockAt(c2, 20000).at).toBe(20000 - 2 * GOAL_PAUSE_MS);
    // не гол (wait 0): состояние то же, часы не стоят
    expect(freezeClock(c1, 9000, 0)).toBe(c1);
    expect(clockAt(freezeClock(c0, 9000, 0), 9000).frozen).toBe(false);
  });
  it('К21 lineupOf: превью старта берёт тот же состав, что матч по этому зерну (не первые буквы по списку)', () => {
    const keys = ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'];
    let differs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const lineup = lineupOf(keys, 11, seed);
      expect(lineup).toEqual(startMini({ keys, cur: 11 }, seed).team);
      expect(lineup).toHaveLength(4);
      if (lineup.join() !== keys.slice(0, 4).join()) differs++;
    }
    expect(differs).toBeGreaterThan(10);
    expect(lineupOf(keys, 11, 1)).not.toEqual(lineupOf(keys, 11, 2));
  });
  it('К21 matchLeft при ненулевом старте матча: осталось считается от startedAt (5 с и 43 с — те же 38 с — 0:52)', () => {
    expect(matchLeft(state({ startedAt: 5000 }), 43000)).toBe('0:52');
    expect(matchLeft(state({ startedAt: 5000 }), 5000)).toBe('1:30');
    expect(matchLeft(state({ startedAt: 5000 }), 200000)).toBe('0:00');
  });
  it('К21 finishMini: рекорд — серия побед; ноль рекордом не становится, монет нет', () => {
    const save = (): { ok: boolean } => ({ ok: true });
    const first = finishMini(undefined, save, 2, 'mini-1', '2026-11-19');
    expect(first.record).toBe('first');
    expect(first.score).toBe(2);
    expect(finishMini(undefined, save, 0, 'mini-2', '2026-11-19').record).toBe('same');
    // рекорд пишется именно в игру «mini», а не в чужую
    const base: Base = { ...baseDef.empty(), records: { mini: { n: 2, day: '2026-11-18' } }, day: '2026-11-19' };
    const saved: Base[] = [];
    const end = finishMini(sectionsOf(base), (patch) => (saved.push(patch.base as Base), { ok: true }), 5, 'mini-3', '2026-11-19');
    expect(end.record).toBe('beaten');
    expect(saved[0]?.records.mini?.n).toBe(5);
    expect(saved[0]?.records.keepy).toBeUndefined();
  });
  const tour = (n: number, kind = 'number'): Tour => ({ n, kind, medal: 2, first: 3, day: '2026-11-18' });
  const withTours = (tours: Tour[]) => ({ school: { data: { ...schoolDef.empty(), tours } } }) as unknown as Parameters<typeof tacticsOf>[0];
  it('К21 tacticsOf: тактики открывают туры «Школы» 4, 8, 12, 16 по последнему туру нумерации; повтор не считается; нет раздела — пусто', () => {
    const upTo = (n: number) => Array.from({ length: n }, (_, i) => tour(i + 1));
    expect(tacticsOf(undefined)).toEqual([]);
    expect(tacticsOf(withTours(upTo(3)))).toEqual([]);
    expect(tacticsOf(withTours(upTo(4)))).toEqual(['wing']);
    expect(tacticsOf(withTours(upTo(11)))).toEqual(['wing', 'press']);
    expect(tacticsOf(withTours(upTo(16)))).toHaveLength(4);
    expect(tacticsOf(withTours([...upTo(3), tour(40, 'repeat')]))).toEqual([]);
  });
  it('К21 tacticKey: стрелки — соседняя открытая (на краю стоит), цифры — по номеру, закрытая и чужая клавиша — без перемен', () => {
    const open = ['wing', 'press'];
    expect(tacticKey(open, 'wing', 'ArrowRight')).toBe('press');
    expect(tacticKey(open, 'wing', 'ArrowDown')).toBe('press');
    expect(tacticKey(open, 'press', 'ArrowLeft')).toBe('wing');
    expect(tacticKey(open, 'wing', 'ArrowLeft')).toBeNull();
    expect(tacticKey(open, 'press', 'ArrowRight')).toBeNull();
    expect(tacticKey(open, 'wing', '2')).toBe('press');
    expect(tacticKey(open, 'wing', '1')).toBeNull();
    expect(tacticKey(open, 'wing', '3')).toBeNull();
    expect(tacticKey(open, 'wing', '9')).toBeNull();
    expect(tacticKey(open, 'wing', 'a')).toBeNull();
    expect(tacticKey([], '', '1')).toBeNull();
  });

  it('К22 размер и состав матча = показанным на старте и выборе тактики: на любом уроке 6…32 команда — teamSize, состав — lineupOf по тому же зерну', () => {
    const keys = ['а', 'о', 'в', 'л', 'ы', 'д', 'ф', 'ж', 'п', 'р'];
    for (const cur of [6, 10, 11, 17, 27, 32]) {
      const lineup = lineupOf(keys, cur, 9);
      const match = startMini({ keys, cur, tactic: 'wing' }, 9).team;
      expect(match).toEqual(lineup);
      expect(match).toHaveLength(teamSize(cur));
    }
    expect(teamSize(17)).toBe(4);
  });
});
