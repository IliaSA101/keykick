/**
 * Серия ударов Кубка (068-Т2, К-Б; ТЗ-8.6, 038-Р35, 038-Р38, 068-Р21): слова 4/6/8 из пройденных букв, конец на двух чистых,
 * соперник не выигрывает при двух наших чистых; ответ соперника — по кадрам Э5.32–35.
 */
import { describe, expect, it } from 'vitest';
import { courseLessons, dictionary, keymap } from '../course/yard';
import { cupLesson } from '../../src/engine/cup/lesson';
import { idleSeries, seriesResult, seriesStep, SERIES_LENGTHS, type SeriesState, type Shot } from '../../src/engine/cup/series';
import { ROUNDS } from '../../src/engine/home/yard';
import { emptyForm } from '../../src/engine/form/rank';
import type { CourseLesson } from '../../src/engine/plan/lesson';
import { beginSeries, resultOf, seriesKey, type SeriesUi } from '../../src/app/cup/seriesFlow';
import { seriesFrameUi } from '../../src/app/cup/frame';
import { seriesView } from '../../src/screens/match/seriesView';
import type { Run } from '../../src/app/match/run';
import { expectedHit } from '../../src/engine/typing/typing';

const cupOf = (n: number): CourseLesson => cupLesson(n, courseLessons, emptyForm())!;

/** Серия, поданная игроком: `plan[i]` — удар `i` чистый (✓) или с ошибкой (✕); ударов больше, чем идёт серия, не подаётся. */
function play(plan: readonly Shot[], n = 18, seed = 5): SeriesState {
  let state = seriesStep(idleSeries, { type: 'start', seed, lesson: cupOf(n), dict: dictionary, keymap }).state;
  let t = 1000;
  for (const shot of plan) {
    if (state.phase !== 'run' || state.typing === null) break;
    const kick = state.kick;
    if (shot === 'miss') state = seriesStep(state, { type: 'key', code: '', key: '§', t: (t += 150) }).state;
    while (state.phase === 'run' && state.kick === kick && state.typing !== null) {
      const hit = expectedHit(keymap, state.typing);
      state = seriesStep(state, { type: 'key', code: hit?.key.code ?? '', key: state.typing.text[state.typing.pos] ?? '', t: (t += 150) }).state;
    }
  }
  return state;
}

const SHOTS: Shot[] = ['goal', 'miss'];
const ALL: Shot[][] = SHOTS.flatMap((a) => SHOTS.flatMap((b) => SHOTS.map((c) => [a, b, c])));

