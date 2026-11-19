/**
 * finishCup (068-Т2, К-Б; ТЗ-3.1, 5.1, 8.5–8.7, 8.13): награды раунда, серия печатью, повтор после титула. Своя подготовка — полное сохранение.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { albumDef } from '../../src/engine/album/section';
import { coachDef } from '../../src/engine/coach/section';
import { dayDef, playedMatch } from '../../src/engine/day/section';
import { emptyStory } from '../../src/engine/story/section';
import { finishCup, type CupFinishCtx, type CupSave } from '../../src/engine/cup/finish';
import { formDef } from '../../src/engine/form/section';
import { stadiumDef } from '../../src/engine/home/section';
import type { MatchResult } from '../../src/engine/match';
import { walletDef } from '../../src/engine/rewards/section';
import { schoolDef } from '../../src/engine/school/section';
import { emptyCup } from '../../src/engine/cup/section';
import type { Cup } from '../../src/engine/cup/types';
import type { SeriesResult } from '../../src/engine/cup/series';
import { needsSeries } from '../../src/app/cup/seriesFlow';
import { emptyStats } from '../../src/engine/typing/typing';
import { playGroup, playKo } from './model';
import { courseLessons } from '../course/yard';
import { dictionaryOf, type Run } from '../../src/app/match/run';
import { cupMatchFrame } from '../../src/app/cup/frame';
import { frameRun } from '../../src/app/match/frame';
import { cupAwards } from '../../src/app/cup/awards';
import { cupMoreGo, cupStep, stripMoreAct } from '../../src/app/cup/exit';
import { cupTitle, titleFestive, titleNext, titleStart } from '../../src/app/cup/title';
import { cupCard } from '../../src/app/cup/resultCard';
import { TEAMS } from '../../src/engine/cup/teams';
import { cupMatchInfo, cupStart, finishCupRun, playableRound, roundOf, type CupFinished } from '../../src/app/cup/run';
import { cupView } from '../../src/engine/cup/view';
import { emptyForm } from '../../src/engine/form/rank';
import { recordKo, recordTour } from '../../src/engine/cup/section';

const stats = (correct: number) => ({ correct, errors: 0, keyErrors: {}, fingerErrors: {}, startedAt: 0, lastAt: 60000, intervals: Array.from({ length: Math.max(1, correct) }, () => 60000 / Math.max(1, correct)) });
/** Итог матча Кубка со счётом печатью `me:opp` и верными нажатиями. */
const played = (me: number, opp: number, correct = 40): MatchResult => ({
  verdict: me > opp ? 'win' : me < opp ? 'loss' : 'draw',
  score: { me, opp },
  total: { me, opp },
  penalty: { offered: false, scored: false },
  half1: { me, opp },
  half2: { me: 0, opp: 0 },
  extra: { me: 0, opp: 0 },
  replay: null,
  counted: me > opp,
  stats: stats(correct),
  play: stats(correct),
  presses: [],
});
const fresh = (cup: Cup = emptyCup()): CupSave => ({ cup, wallet: walletDef.empty(), day: dayDef.empty(), school: schoolDef.empty(), form: formDef.empty(), coach: coachDef.empty(), stadium: stadiumDef.empty(), album: albumDef.empty() });
/** День с тремя доигранными матчами в день `day`. */
const play3 = (day: string) => playedMatch(playedMatch(playedMatch(dayDef.empty(), day, 1), day, 2), day, 3);
const at = (round: CupFinishCtx['round'], matchId: string): CupFinishCtx => ({ now: 1_000_000, day: '2026-11-20', matchId, round });
const won: SeriesResult = { won: true, mine: ['goal', 'miss', 'goal'], theirs: ['goal', 'miss'], stats: emptyStats, presses: [] };
const lost: SeriesResult = { won: false, mine: ['miss', 'miss'], theirs: ['goal', 'miss'], stats: emptyStats, presses: [] };

