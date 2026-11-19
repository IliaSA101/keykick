/**
 * Стенд кадров матча (065 Т9г): `frameRun` доигрывает матч верной печатью по строке исходов — чистая функция, без браузера.
 */
import { describe, expect, it } from 'vitest';
import { courseLessons, dictionary } from '../course/yard';
import { frameRun } from '../../src/app/match/frame';
import { buildStart } from '../../src/app/match/run';
import type { RunningMatch } from '../../src/engine/match';
import { viewOf, withPenaltySheet, withShow } from '../../src/screens/match/view';

const start = (n: number) => buildStart(courseLessons.find((l) => l.n === n)!, 51932, dictionary);
const at = (n: number, spec: Parameters<typeof frameRun>[1]): RunningMatch => {
  const s = frameRun(start(n), spec).state;
  if (s.phase === 'idle') throw new Error('матч не начат');
  return s;
};
/** Сколько атак разминки у урока (по плану). */
const warmOf = (n: number): string => 'k'.repeat(at(n, { outcomes: '' }).plan.filter((a) => a.phase === 'warmup').length);

describe('К-Т9г: frameRun — матч до нужного места', () => {
  it('К-Т9г: пустая строка исходов — начало разминки, счёта нет', () => {
    const s = at(3, { outcomes: '' });
    expect(s.phase).toBe('warmup');
    expect(s.typing?.pos).toBe(0);
    expect(s.score).toEqual({ me: 0, opp: 0 });
  });

  it('К-Т9г: разминка + «ggc» — атака 4 из 4 первого тайма, счёт 2 : 1 (Э1.03)', () => {
    const warm = warmOf(3);
    const s = at(3, { outcomes: `${warm}ggc` });
    expect(s.phase).toBe('half1');
    expect(s.score).toEqual({ me: 2, opp: 1 });
    expect(viewOf(s).detail).toBe('Атака 4 из 4');
    expect(s.log.map((a) => a.outcome)).toEqual([...Array.from({ length: warm.length }, () => null), 'goal', 'goal', 'concede']);
  });

  it('К-Т9г: «s» — вратарь отбил (одна ошибка), счёт не меняется', () => {
    const s = at(3, { outcomes: `${warmOf(3)}s` });
    expect(s.log.at(-1)?.outcome).toBe('save');
    expect(s.score).toEqual({ me: 0, opp: 0 });
  });

  it('К-Т9г: until «reach» — цель не под пальцем, «space» — пробел (Э1.04, Э1.05)', () => {
    const reach = viewOf(at(15, { outcomes: `${warmOf(15)}g`, until: 'reach' }));
    expect(['KeyG', 'KeyH', 'Quote']).toContain(reach.target?.code);
    const sp = viewOf(at(3, { outcomes: warmOf(3), until: 'space' }));
    expect(sp.target?.code).toBe('Space');
  });

  it('К-Т9г: цели нет в атаке урока — ошибка, а не тихий кадр', () => {
    expect(() => at(3, { outcomes: `${warmOf(3)}g`, until: 'reach' })).toThrow(/target in the attack/);
  });

  it('К-Т9г: исход не к фазе («g» в разминке) — ошибка, а не тихий кадр', () => {
    expect(() => frameRun(start(3), { outcomes: 'g' })).toThrow(/does not fit/);
  });

  it('К-Т9г: перерыв и пенальти не зависают — доигрывается до 2-го тайма', () => {
    const s0 = at(3, { outcomes: '' });
    const n = (p: string): number => s0.plan.filter((a) => a.phase === p).length;
    const s = at(3, { outcomes: `${warmOf(3)}${'g'.repeat(n('half1'))}gg` });
    expect(['half2', 'penalty']).toContain(s.phase);
    expect(s.half1.me).toBe(n('half1'));
  });
});

describe('К13 Р160: frameRun — стоп в перерыве (окно учебной игры, Э8)', () => {
  it('К13 Р160: toBreak — матч стоит в перерыве со счётом 1 : 0, на уроках учебных игр', () => {
    // Ловит: кадр игры на фоне вступления или «Второго тайма» вместо перерыва (в шапке «Разминка 0 : 0», а не «Перерыв 1 : 0»).
    for (const n of [1, 2, 3, 6, 9, 12, 18, 24]) {
      const s = at(n, { outcomes: '', toBreak: true });
      expect(s.phase, `урок ${n}`).toBe('break');
      expect(s.score, `урок ${n}`).toEqual({ me: 1, opp: 0 });
      expect(s.typing).toBeNull();
    }
  });

  it('К13 Э1.16, 29, 30: исходы на весь первый тайм («gggc») с toBreak — перерыв со счётом 3 : 1, а не второй тайм', () => {
    // Ловит: `frameRun` проходит перерыв внутри строки исходов и бросает «no break before phase half2» — кадр стенда «Ой, что-то сломалось».
    const s = at(3, { outcomes: `${warmOf(3)}gggc`, toBreak: true });
    expect(s.phase).toBe('break');
    expect(s.score).toEqual({ me: 3, opp: 1 });
  });

  it('К13: исход после перерыва с toBreak — ошибка, а не молчаливая потеря', () => {
    // Ловит: `toBreak` обрезает лишние исходы (`gggcgg`) без ошибки — кадр собирается не с тем, что записано в фикстуре.
    expect(() => at(3, { outcomes: `${warmOf(3)}gggcgg`, toBreak: true })).toThrow(/after break/);
  });
});