describe('068-К3: серия ударов', () => {
  it('068-К3 три слова 4/6/8 букв только из букв, пройденных к якорю; одно зерно — те же слова', () => {
    // Ловит: слово с буквой, которой ещё не учили (038-Р35); длины не 4/6/8; случайность не от зерна.
    for (const n of ROUNDS) {
      const s = seriesStep(idleSeries, { type: 'start', seed: n, lesson: cupOf(n), dict: dictionary, keymap }).state;
      if (s.phase !== 'run') throw new Error('серия не началась');
      expect(s.words.map((w) => w.length)).toEqual(SERIES_LENGTHS);
      const keys = cupOf(n).keys;
      for (const w of s.words) expect([...w].every((c) => keys.includes(c))).toBe(true);
      const again = seriesStep(idleSeries, { type: 'start', seed: n, lesson: cupOf(n), dict: dictionary, keymap }).state;
      expect(again).toEqual(s);
    }
  });

  it('068-К3 два чистых подряд — серия кончается, третий удар не бьётся; соперник не выигрывает (ТЗ-8.6, 038-Р38)', () => {
    // Ловит: третий удар после ✓ ✓; победа соперника при двух наших чистых; серия не закрывается.
    const s = play(['goal', 'goal', 'goal']);
    expect(s.phase).toBe('done');
    const r = seriesResult(s)!;
    expect(r).toMatchObject({ won: true, mine: ['goal', 'goal'] });
    expect(r.theirs.filter((x) => x === 'goal').length).toBeLessThan(2);
  });

  it('068-К3 любая комбинация из 3 ударов: победа ⇔ два чистых; три чистых — всегда победа; у соперника в победе меньше голов', () => {
    // Ловит: ложная победа или поражение на любой из 8 раскладок; соперник забивает не меньше нас при нашей победе; ✓ ✕ ✓ не 2:1.
    for (const plan of ALL) {
      const r = seriesResult(play(plan))!;
      const goals = plan.slice(0, r.mine.length).filter((x) => x === 'goal').length;
      expect(r.won, plan.join()).toBe(goals >= 2);
      const mine = r.mine.filter((x) => x === 'goal').length;
      const theirs = r.theirs.filter((x) => x === 'goal').length;
      expect(r.won ? mine > theirs : theirs > mine, plan.join()).toBe(true);
    }
    expect(seriesResult(play(['goal', 'miss', 'goal']))).toMatchObject({ won: true, mine: ['goal', 'miss', 'goal'] });
  });

  it('068-К3 два промаха — серия проиграна сразу, третий удар не бьётся', () => {
    // Ловит: серия, которая ждёт третий удар при двух промахах; промах считается голом (ошибка в слове — гол не засчитан).
    const r = seriesResult(play(['miss', 'miss', 'goal']))!;
    expect(r).toMatchObject({ won: false, mine: ['miss', 'miss'] });
  });
});

describe('068-К3: ответ соперника и печать серии', () => {
  it('068-К3 ответ соперника — по кадрам Э5.32–35: гол, мимо, гол; ✓✕✓ → ✓✕, ✕✓✕ → ✓✕✓, ✓✓ → ✓', () => {
    // Ловит: зеркало вместо кадров (068-Р21); соперник выигрывает при двух наших чистых; при двух промахах не опережает.
    expect(seriesResult(play(['goal', 'miss', 'goal']))).toMatchObject({ mine: ['goal', 'miss', 'goal'], theirs: ['goal', 'miss'] });
    expect(seriesResult(play(['miss', 'goal', 'miss']))).toMatchObject({ won: false, theirs: ['goal', 'miss', 'goal'] });
    expect(seriesResult(play(['goal', 'goal']))).toMatchObject({ won: true, theirs: ['goal'] });
    expect(seriesResult(play(['miss', 'miss']))).toMatchObject({ won: false, theirs: ['goal', 'miss'] });
    for (const plan of ALL) {
      const r = seriesResult(play(plan))!;
      const theirs = r.theirs.filter((x) => x === 'goal').length;
      expect(r.won ? theirs < 2 : theirs >= r.mine.filter((x) => x === 'goal').length, plan.join()).toBe(true);
    }
  });

  it('068-К3 результат серии несёт печать: верные нажатия и список для формы клавиш', () => {
    // Ловит: печать серии потеряна для свистка (ТЗ-3.1 «серия печатью» платит).
    const r = seriesResult(play(['goal', 'miss', 'goal']))!;
    expect(r.stats.correct).toBeGreaterThan(10);
    expect(r.presses.length).toBe(r.stats.correct + r.stats.errors);
    expect(r.presses.some((p) => !p.ok)).toBe(true);
  });
});