describe('068-К3: finishCup', () => {
  it('068-К3 победа в туре: монеты как за матч, пак один раз, тур записан; повтор с тем же matchId — без изменений', () => {
    // Ловит: тур без монет (ТЗ-3.1); второй пак за тот же раунд (ТЗ-5.1); двойной Enter платит дважды.
    const a = finishCup(fresh(), played(2, 1, 45), null, at('g1', 'c1'));
    expect(a.view).toMatchObject({ passed: true, coins: 2, pack: true });
    expect(a.save.album.packs).toBe(1);
    expect(a.save.cup.tours[0].me).toBe(2);
    expect(a.facts.map((f) => f.fact)).toEqual(['round', 'pack']);
    const again = finishCup(a.save, played(2, 1, 45), null, at('g1', 'c1'));
    expect(again.save).toBe(a.save);
    expect(again.view).toBeNull();
  });

  it('068-К3 ничья в группе засчитана, поражение — тур снова без пака; раунд вне очереди — без изменений', () => {
    // Ловит: ничья группы не двигает раунд (ТЗ-8.5); пак за проигранный матч; награда за раунд, до которого не дошли.
    const draw = finishCup(fresh(), played(1, 1), null, at('g1', 'd'));
    expect(draw.view).toMatchObject({ passed: true, pack: true });
    const loss = finishCup(fresh(), played(0, 1), null, at('g1', 'l'));
    expect(loss.view).toMatchObject({ passed: false, pack: false });
    expect(loss.save.cup.tours[0]).toMatchObject({ me: null, tries: 1 });
    expect(loss.save.album.packs).toBe(0);
    const far = finishCup(fresh(), played(3, 0), null, at('qf', 'far'));
    expect(far.save).toEqual(fresh());
    expect(far.view).toBeNull();
  });

  it('068-К3 выход из группы — «Бирюза», полуфинал — «белая с красными полосами»; 7 паков за 7 раундов', () => {
    // Ловит: призовая не выдана или выдана не за то (ТЗ-8.7); потеря пака за раунд плей-офф.
    let save = fresh();
    const kits: string[] = [];
    (['g1', 'g2', 'g3', 'r16', 'qf', 'sf'] as const).forEach((r, i) => {
      const o = finishCup(save, played(2, 1), null, at(r, `m${i}`));
      save = o.save;
      kits.push(...o.facts.flatMap((f) => (f.fact === 'kit' ? [f.id] : [])));
    });
    expect(kits).toEqual(['p-turq', 'p-red']);
    expect(save.album.packs).toBe(6);
    expect(save.album.prize).toEqual(['p-turq', 'p-red']);
  });

  it('068-К3 ничья в плей-офф решает серия: победа — раунд выигран, поражение — «ответный» без пака', () => {
    // Ловит: серия не попадает в запись раунда; победа в серии без пака; проигранная серия засчитана.
    const g = fresh(playGroup(['W', 'W', 'W']));
    const w = finishCup(g, played(1, 1), won, at('r16', 'sw'));
    expect(w.view).toMatchObject({ passed: true, pack: true, series: { won: true } });
    expect(w.save.cup.ko.r16).toMatchObject({ won: true, series: 'w' });
    const l = finishCup(g, played(1, 1), lost, at('r16', 'sl'));
    expect(l.view).toMatchObject({ passed: false, pack: false });
    expect(l.save.cup.ko.r16).toMatchObject({ won: false, tries: 1, series: 'l' });
  });

  it('068-К3 титул: пак, кубок, нашивка, бутсы, две формы, «Открытие»; серебро — один раз и без праздника', () => {
    // Ловит: награды титула потеряны (ТЗ-8.7); серебро выдано дважды; серебро с кубком и ступенью (038-Р10).
    const upToFinal = fresh(playKo(playGroup(['W', 'W', 'W']), 3));
    const silver = finishCup(upToFinal, played(0, 1), null, at('f', 's1'));
    expect(silver.facts.map((f) => f.fact)).toEqual(['round', 'silver']);
    expect(silver.save.cup.title).toBe('silver');
    const again = finishCup(silver.save, played(0, 1), null, at('f', 's2'));
    expect(again.facts.map((f) => f.fact)).toEqual(['round']);
    const gold = finishCup(again.save, played(2, 1), null, at('f', 'g'));
    expect(gold.facts.map((f) => f.fact)).toEqual(['round', 'pack', 'kit', 'kit', 'patch', 'boots', 'stage', 'title']);
    expect(gold.save.cup).toMatchObject({ title: 'gold', titleDay: '2026-11-20' });
    expect(gold.save.album.prize).toEqual(['p-ystars', 'p-champ']);
  });

  it('068-К3 повтор после титула — общий свисток целиком (ТЗ-8.13, Э5.43 «+N болельщиков»): монеты, болельщики, стадион; ни пака, ни форм, ни фактов', () => {
    // Ловит: повторный пак или форма за уже взятый Кубок; титул, перезаписанный повтором; повтор без монет, болельщиков и голов стадиона.
    const done = finishCup(fresh(playKo(playGroup(['W', 'W', 'W']), 3)), played(2, 1), null, at('f', 'g')).save;
    const packs = done.album.packs;
    const rep = finishCup(done, played(3, 0, 60), null, at('r16', 'rep'));
    expect(rep.view).toMatchObject({ replay: true, coins: 3, fans: 60, pack: false, kits: [] });
    expect(rep.facts).toEqual([]);
    expect(rep.save.album).toEqual(done.album);
    expect(rep.save.album.packs).toBe(packs);
    expect(rep.save.cup).toMatchObject({ title: 'gold', replays: 1 });
    expect(rep.save.stadium).not.toEqual(done.stadium);
    expect(finishCup(rep.save, played(3, 0, 60), null, at('r16', 'rep')).save).toBe(rep.save);
  });

  it('068-К3 серия платит монеты и пишет форму клавиш', () => {
    // Ловит: печать серии не доходит до свистка (ТЗ-3.1 «серия печатью» платит); нажатия серии не попадают в окна формы и трудных клавиш.
    const g = fresh(playGroup(['W', 'W', 'W']));
    const withPress: SeriesResult = { ...won, stats: stats(20), presses: [{ ch: 'а', ok: true }, { ch: 'а', ok: false }] };
    const plain = finishCup(g, played(1, 1, 40), won, at('r16', 'p0'));
    const paid = finishCup(g, played(1, 1, 40), withPress, at('r16', 'p1'));
    expect(paid.view!.coins).toBe(plain.view!.coins + 1);
    expect(paid.view!.correct).toBe(60);
    expect(paid.save.coach.keys['а']).toBe('10');
    expect(plain.save.coach.keys['а']).toBeUndefined();
  });

  it('068-К3 ничья в плей-офф без серии — поражение раунда (повторить), без пака', () => {
    // Ловит: ничья без серии засчитана как победа.
    const g = fresh(playGroup(['W', 'W', 'W']));
    const o = finishCup(g, played(1, 1), null, at('r16', 'nd'));
    expect(o.view).toMatchObject({ passed: false, pack: false, series: null });
    expect(o.save.cup.ko.r16.won).toBe(false);
  });

  it('068-К3 «белая с красными полосами» — после полуфинала, не после четвертьфинала', () => {
    // Ловит: полуфинальная форма за четвертьфинал (мутант 'sf' → 'qf').
    let save = fresh(playGroup(['W', 'W', 'W']));
    for (const [i, r] of (['r16', 'qf'] as const).entries()) save = finishCup(save, played(2, 1), null, at(r, `k${i}`)).save;
    expect(save.album.prize).not.toContain('p-red');
    save = finishCup(save, played(2, 1), null, at('sf', 'k2')).save;
    expect(save.album.prize).toContain('p-red');
  });
});