describe('К7: frameRun — пенальти (Э1.18, Э1.19)', () => {
  const half1 = (n: number): number => at(n, { outcomes: '' }).plan.filter((a) => a.phase === 'half1').length;
  /** Разминка, 1-й тайм «ggcs…» и первая чистая атака 2-го тайма — именно после неё матч предлагает пенальти. */
  const upTo = (n: number): string => `${warmOf(n)}${'ggcs'.slice(0, half1(n))}${'g'.repeat(Math.max(0, half1(n) - 4))}g`;

  it('К7: penalty «ask» — матч стоит на пенальти, без «Не бить»; счёт включает гол чистой атаки', () => {
    // Ловит: кадр листа, где пенальти пропущено само (экран получает 2-й тайм вместо листа).
    const s = at(3, { outcomes: upTo(3), penalty: 'ask' });
    expect(s.phase).toBe('penalty');
    expect(s.penalty).toEqual({ offered: true, scored: false });
    expect(s.score).toEqual({ me: 3, opp: 1 });
  });

  it('К7: penalty «hit» — гол с пенальти: 4 : 1, матч дальше во 2-м тайме', () => {
    const s = at(3, { outcomes: upTo(3), penalty: 'hit' });
    expect(s.phase).toBe('half2');
    expect(s.penalty).toEqual({ offered: true, scored: true });
    expect(s.score).toEqual({ me: 3, opp: 1 }); // печать — 3 гола, пенальти идёт отдельно (звезду не даёт, М4)
    expect(viewOf(s).score).toEqual({ me: 4, opp: 1 }); // а табло показывает общий счёт (Э1.19: «Счёт матча 4 : 1»)
  });

  it('К22: пока лист пенальти открыт, справа на табло «Пенальти», а не «Атака N из M» (Э1.19), слева — «2-й тайм»', () => {
    const v = viewOf(at(3, { outcomes: upTo(3), penalty: 'hit' }));
    expect(v.detail).toMatch(/^Атака \d из \d$/); // без листа — номер атаки, как до правки
    const open = withPenaltySheet(v);
    expect(open.detail).toBe('Пенальти');
    expect(open.phase).toBe('2-й тайм');
    expect(open.score).toEqual({ me: 4, opp: 1 });
  });

  it('К7: без поля penalty пенальти пропускается, как раньше (старые кадры не меняются)', () => {
    const s = at(3, { outcomes: upTo(3) });
    expect(s.phase).toBe('half2');
    expect(s.penalty).toEqual({ offered: true, scored: false });
  });

  it('К7: penalty, а пенальти не наступило — ошибка, а не тихий кадр', () => {
    expect(() => at(3, { outcomes: warmOf(3), penalty: 'ask' })).toThrow(/no penalty/);
  });
});

describe('К-Р96: стенд подставляет текст кадра', () => {
  const base = (): ReturnType<typeof viewOf> => viewOf(at(3, { outcomes: '' }));
  const keys = at(3, { outcomes: '' }).keymap;

  it('К-Р96: без show вид не меняется; со show — строка, продолжение, номер строки и цель из кадра', () => {
    // Ловит: подстановка, которая не доходит до вида (кадр снова показывает строки курса) или портит вид без show.
    expect(withShow(base(), undefined, keys)).toEqual(base());
    const v = withShow(base(), { text: 'ав ол', pos: 3, next: ['ла ов'], row: { n: 2, of: 4 }, target: 'KeyJ' }, keys);
    expect(v.typed).toEqual({ text: 'ав ол', pos: 3 });
    expect(v.next).toEqual(['ла ов']);
    expect(v.line).toEqual({ n: 2, of: 4 });
    expect(v.target?.code).toBe('KeyJ');
    expect(v.target?.finger).toBe('правый указательный');
    expect(v.phase).toBe(base().phase);
  });

  it('К-Р96: цель — пробел: большой палец нужной руки; неизвестная клавиша — ошибка, а не тихий кадр', () => {
    // Ловит: пробел без половины; опечатку в коде клавиши фикстуры, показанную как «нет цели».
    const sp = withShow(base(), { target: 'Space', thumb: 'left' }, keys);
    expect(sp.target).toMatchObject({ code: 'Space', thumb: 'left', finger: 'левый большой' });
    expect(() => withShow(base(), { target: 'KeyЯ' }, keys)).toThrow(/unknown key/);
  });
});