/** 068-Т6-К9…: серия на экране — ход, звук, вид (Э5.30–.33). */
describe('068-Т6: серия на экране', () => {
  const run = { start: { seed: 5, keymap } } as unknown as Run;
  let at = 1000;
  const press = (ui: SeriesUi, code: string, key: string) => seriesKey(ui, { code, key, t: (at += 150) });
  /** Печатает слово текущего удара верно (до его конца). */
  function word(ui: SeriesUi): ReturnType<typeof seriesKey> {
    let out = { ui, sounds: [] as string[], ended: false };
    const kick = ui.state.phase === 'run' ? ui.state.kick : -1;
    while (out.ui.state.phase === 'run' && out.ui.state.kick === kick && out.ui.state.typing !== null) {
      const t = out.ui.state.typing;
      out = press(out.ui, expectedHit(keymap, t)?.key.code ?? '', t.text[t.pos] ?? '');
    }
    return out;
  }

  it('068-Т6-К9 два чистых слова — серия кончилась победой, возглас «гол», в конце свисток; исход отдаётся записи', () => {
    // Ловит: серия не кончается на 2 чистых; нет возгласа и звука гола; исход не доходит до finishCup (resultOf).
    const a = word(beginSeries(run, cupOf(18), dictionary));
    expect(a.ui.shout).toBe('goal');
    expect(a.ended).toBe(false);
    const b = word(a.ui);
    expect(b.ended).toBe(true);
    expect(b.sounds).toContain('whistle-end.mp3');
    expect(resultOf(b.ui)?.won).toBe(true);
    expect(resultOf(a.ui)).toBeNull();
  });

  it('068-Т6-К9 ошибка в слове — удар «мимо»: отметка сразу, возглас «вратарь», статус «Ошибка…»; вид: удар n из 3, слово, палец', () => {
    // Ловит: ошибка не метит удар (Э5.32); отметки соперника расходятся с кадрами (✓ ✕ ✓); пальца и слова в строке нет.
    const s0 = beginSeries(run, cupOf(18), dictionary);
    const v0 = seriesView(s0, { me: 1, opp: 1 })!;
    expect(v0.board.ban).toBe('удар 1 из 3');
    expect(v0.board.us).toEqual(['now', '', '']);
    expect(v0.view.typed?.text.length).toBe(4);
    expect(v0.view.target?.finger).toBeTruthy();
    expect(v0.board.centre).toBe('чисто — гол, ошибка — вратарь берёт');
    const bad = press(s0, '', '§').ui;
    const v1 = seriesView(bad, { me: 1, opp: 1 })!;
    expect(v1.board.us).toEqual(['miss', '', '']);
    expect(v1.board.centre).toBe('Ошибка — вратарь взял мяч');
    const next = word(bad); // слово с ошибкой дописано: мимо, соперник забил, ударов нет «чистых»
    expect(next.ui.shout).toBe('save');
    const v2 = seriesView(next.ui, { me: 1, opp: 1 })!;
    expect(v2.board.us).toEqual(['miss', 'now', '']);
    expect(v2.board.them).toEqual(['goal', '', '']);
    expect(v2.board.ban).toBe('удар 2 из 3');
    expect(v2.board.left).toBe('Слово из 6 букв — набрано 0');
  });

  it('068-Т6-К9 кадры серии: 1 — удар 1, 2 — ошибка и «вратарь взял», 3 — серия наша ✓ ✕ ✓ против ✓ ✕', () => {
    // Ловит: кадры стенда расходятся с настоящей машиной серии (фикстура рисует не то, что даёт игра).
    const f1 = seriesView(seriesFrameUi(1, run, cupOf(18), dictionary), { me: 1, opp: 1 })!;
    expect(f1.board.us).toEqual(['now', '', '']);
    expect(f1.view.typed?.pos).toBe(2);
    const f2 = seriesFrameUi(2, run, cupOf(18), dictionary);
    expect(f2.shout).toBe('save');
    expect(seriesView(f2, { me: 1, opp: 1 })!.board.us).toEqual(['goal', 'miss', '']);
    const f3 = seriesFrameUi(3, run, cupOf(18), dictionary);
    const v3 = seriesView(f3, { me: 1, opp: 1 })!;
    expect(v3.board.us).toEqual(['goal', 'miss', 'goal']);
    expect(v3.board.them).toEqual(['goal', 'miss', '']);
    expect(v3.board.centre).toBe('Гол! Серия наша');
    expect(v3.board.keeper.pose).toBe('dive');
  });
});