/** 068-Т6: матч Кубка на экране — чистая часть `app/cup` (старт, свисток, вступление, карточка итога). */
describe('068-Т6: app/cup — матч Кубка', () => {
  const lessons = courseLessons;
  const whistle = (me: number, opp: number): Run => ({ start: { seed: 7 }, state: { phase: 'result', result: played(me, opp) }, events: [], overlay: 'none', below: 'none' }) as unknown as Run;
  const deps = (save: CupSave) => {
    const calls: Record<string, unknown>[] = [];
    let cur = save;
    return {
      calls,
      read: () => cur,
      save: (patch: Record<string, unknown>) => {
        calls.push(patch);
        cur = { ...cur, ...(patch as Partial<CupSave>) };
        return { ok: true };
      },
      journal: { put: () => Promise.resolve() },
    };
  };
  const ctxAt = (cup: Cup, cur: number, dayN = 5) => cupView(cup, { cur, day: '2026-11-20', dayN, pause5: false, seed: 1 });

  it('068-Т6-К1 играть можно открытый раунд и переигровку; ждущий, закрытый и взятый Кубок — нет', () => {
    // Ловит: кнопка «На матч» ведёт в матч раунда, который ещё закрыт (до якоря, день < 3, прошлый раунд не выигран).
    expect(playableRound(ctxAt(emptyCup(), 10).next)).toBe('g1');
    expect(playableRound(ctxAt(emptyCup(), 5).next)).toBeNull();
    expect(playableRound(ctxAt(emptyCup(), 10, 2).next)).toBeNull();
    expect(playableRound(ctxAt(recordTour(emptyCup(), 1, 0, 1), 10).next)).toBe('g1');
    expect(playableRound(ctxAt(playKo(playGroup(['W', 'W', 'W']), 4), 33).next)).toBeNull();
    expect(roundOf('r16')).toBe('r16');
    expect(roundOf('lesson')).toBeNull();
  });

  it('068-Т6-К2 старт матча: урок Кубка по якорю раунда; доп. время — только в плей-офф', () => {
    // Ловит: доп. время в матче группы (ничья должна засчитываться, К1 запретов); урок обычный, а не Кубка (+21–24 % печати, id).
    const g = cupStart('g1', 9, lessons, emptyForm(), 1, dictionaryOf())!;
    const k = cupStart('r16', 21, lessons, emptyForm(), 1, dictionaryOf())!;
    expect(g.start.extra).toBe(false);
    expect(k.start.extra).toBe(true);
    expect(g.lesson.id).toMatch(/\.cup-9$/);
    expect(k.lesson.friendly).toBe(false);
    expect(cupStart('g1', 99, lessons, emptyForm(), 1, dictionaryOf())).toBeNull();
  });

  it('068-Т6-К3 свисток пишет раздел cup и кошелёк один раз; повтор того же matchId — repeat; не свисток — none', () => {
    // Ловит: двойной Enter платит дважды; матч, брошенный до свистка (М3), пишет игрока; результат матча не доходит до раздела cup.
    const d = deps(fresh());
    const ctx = { now: 1_000_000, day: '2026-11-20', matchId: 'c1', round: 'g1' as const };
    const a = finishCupRun(whistle(2, 1), ctx, d);
    expect(a.kind).toBe('cup');
    expect(d.calls).toHaveLength(1);
    expect(d.calls[0]!.cup).toMatchObject({ tours: [{ me: 2, opp: 1 }, { me: null }, { me: null }] });
    expect(finishCupRun(whistle(2, 1), ctx, d).kind).toBe('repeat');
    expect(d.calls).toHaveLength(1);
    const idle = { ...whistle(2, 1), state: { phase: 'half1' } } as unknown as Run;
    expect(finishCupRun(idle, { ...ctx, matchId: 'c2' }, d).kind).toBe('none');
  });

  it('068-Т6-К4 карточка итога группы: победа +3 очка, ничья +1 и «группа пройдена», поражение — переиграть', () => {
    // Ловит: очки тура в заголовке не те (Э5.26–.28); «дальше» не на следующий тур; поражение ведёт «Дальше» вместо переигровки; таблица считает проигранный тур.
    const card = (cup: Cup, round: 'g1' | 'g2' | 'g3', me: number, opp: number, cur: number) => {
      const fin = finishCupRun(whistle(me, opp), { now: 1, day: '2026-11-20', matchId: `m${round}${me}${opp}`, round }, deps(fresh(cup))) as CupFinished;
      return cupCard(fin, ctxAt(fin.after, cur), 'Прогресс');
    };
    const win = card(emptyCup(), 'g1', 2, 1, 10);
    expect(win.title).toBe('Победа 2:1 · +3 очка');
    expect(win.note).toBe('дальше: 2-й матч группы — после урока 14');
    expect(win.pack).not.toBeNull();
    expect(win.primary).toEqual({ label: 'Дальше', go: 'next' });
    const draw = card(playGroup(['W', 'D']), 'g3', 1, 1, 19);
    expect(draw.title).toBe('Ничья 1:1 · +1 очко');
    expect(draw.done).toMatch(/^Группа пройдена: [12]-е место!$/);
    expect(draw.note).toMatch(/^1\/8 финала — «.+», двор на .+, после урока 21$/);
    const loss = card(playGroup(['W']), 'g2', 0, 1, 15);
    expect(loss.title).toBe('Не беда! 0:1');
    expect(loss.primary).toEqual({ label: 'Переиграть сейчас', go: 'replay' });
    expect(loss.pack).toBeNull();
    expect(loss.table!.rows.find((x) => x.our)).toMatchObject({ p: 1, rep: true });
    expect(loss.stats).toEqual({ acc: '100 %', cpm: '40' }); // 068-Т6-К4: «Точность» и «Скорость» поражения (Э5.28); победа — без них
    expect(win.stats).toBeNull();
  });

  it('068-Т6-К5 (+ К15 табло итога) вступление: раунд, соперник со своей улицей, дома/в гостях, переигровка в заголовке и табло', () => {
    // Ловит: заголовок без «ответный матч» после проигранной попытки (Э5.23); табло группы без буквы; соперник не из пути раунда; трудные клавиши строчными (068-Р46).
    const lostR16 = recordKo(playGroup(['W', 'D', 'D']), 'r16', 1, 2, null, '2026-11-20');
    const k = cupMatchInfo(ctxAt(lostR16, 22), 'r16', 'дл')!;
    expect(k.title).toBe('Кубок двора · 1/8 финала · ответный матч');
    expect(k.board).toBe('Ответный матч');
    expect(k.rules[0]).toBe('всё пройденное, трудные клавиши чаще: Д Л'); // 068-Р46: прописными, как на макете Э5.23 и на клавишах
    expect(k.rules).toContain('ничья — доп. время, потом серия печатью');
    expect(k.team.id).toBe('strizh');
    expect(cupMatchInfo(ctxAt(lostR16, 22), 'r16', '', true)!.board).toBe('1/8 финала'); // 068-Т6-К15: табло итога (Э5.41) называет сыгранный раунд
    const g = cupMatchInfo(ctxAt(emptyCup(), 10), 'g1', '')!;
    expect(g.board).toBe('Группа C · 1-й матч');
    expect(g.rules[0]).toBe('всё пройденное, трудные клавиши чаще');
    expect(g.rules).not.toContain('ничья — доп. время, потом серия печатью');
    expect(cupMatchInfo(ctxAt(emptyCup(), 10), 'r16', '')).toBeNull();
  });

  /** Серия — 3 удара после ничьей в плей-офф (Э5.30–.35): когда нужна и как кончает запись раунда. */
  const koCup = (): Cup => playGroup(['W', 'D', 'D']);
  const series = (won: boolean): SeriesResult => ({ won, mine: won ? ['goal', 'miss', 'goal'] : ['miss', 'goal', 'miss'], theirs: won ? ['goal', 'miss'] : ['goal', 'miss', 'goal'], stats: emptyStats, presses: [] });
  const koCtx = { now: 1, day: '2026-11-20', matchId: 'k1', round: 'r16' as const };

  it('068-Т6-К6 серия нужна только после ничьей в плей-офф; группа и победа в основное время — без неё', () => {
    // Ловит: серия в группе (К1 запретов); ничья плей-офф уходит на итог без серии (раунд проигран молча); серия после победы.
    expect(needsSeries(whistle(1, 1), 'r16')).toBe(true);
    expect(needsSeries(whistle(1, 1), 'f')).toBe(true);
    expect(needsSeries(whistle(1, 1), 'g2')).toBe(false);
    expect(needsSeries(whistle(2, 1), 'r16')).toBe(false);
    expect(needsSeries({ ...whistle(1, 1), state: { phase: 'extra' } } as unknown as Run, 'r16')).toBe(false);
  });

  it('068-Т6-К7 исход серии доходит до записи: победа — раунд выигран, пак; поражение — ответный; один раз на matchId', () => {
    // Ловит: finishCupRun игнорирует серию (ничья плей-офф = поражение, 038-Р38); победа в серии без пака; повтор платит дважды.
    const w = deps(fresh(koCup()));
    const won = finishCupRun(whistle(1, 1), koCtx, w, series(true)) as CupFinished;
    expect(won.view.series?.won).toBe(true);
    expect(won.view.passed).toBe(true);
    expect(won.view.pack).toBe(true);
    expect(finishCupRun(whistle(1, 1), koCtx, w, series(true)).kind).toBe('repeat');
    expect(w.calls).toHaveLength(1);
    const l = finishCupRun(whistle(1, 1), koCtx, deps(fresh(koCup())), series(false)) as CupFinished;
    expect(l.view.series?.won).toBe(false);
    expect(l.view.passed).toBe(false);
    expect(l.view.pack).toBe(false);
  });

  it('068-Р71 К-ревью 2: 3-й матч дня — Кубок: свисток зовёт ритм дня — «Итог дня» есть, строки тренера нет; 2-й матч — итога нет', () => {
    // Ловит: матч Кубка не вызывает afterMatch — время печати Кубка идёт в день, а итог дня теряется (ревью-2 Т8).
    const two = { ...fresh(), day: playedMatch(playedMatch(dayDef.empty(), '2026-11-20', 1), '2026-11-20', 2) };
    const third = finishCupRun(whistle(2, 1), at('g1', 'r71'), { ...deps(two), readStory: emptyStory }) as CupFinished;
    expect(third.rhythm?.summary).toBe(true);
    expect(third.rhythm?.line).toBeNull();
    const second = finishCupRun(whistle(2, 1), at('g1', 'r71b'), { ...deps({ ...fresh(), day: playedMatch(dayDef.empty(), '2026-11-20', 1) }), readStory: emptyStory }) as CupFinished;
    expect(second.rhythm?.summary).toBe(false);
  });

  it('068-Р70 К-ревью 3: долг итога дня, пойманный до Кубка, гасится на итоге Кубка — в записи day.summaryMissed === null, итог дня есть', () => {
    // Ловит: Кубок без `rhythmPatch` (долг остаётся в записи), Кубок с `summaryShows = false` (долг снова пишется) — итог дня теряется навсегда.
    const D = '2026-11-20';
    const owed = { ...fresh(), day: { ...play3(D), summaryMissed: D } };
    const d = deps(owed);
    const out = finishCupRun(whistle(2, 1), at('g1', 'r70'), { ...d, readStory: emptyStory }) as CupFinished;
    expect(out.rhythm?.summary).toBe(true);
    expect((d.calls[0]!.day as { summaryMissed?: string | null }).summaryMissed).toBeNull();
  });

  it('068-Р78 return: матч Кубка после паузы ≥ 5 дней — rhythm.returned (событие «Капитан вернулся»); без паузы — нет', () => {
    // Ловит: Кубок не передаёт `isComeback` в ритм дня — возврат, пришедшийся на Кубок, теряется.
    const DAYMS = 24 * 60 * 60 * 1000;
    const gone = { ...fresh(), day: { ...dayDef.empty(), last: 1_000 } };
    const back = finishCupRun(whistle(2, 1), { ...at('g1', 'r78'), now: 1_000 + 5 * DAYMS }, { ...deps(gone), readStory: emptyStory }) as CupFinished;
    expect(back.rhythm?.returned).toBe(true);
    const near = finishCupRun(whistle(2, 1), { ...at('g1', 'r78b'), now: 1_000 + 5 * DAYMS - 1 }, { ...deps(gone), readStory: emptyStory }) as CupFinished;
    expect(near.rhythm?.returned).toBe(false);
  });

  it('068-Р71 К-ревью 1: кнопки итога Кубка — «Итог дня» перед любым уходом (серебро, награды, титул, карточка); без итога — обычный путь', () => {
    // Ловит: «Сыграть финал ещё раз» мимо итога дня; итог дня до окон наград; «Ещё матч» полосы на сыгранный раунд.
    const toFinal = fresh(playKo(playGroup(['W', 'W', 'W']), 3));
    const silver = cupAwards(finish(toFinal, 1, 2, 'f', 'x1'), strizh);
    const kit = cupAwards(finish(fresh(playGroup(['W', 'D'])), 1, 1, 'g3', 'x2'), strizh);
    const base = { title: null, cardGo: 'next' as const, summary: true };
    expect(cupStep({ ...base, awards: silver, at: 0 })).toEqual({ kind: 'summary' });
    expect(cupStep({ ...base, awards: silver, at: 0, summary: false })).toEqual({ kind: 'go', to: 'replay' });
    expect(cupStep({ ...base, awards: kit, at: -1 })).toEqual({ kind: 'award', at: 0 }); // окна наград — до итога дня
    expect(cupStep({ ...base, awards: kit, at: 0 })).toEqual({ kind: 'summary' });
    expect(cupStep({ ...base, awards: kit, at: 0, summary: false })).toEqual({ kind: 'go', to: 'map' });
    expect(cupStep({ ...base, awards: [], at: -1 })).toEqual({ kind: 'summary' });
    expect(cupStep({ ...base, awards: [], at: -1, cardGo: 'replay', summary: false })).toEqual({ kind: 'go', to: 'replay' });
    expect(cupStep({ ...base, title: 'more', awards: [], at: -1 })).toEqual({ kind: 'title' });
    expect(cupStep({ ...base, title: 'last', awards: [], at: -1 })).toEqual({ kind: 'summary' });
    expect(cupStep({ ...base, title: 'last', awards: [], at: -1, summary: false })).toEqual({ kind: 'go', to: 'home' });
    // «Ещё матч» полосы: после победы — Карта (сыгранный раунд не играется), после поражения и серебра — повтор
    expect(cupMoreGo('next', [])).toBe('map');
    expect(cupMoreGo('replay', [])).toBe('replay');
    expect(cupMoreGo('next', silver)).toBe('replay');
  });

  it('068-Р99 К-Р99: подпись второй кнопки полосы совпадает с маршрутом — победа «На карту» (карта), поражение и серебро «Ещё матч» (повтор), не Кубок — «Ещё матч»', () => {
    // Ловит: «Ещё матч» на кнопке, которая ведёт на Карту (ребёнок читает буквально и ждёт матч); подпись отдельным условием, а не из решения о маршруте.
    const toFinal = fresh(playKo(playGroup(['W', 'W', 'W']), 3));
    const silver = cupAwards(finish(toFinal, 1, 2, 'f', 'x1'), strizh);
    expect(stripMoreAct({ cardGo: 'next', awards: [] })).toEqual({ go: 'map', label: 'На карту' });
    expect(stripMoreAct({ cardGo: 'replay', awards: [] })).toEqual({ go: 'replay', label: 'Ещё матч' });
    expect(stripMoreAct({ cardGo: 'next', awards: silver })).toEqual({ go: 'replay', label: 'Ещё матч' });
    expect(stripMoreAct(null)).toEqual({ go: 'replay', label: 'Ещё матч' });
  });

  it('068-Т6-К8 карточка серии: «Серия наша!», отметки обеих команд; проигрыш — «Серия 1:2», точность, ответный матч', () => {
    // Ловит: серия без заголовка и отметок (Э5.34/.35); проигранная серия на кнопке «Дальше»; нет «Точности/Скорости» в поражении; победа в серии — «ничья».
    const win = finishCupRun(whistle(1, 1), koCtx, deps(fresh(koCup())), series(true)) as CupFinished;
    const a = cupCard(win, ctxAt(win.after, 22), 'Прогресс');
    expect(a.kind).toBe('win');
    expect(a.title).toBe('Серия наша! 2 чистых из 3');
    expect(a.series?.head).toBe('Серия 2:1');
    expect(a.series?.rows.map((x) => x.shots)).toEqual([['goal', 'miss', 'goal'], ['goal', 'miss']]);
    expect(a.stats).toBeNull();
    expect(a.primary).toEqual({ label: 'Дальше', go: 'next' });
    const loss = finishCupRun(whistle(1, 1), { ...koCtx, matchId: 'k2' }, deps(fresh(koCup())), series(false)) as CupFinished;
    const b = cupCard(loss, ctxAt(loss.after, 22), 'Прогресс');
    expect(b.kind).toBe('loss');
    expect(b.title).toBe('Не беда! Серия 1:2');
    expect(b.series?.head).toBe('Серия 1:2');
    expect(b.stats).not.toBeNull();
    expect(b.primary).toEqual({ label: 'Ответный матч', go: 'replay' });
    expect(b.note).toBe('ещё ответный матч — тот же раунд, вылета нет');
  });

  /** Итог матча Кубка по сохранению `save`: тот же путь, что в игре (свисток → запись → итог). */
  const finish = (save: CupSave, me: number, opp: number, round: CupFinishCtx['round'], id: string, sr: SeriesResult | null = null) => finishCupRun(whistle(me, opp), { now: 1, day: '2026-11-20', matchId: id, round }, deps(save), sr) as CupFinished;
  const strizh = TEAMS.find((x) => x.id === 'strizh')!;

  it('068-Т6-К10 окна наград: форма «Бирюза» за группу и «белая с красными» за полуфинал; на четвертьфинале, в титул и при повторе окон нет', () => {
    // Ловит: награда формы без окна (Э5.37/.38); окно на раунде без формы; окно титула в чужой задаче (Т9); окно у повтора после титула (ТЗ-8.13).
    const g3 = cupAwards(finish(fresh(playGroup(['W', 'D'])), 1, 1, 'g3', 'a'), strizh);
    expect(g3).toHaveLength(1);
    expect(g3[0]).toMatchObject({ kind: 'kit', kitId: 'p-turq', title: 'Группа пройдена!', lead: 'Форма «Бирюзовый шеврон» — твоя', primaryGo: 'card', quietGo: 'locker', quiet: 'В Раздевалку' });
    expect(g3[0]!.tags).toEqual(['новая форма — в Раздевалке', '+ пак']);
    const sf = cupAwards(finish(fresh(playKo(playGroup(['W', 'W', 'W']), 2)), 2, 1, 'sf', 'b'), strizh);
    expect(sf.map((x) => [x.kitId, x.title])).toEqual([['p-red', 'В финале!']]);
    expect(cupAwards(finish(fresh(playKo(playGroup(['W', 'W', 'W']), 1)), 2, 1, 'qf', 'c'), strizh)).toEqual([]);
    const toFinal = fresh(playKo(playGroup(['W', 'W', 'W']), 3));
    expect(cupAwards(finish(toFinal, 2, 1, 'f', 'd'), strizh)).toEqual([]); // титул — окно Т9
    const gold = finishCup(toFinal, played(2, 1), null, at('f', 'g')).save;
    expect(cupAwards(finish(gold, 3, 0, 'r16', 'e'), strizh)).toEqual([]); // повтор после титула — без окон
    expect(cupAwards(finish(fresh(playGroup(['W'])), 0, 1, 'g2', 'f'), strizh)).toEqual([]); // поражение — без окон
  });

  it('068-Т6-К11 серебро: окно вместо карточки без праздника — один раз; «Сыграть финал снова» и «Потом»; серия — «выиграл серию»', () => {
    // Ловит: серебро без окна (Э5.41); окно серебра повторно после второго проигранного финала; кнопка «Потом» не в Дом; праздник (титул) при серебре.
    const toFinal = fresh(playKo(playGroup(['W', 'W', 'W']), 3));
    const first = finish(toFinal, 1, 2, 'f', 's1');
    const w = cupAwards(first, strizh);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ kind: 'silver', kitId: null, title: 'Финал: серебро', lead: 'за золотом — сыграть снова', primary: 'Сыграть финал снова', primaryGo: 'replay', quiet: 'Потом', quietGo: 'home' });
    expect(w[0]!.sub).toBe(`«Стриж» · двор на ${strizh.street} победил 2:1`);
    expect(w[0]!.tags).toEqual(['в Музее клуба — серебро Кубка двора']);
    expect(first.view.title).toBe('silver');
    expect(first.facts.map((f) => f.fact)).not.toContain('title');
    const again = finish({ ...toFinal, cup: first.after }, 0, 1, 'f', 's2');
    expect(cupAwards(again, strizh)).toEqual([]);
    const bySeries = cupAwards(finish(toFinal, 1, 1, 'f', 's3', series(false)), strizh);
    expect(bySeries[0]!.sub).toBe(`«Стриж» · двор на ${strizh.street} выиграл серию`);
  });

  it('068-Т6-К12 повтор после титула: карточка победы без пака, таблицы и очков, справа «Кубок уже наш…»; вступление — той же строкой первой', () => {
    // Ловит: повтор показан как «ничья/поражение» (раунд не засчитан); пак или таблица группы у повтора (ТЗ-8.13, Э5.43); вступление повтора со старыми правилами.
    const gold = finishCup(fresh(playKo(playGroup(['W', 'W', 'W']), 3)), played(2, 1), null, at('f', 'g')).save;
    const rep = finish(gold, 2, 1, 'f', 'rep');
    const view = ctxAt(rep.after, 33);
    const card = cupCard(rep, view, 'Прогресс');
    expect(card).toMatchObject({ kind: 'win', replay: true, pack: null, done: null, table: null, stats: null, title: 'Победа 2:1', note: 'Кубок уже наш: пак и титул не повторяются, монеты — как за матч' });
    expect(card.primary).toEqual({ label: 'Дальше', go: 'next' });
    const lost = cupCard(finish(gold, 0, 1, 'f', 'rep2'), view, 'Прогресс');
    expect(lost).toMatchObject({ kind: 'loss', replay: true, note: 'Кубок уже наш: пак и титул не повторяются, монеты — как за матч' });
    const intro = cupMatchInfo(view, 'f', 'дл')!;
    expect(intro.rules).toEqual(['Кубок уже наш: пак и титул не повторяются, монеты — как за матч', 'ничья — доп. время, потом серия печатью']);
    expect(cupMatchInfo(ctxAt(playKo(playGroup(['W', 'W', 'W']), 3), 33), 'f', '')!.rules[0]).toBe('всё пройденное, трудные клавиши чаще'); // Кубок не взят — обычное вступление
  });

  it('068-Т6-К13 кадр финала Э5.36 (068-Р52): стенд встаёт на атаку 2-го тайма при 1:1, а не на вступлении', () => {
    // Ловит: кадр финала снова на «вступлении» (истина — реестр: атака при 1:1); счёт не 1:1; кадр без 2-й половины (две атаки 2-го тайма уже сыграны).
    const f = cupMatchFrame({ round: 'f', step: 'attack' }, 7);
    expect(f.started).toBe(true);
    expect(f.spec.toHalf2).toBe(2);
    const built = cupStart('f', f.lesson, lessons, emptyForm(), 7, dictionaryOf())!;
    const run = frameRun(built.start, f.spec);
    const s = run.state as unknown as { phase: string; score: { me: number; opp: number }; log: { phase: string }[] };
    expect(s.phase).toBe('half2');
    expect(s.score).toEqual({ me: 1, opp: 1 });
    expect(s.log.filter((a) => a.phase === 'half2')).toHaveLength(2);
  });

  it('068-Т6-К14 фикстуры кадров Э5.36–.38 несут шаг и окно награды: стенд не откатывается к вступлению и карточке итога', () => {
    // Ловит: фикстуры не перегенерированы после правки cup-frames.mjs (ключ `award` и шаг `attack` пропали) — кадр снимает не то состояние.
    const cf = (id: string) => (JSON.parse(readFileSync(`tests/fixtures/accepted/${id}.json`, 'utf8')) as { cupFrame: { step?: string; award?: boolean } }).cupFrame;
    expect(cf('cup-match.final').step).toBe('attack');
    expect(cf('cup-awards.r-form-group').award).toBe(true);
    expect(cf('cup-awards.r-form-semi').award).toBe(true);
    expect(cf('cup-awards.r-title').award).toBeUndefined(); // титул идёт окном сам, без признака
  });
  it('068-Т9-К16 окно титула: лента наград выданного сейчас, счёт и соперник; серебро, повтор, раунд без титула — окна нет', () => {
    // Ловит: титул без окна (Э5.39); окно у серебра (К4) или у повтора после золота (К3); лента с наградой, которой не выдали.
    const toFinal = fresh(playKo(playGroup(['W', 'W', 'W']), 3));
    const gold = finish(toFinal, 2, 1, 'f', 'g');
    const w = cupTitle(gold, strizh)!;
    expect(w).toMatchObject({ head: 'Кубок двора наш!', sub: 'Финал 2:1 — победа над «Стрижом»', museum: 'в Музее клуба', next: 'дальше — Кубок района' });
    expect(w.tiles.map((x) => x.kind)).toEqual(['cup', 'patch', 'kit', 'kit', 'boots', 'step', 'pack']);
    expect(w.tiles.filter((x) => x.kind === 'kit').map((x) => x.kitId)).toEqual(['p-ystars', 'p-champ']);
    expect(cupTitle(finish(toFinal, 1, 2, 'f', 's'), strizh)).toBeNull();
    expect(cupTitle(finish(fresh(playKo(playGroup(['W', 'W', 'W']), 2)), 2, 1, 'sf', 'b'), strizh)).toBeNull();
    const done = finishCup(toFinal, played(2, 1), null, at('f', 'g2')).save;
    expect(cupTitle(finish(done, 3, 0, 'f', 'rep'), strizh)).toBeNull(); // повтор после титула
    expect(titleStart({ reduced: false, frame: false })).toBe('video');
    expect(titleStart({ reduced: true, frame: false })).toBe('window'); // «меньше движения»: ролик не грузится (ТЗ-9.7)
    expect(titleStart({ reduced: false, frame: true })).toBe('window');
    expect(titleNext('video')).toBe('window');
    expect(titleNext('window')).toBeNull();
  });

  it('068-Т9-К17 после титула: повтор финала играбелен, праздник Дома — только в день титула, формат раздела прежний', () => {
    // Ловит: «Сыграть снова» без матча (ТЗ-8.13, Э5.42); праздник Дома, не гаснущий назавтра; запись нового поля в раздел `cup`.
    const toFinal = fresh(playKo(playGroup(['W', 'W', 'W']), 3));
    const gold = finishCup(toFinal, played(2, 1), null, at('f', 'g')).save.cup;
    const v = cupView(gold, { cur: 33, day: '2026-11-21', dayN: 21, pause5: false, seed: 1 });
    expect(v.next.state).toBe('done');
    expect(playableRound(v.next)).toBeNull(); // К1: без `afterTitle` Кубок взят — играть нечего
    expect(playableRound(v.next, true)).toBe('f');
    expect(titleFestive(gold, '2026-11-20')).toBe(true);
    expect(titleFestive(gold, '2026-11-21')).toBe(false);
    expect(titleFestive(toFinal.cup, '2026-11-20')).toBe(false);
    expect(Object.keys(gold).sort()).toEqual(Object.keys(emptyCup()).sort());
  });
});
