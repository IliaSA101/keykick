/**
 * Сюжет Двора (068 Т3, К4): вехи 8 выпусков, показ один раз, две вехи в день, выпуск 8 после серебра, очередь входа, праздники.
 */
import { describe, expect, it } from 'vitest';
import { celebration, dueComic, entryCelebrations, entryWindow, firstTitleIn, markComicShown, markPaperShown, museumOpen, releasePapers, storyDef, storyExtras, unshownPaper } from '../../src/engine/story';
import type { Milestones, PaperFixed, Story } from '../../src/engine/story';
import { emptyStory } from '../../src/engine/story/section';
import cfg from '../../src/content/story-yard.json';
import { enterHome } from '../../src/app/story/entry';
import { entryCtxOf } from '../../src/app/story/entryCtx';
import { homePaperIsArchive, newsViewOf } from '../../src/app/story/newsOf';
import { comicView, groupBoard } from '../../src/app/story/comicView';
import { comicKey, PANELS } from '../../src/components/story/comic';
import { cupView, groupTable, seedOf } from '../../src/engine/cup';
import { numbersOf, paperFacts, type PaperIn } from '../../src/app/story/paperFacts';
import { paperView } from '../../src/app/story/paperView';
import { emptyCup } from '../../src/engine/cup';
import { bestSpeedOf, paperInOf } from '../../src/app/story/paperIn';
import { headWithoutClub, isLongClub, newsFoot, newsKey, nbText, photoKey } from '../../src/components/story/news';
import { ENTER_DELAY } from '../../src/components/panel/focusCycle';
import { emptyDay } from '../../src/engine/day/section';

const none: Milestones = { first: false, group: false, semi: false, final: null };
const out = (s: Story, cur: number, cup: Milestones, day: number): Story => releasePapers(s, { cur, cup, day });
const nums = (s: Story): number[] => Object.keys(s.papers).map(Number).sort((a, b) => a - b);

describe('выпуски: вехи', () => {
  it('К4: 8 выпусков Двора, у каждого уникальный номер и веха', () => {
    // Ловит: пропущенный или задвоенный выпуск в контенте (ТЗ-9.3 — ровно 8).
    expect(cfg.papers.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(cfg.papers.map((p) => JSON.stringify(p.trigger))).size).toBe(8);
  });

  it('К4: выпуски выходят по вехам — урок 5, 9, 14, 21 пройден (cur > N) и вехи Кубка', () => {
    // Ловит: выпуск раньше вехи (cur === N — урок ещё идёт) или не вышедший после неё.
    expect(nums(out(emptyStory(), 5, none, 1))).toEqual([]);
    expect(nums(out(emptyStory(), 6, none, 1))).toEqual([1]);
    expect(nums(out(emptyStory(), 10, none, 3))).toEqual([1, 2]);
    expect(nums(out(emptyStory(), 15, { ...none, first: true }, 5))).toEqual([1, 2, 3, 4]);
    expect(nums(out(emptyStory(), 22, { first: true, group: true, semi: false, final: null }, 7))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(nums(out(emptyStory(), 33, { first: true, group: true, semi: true, final: 'gold' }, 9))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('К4 С2: две вехи в один день — два выпуска, показ по одному по номеру, каждый один раз', () => {
    // Ловит: слитые выпуски 1 и 2 (050-Р32) или повторный показ (С2).
    let s = out(emptyStory(), 10, none, 3);
    expect(s.papers['1']!.day).toBe(3);
    expect(s.papers['2']!.day).toBe(3);
    expect(unshownPaper(s)).toBe(1);
    s = markPaperShown(s, 1);
    expect(unshownPaper(s)).toBe(2);
    s = markPaperShown(markPaperShown(s, 2), 2);
    expect(unshownPaper(s)).toBeNull();
    expect(out(s, 10, none, 4)).toBe(s);
  });

  it('К4 С3: финал выигран после серебра — выпуск 8 остаётся «серебряным» и не выходит второй раз', () => {
    // Ловит: перезапись выпуска 8 (новый день, shown=false) после титула со второго раза.
    let s = out(emptyStory(), 33, { first: true, group: true, semi: true, final: 'silver' }, 10);
    s = markPaperShown(s, 8);
    const again = out(s, 33, { first: true, group: true, semi: true, final: 'gold' }, 12);
    expect(again.papers['8']).toEqual({ day: 10, shown: true });
    expect(unshownPaper(again)).not.toBe(8);
  });

  it('К4: «свежая газета» — день последнего выпуска; музей открыт с первого показанного', () => {
    // Ловит: метка «свежая» от показа вместо выхода (ТЗ-10.3), музей открыт до показа.
    let s = out(emptyStory(), 10, none, 3);
    expect(storyExtras(s)).toEqual({ papers: 2, paperDay: 3 });
    expect(storyExtras(emptyStory())).toEqual({ papers: 0, paperDay: null });
    expect(museumOpen(s)).toBe(false);
    s = markPaperShown(s, 1);
    expect(museumOpen(s)).toBe(true);
    // Ловит: `paperDay` — день первого, а не последнего выпуска (выпуски в разные дни).
    expect(storyExtras(out(out(emptyStory(), 6, none, 3), 10, none, 5))).toEqual({ papers: 2, paperDay: 5 });
  });

  it('К4: проверка раздела ловит испорченное', () => {
    // Ловит: пропуск битого выпуска и комикса при загрузке (карантин раздела, 060).
    expect(storyDef.check(emptyStory())).toEqual([]);
    expect(storyDef.check({ ...emptyStory(), papers: { 9: { day: 1, shown: false } } })).toEqual(['papers']);
    expect(storyDef.check({ ...emptyStory(), comics: { zzz: 1 } })).toEqual(['comics']);
    expect(storyDef.check({ ...emptyStory(), adviceDay: -1 })).toEqual(['adviceDay']);
    // Ловит: флаг `shown` не булев («1» или «false» строкой читается как показанный).
    expect(storyDef.check({ ...emptyStory(), papers: { 1: { day: 1, shown: 1 } } })).toEqual(['papers']);
    expect(storyDef.check({ ...emptyStory(), papers: { 1: { day: 1, shown: 'false' } } })).toEqual(['papers']);
  });

  it('К4: вход в день 0 — «Завязка» записывается и проходит проверку раздела', () => {
    // Ловит: `markComicShown(story,"intro",0)` отвергается проверкой (v >= 1) — запись первого входа отказала бы.
    const s = markComicShown(emptyStory(), 'intro', 0);
    expect(s.comics.intro).toBe(0);
    expect(storyDef.check(s)).toEqual([]);
    expect(dueComic(s, none)).toBeNull();
    expect(storyDef.check({ ...emptyStory(), comics: { intro: -1 } })).toEqual(['comics']);
    expect(storyDef.check({ ...emptyStory(), papers: { 1: { day: 0, shown: false } } })).toEqual([]);
  });
});

describe('очередь входа на Дом', () => {
  it('К4 С1: за вход — одно сюжетное окно, комикс раньше выпуска, выпуск раньше «Прав»', () => {
    // Ловит: два сюжетных окна за вход (ТЗ-10.11) или выпуск раньше комикса.
    const s = out(emptyStory(), 10, none, 3);
    expect(entryWindow({ story: s, cup: none, rights: true })).toEqual({ kind: 'comic', id: 'intro' });
    const s2 = markComicShown(s, 'intro', 3);
    expect(entryWindow({ story: s2, cup: none, rights: true })).toEqual({ kind: 'paper', n: 1 });
    const s3 = markPaperShown(markPaperShown(s2, 1), 2);
    expect(entryWindow({ story: s3, cup: none, rights: true })).toEqual({ kind: 'rights' });
    expect(entryWindow({ story: s3, cup: none })).toBeNull();
  });

  it('К4: «Ещё матч» обходит Дом — непоказанные копятся и идут по одному на вход', () => {
    // Ловит: показ всех накопленных разом или потеря пропущенного выпуска.
    const cup: Milestones = { first: true, group: true, semi: false, final: null };
    let s = markComicShown(markComicShown(emptyStory(), 'intro', 1), 'group', 8);
    s = out(s, 22, cup, 8);
    const seen: number[] = [];
    for (let k = 0; k < 10; k++) {
      const w = entryWindow({ story: s, cup });
      if (w === null || w.kind !== 'paper') break;
      seen.push(w.n);
      s = markPaperShown(s, w.n);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('К4: перезагрузка с открытым комиксом — флаг стоит, не повтор', () => {
    // Ловит: флаг ставится при закрытии, а не при открытии.
    const s = markComicShown(emptyStory(), 'intro', 1);
    expect(dueComic(s, none)).toBeNull();
    expect(markComicShown(s, 'intro', 9).comics.intro).toBe(1);
  });

  it('К4: комиксы по вехам — группа, финал-золото, финал-серебро', () => {
    // Ловит: комикс «Финал» при серебре или «Серебро» при золоте.
    let s = markComicShown(emptyStory(), 'intro', 1);
    expect(dueComic(s, { ...none, first: true })).toBeNull();
    expect(dueComic(s, { first: true, group: true, semi: false, final: null })).toBe('group');
    s = markComicShown(s, 'group', 5);
    expect(dueComic(s, { first: true, group: true, semi: true, final: 'silver' })).toBe('silver');
    expect(dueComic(s, { first: true, group: true, semi: true, final: 'gold' })).toBe('final');
  });
});

describe('праздники', () => {
  it('К4: после итога — один, самый старший (титул → эмблема → … → ранг)', () => {
    // Ловит: порядок старшинства ТЗ-10.11 и больше одного праздника после итога.
    expect(celebration({})).toBeNull();
    expect(celebration({ kit: true, rank: true })).toBe('kit');
    expect(celebration({ rank: true, stage: true, emblem: true })).toBe('emblem');
    expect(celebration({ rank: true, title: true, stadium: true })).toBe('title');
  });

  it('К4: на входе в Дом — не больше двух, остальное меткой «новое»', () => {
    // Ловит: три окна праздников подряд (ТЗ-10.11, 023-Р11).
    expect(entryCelebrations({ gold: true, milestone: true, kit: true, rank: true })).toEqual({ show: ['gold', 'milestone'], news: ['kit', 'rank'] });
    expect(entryCelebrations({})).toEqual({ show: [], news: [] });
  });
});

describe('вход на Дом (068 Т7)', () => {
  const grp: Milestones = { first: true, group: true, semi: false, final: null };

  it('К4: первый вход — «Завязка», флаг ставится сразу; повторный вход (перезагрузка) окна не повторяет', () => {
    // Ловит: комикс, который не помечен при открытии (F5 снова покажет его), и день 0 до первого матча.
    const a = enterHome(emptyStory(), { cur: 1, cup: none, day: 0 });
    expect(a.window).toEqual({ kind: 'comic', id: 'intro' });
    expect(a.story.comics.intro).toBe(0);
    expect(enterHome(a.story, { cur: 1, cup: none, day: 0 }).window).toBeNull();
  });

  it('К4: С1 — за вход одно окно: комикс раньше выпуска, выпуск ждёт следующего входа', () => {
    // Ловит: два сюжетных окна подряд (ТЗ-10.11): выпуск 1 выходит вместе с «Завязкой», но открывается позже.
    const a = enterHome(emptyStory(), { cur: 6, cup: none, day: 3 });
    expect(a.window).toEqual({ kind: 'comic', id: 'intro' });
    expect(a.story.papers['1']).toEqual({ day: 3, shown: false });
    const b = enterHome(a.story, { cur: 6, cup: none, day: 3 });
    expect(b.window).toEqual({ kind: 'paper', n: 1 });
    expect(b.story.papers['1']?.shown).toBe(true);
    expect(enterHome(b.story, { cur: 6, cup: none, day: 3 }).window).toBeNull();
  });

  it('К4: две вехи за вход — выпуски по одному, по номеру (050-Р33)', () => {
    // Ловит: оба выпуска в одном входе или показ не по порядку.
    const s = enterHome(emptyStory(), { cur: 10, cup: none, day: 3 }).story; // комикс «Завязка»
    const a = enterHome(s, { cur: 10, cup: none, day: 3 });
    expect(a.window).toEqual({ kind: 'paper', n: 1 });
    expect(enterHome(a.story, { cur: 10, cup: none, day: 3 }).window).toEqual({ kind: 'paper', n: 2 });
  });

  it('К4: комикс «Выход из группы» — по вехе группы, раньше её выпуска 5', () => {
    // Ловит: выпуск 5 раньше комикса группы (комикс раньше выпуска, ТЗ-10.11).
    const a = enterHome({ ...emptyStory(), comics: { intro: 1 } }, { cur: 19, cup: grp, day: 10 });
    expect(a.window).toEqual({ kind: 'comic', id: 'group' });
  });
});

describe('газета: вид выпуска (068 Т7)', () => {
  const school = { knower: 0, grade: null, tours: [], emblem: 0, solved: [], level: {}, trainerSkip: [] };
  const base: PaperIn = { story: { ...emptyStory(), papers: { '3': { day: 4, shown: false }, '8': { day: 9, shown: false } } }, cup: emptyCup(), school, fans: 120, goals: 7, played: 5, bestSpeed: 0, seed: 1 };
  const opts = { club: 'Прогресс', city: 'Тверь', player: 'Саша', coach: 'Макс', lessonName: (n: number) => `урок-${n}` };

  it('К10: заголовок выпуска 3 несёт счёт первого матча, «Дальше» — урок на день выхода', () => {
    // Ловит: потерянный счёт в заголовке (068-Р18) и «Дальше» по текущему уроку вместо урока выхода.
    const cup = { ...emptyCup(), first: { me: 2, opp: 1 } };
    const v = paperView(paperFacts(3, { ...base, cup }), opts);
    expect(v.head).toBe('Первый матч Кубка: «Прогресс» 2:1');
    expect(v.next).toBe('Дальше: урок 11 «урок-11»');
    expect(v.notes[1]![0]).toBe('Следующий матч — после урока 14');
  });

  it('К10: данных нет — заметка без числа; серебро выпуска 8 — свой заголовок и «Дальше: сыграть финал снова»', () => {
    // Ловит: «0 матчей и 0 голов» у нового клуба; победный заголовок при серебре.
    expect(paperView(paperFacts(3, base), opts).head).toBe('Первый матч Кубка: «Прогресс»');
    const empty = paperView(paperFacts(1, { ...base, played: 0, goals: 0 }), opts);
    expect(empty.notes[0]![1]).not.toContain('На счету');
    const silver = paperView(paperFacts(8, { ...base, cup: { ...emptyCup(), title: 'silver' } }), opts);
    expect(silver.head).toBe('Серебро Кубка: «Прогресс» вернётся за золотом');
    expect(silver.next).toBe('Дальше: сыграть финал снова');
    expect(silver.deco).toBe('silver');
  });
});

describe('лист газеты и окно выпуска (068 Т7)', () => {
  const press = (key: string, extra: Partial<{ repeat: boolean; now: number }> = {}) => newsKey({ key, repeat: false, openedAt: 1000, now: 1000 + ENTER_DELAY + 10, ...extra });

  it('К10 окно: Esc закрывает всегда, Enter — не раньше паузы после открытия и не при удержании', () => {
    // Ловит: окно, которое не закрывается с клавиатуры, и двойной Enter, закрывающий выпуск сразу после открытия.
    expect(press('Escape', { now: 1001 })).toBe('close');
    expect(press('Enter')).toBe('close');
    expect(press('Enter', { now: 1000 + ENTER_DELAY - 1 })).toBeNull();
    expect(press('Enter', { repeat: true })).toBeNull();
    expect(press('a')).toBeNull();
  });

  it('К10 Э6.12: выпуск в итоге дня — «Ещё матч» и «В Дом · Enter»; обычное окно — одна кнопка «{куда} · Esc»', () => {
    // Ловит: выпуск вместо полосы без «Ещё матч» (ребёнок не может сыграть ещё, не заходя в Дом) и «Ещё матч» в Доме и Музее.
    expect(newsFoot('home', 'home')).toEqual({ more: 'Ещё матч', main: 'В Дом', sub: 'Enter' });
    expect(newsFoot('close', 'home')).toEqual({ more: null, main: 'Дом · Esc', sub: null });
    expect(newsFoot('close', 'museum')).toEqual({ more: null, main: 'Музей · Esc', sub: null });
  });

  it('К10 длинное имя: клуб длиннее 20 знаков — шапка в две строки, заголовок без повтора имени; 20 знаков — обычная шапка', () => {
    // Ловит: имя клуба 40 знаков в заголовке (не влезает) и обычная шапка у длинного имени (край Э6.01).
    const club = 'Спортивный клуб Буревестник имени Ивана';
    expect(isLongClub(club)).toBe(true);
    expect(isLongClub('Спортивный клуб Буре')).toBe(false);
    expect(headWithoutClub(`Во дворе — новый клуб «${club}»!`, club)).toBe('Во дворе — новый клуб!');
    expect(headWithoutClub(`«${club}» вышел из группы!`, club)).toBe('Клуб вышел из группы!');
    expect(nbText('Урок 5 в школе — на поле')).toContain('в\u00a0школе');
  });

  it('К10 вход: лучшая скорость клуба — максимум по урокам курса, чисел нет — 0; ключ «фото» светлой выпечки по ширине сцены', () => {
    // Ловит: рекорд скорости из последнего урока вместо лучшего и «фото» не той ширины.
    const mark = (best: number) => ({ stars: 1 as const, best, tries: 1 });
    const course = { current: 'a', lessons: { a: mark(40), b: mark(63), c: mark(0) }, archive: {}, leaguesDone: {} };
    expect(bestSpeedOf(course)).toBe(63);
    expect(bestSpeedOf({ ...course, lessons: {} })).toBe(0);
    const emptyDay = { played: 4, days: 2, today: null, todayN: 0, last: 0 };
    const sections = { story: emptyStory(), cup: emptyCup(), school: { knower: 0, grade: null, tours: [], emblem: 0, solved: [], level: {}, trainerSkip: [] }, stadium: { fans: 9, goals: 3 }, day: emptyDay as never, course, seed: 5 };
    expect(paperInOf(sections)).toMatchObject({ fans: 9, goals: 3, played: 4, bestSpeed: 63, seed: 5 });
    expect(photoKey('day1', true)).toBe('storyPhDay1L1066');
    expect(photoKey('silver', false)).toBe('storyPhSilverL562');
  });
});

describe('числа выпуска фиксируются в день выхода (068-Р30, Р31)', () => {
  const fx = (o: Partial<PaperFixed> = {}): PaperFixed => ({ played: 9, goals: 20, fans: 2680, speed: 14, tasks: 9, tours: 1, title: false, ...o });
  const school = { knower: 0, grade: null, tours: [], emblem: 0, solved: [], level: {}, trainerSkip: [] };
  const now: PaperIn = { story: emptyStory(), cup: emptyCup(), school, fans: 9000, goals: 70, played: 31, bestSpeed: 31, seed: 1 };
  const opts = { club: 'Прогресс', city: 'Тверь', player: 'Саша', coach: 'Макс', lessonName: (n: number) => `урок-${n}` };

  it('068-Т7-К1: выпуск выходит со снимком чисел и не перезаписывается, когда клуб вырос', () => {
    // Ловит: числа выпуска «растут» вместе с клубом (старая газета в Музее с сегодняшними голами) и затирание снимка повторным выходом.
    const a = releasePapers(emptyStory(), { cur: 6, cup: none, day: 3, facts: fx() });
    expect(a.papers['1']).toEqual({ day: 3, shown: false, facts: fx() });
    const b = releasePapers(a, { cur: 7, cup: none, day: 5, facts: fx({ goals: 99 }) });
    expect(b).toBe(a);
    expect(releasePapers(emptyStory(), { cur: 6, cup: none, day: 3 }).papers['1']).toEqual({ day: 3, shown: false });
  });

  it('068-Т7-К2: окно выпуска берёт числа из снимка, а не текущие; без снимка — текущие', () => {
    // Ловит: выпуск 1 с «31 матч, 70 голов» вместо «9 матчей, 20 голов» (кадры Э6: 0 голов против 20).
    const story = releasePapers(emptyStory(), { cur: 6, cup: none, day: 3, facts: fx() });
    const v = paperView(paperFacts(1, { ...now, story }), opts);
    expect(v.notes[0]![1]).toContain('9 матчей и 20 голов');
    const legacy = paperView(paperFacts(1, { ...now, story: { ...emptyStory(), papers: { '1': { day: 3, shown: false } } } }), opts);
    expect(legacy.notes[0]![1]).toContain('31 матч');
    expect(numbersOf(now)).toEqual({ played: 31, goals: 70, fans: 9000, speed: 31, tasks: 0, tours: 0, title: false });
  });

  it('068-Т11-К1 (068-Р44): серебро выпуска 8 — в снимке «как вышел»: после выигранной переигровки архив остаётся серебряным', () => {
    // Ловит: архивный выпуск 8 в Музее, который после переигровки финала меняет «серебро» на «чемпион» (серебро читалось из текущего cup.title).
    const silverNow = { ...now, cup: { ...emptyCup(), title: 'silver' as const } };
    expect(numbersOf(silverNow).silver).toBe(true);
    expect(numbersOf({ ...now, cup: { ...emptyCup(), title: 'gold' as const } }).silver).toBe(false);
    expect('silver' in numbersOf(now)).toBe(false); // титула ещё нет — поля нет, выпуски 1–7 снимок без него
    const story = { ...emptyStory(), papers: { '8': { day: 20, shown: true, facts: fx({ silver: true }) } } };
    const goldNow = { ...now, story, cup: { ...emptyCup(), title: 'gold' as const } };
    const v = paperView(paperFacts(8, goldNow), opts);
    expect(v.head).toBe('Серебро Кубка: «Прогресс» вернётся за золотом');
    expect(v.deco).toBe('silver');
    // выпуск, вышедший чемпионским, не становится серебряным, если финал потом проиграли в повторе (не бывает, но снимок главнее)
    const gold = { ...story, papers: { '8': { day: 20, shown: true, facts: fx({ silver: false }) } } };
    expect(paperFacts(8, { ...silverNow, story: gold }).silver).toBe(false);
    // счёт финала — в снимке (068-Р56): после золотой переигровки (ko.f = 3:1) архив пишет прежний счёт серебра
    const ko = { ...emptyCup().ko, f: { tries: 2, won: true, me: 3, opp: 1, series: 'w' as const } };
    const snap = { ...story, papers: { '8': { day: 20, shown: true, facts: fx({ silver: true, final: { me: 1, opp: 3 } }) } } };
    const after = paperFacts(8, { ...goldNow, story: snap, cup: { ...goldNow.cup, ko } });
    expect(after.finalScore).toEqual({ me: 1, opp: 3 });
    const text = paperView(after, opts).notes.flat().join(' ');
    expect(text).toContain('победил — 3:1'); // формат {соперник}:{мы}: наш финал был 1:3
    expect(text).not.toContain('победил — 1:3'); // текущий ko.f (3:1 в нашу пользу) в архив не попадает
    expect(numbersOf({ ...goldNow, cup: { ...goldNow.cup, ko, title: 'silver' as const } }).final).toEqual({ me: 3, opp: 1 }); // с титулом счёт записывается
    expect('final' in numbersOf({ ...now, cup: { ...emptyCup(), ko } })).toBe(false); // титула нет — снимок без поля
    // снимок прежней записи (без поля) — серебро по текущему Кубку, как остальные числа
    const old = { ...story, papers: { '8': { day: 20, shown: true, facts: fx() } } };
    expect(paperFacts(8, { ...silverNow, story: old }).silver).toBe(true);
  });

  it('068-Т11-К7 (068-Р55): Стенгазета Дома после серебра и затем золота открывает выпуск 8 как архивный', () => {
    // Ловит: «Дальше: сыграть финал снова» на выпуске 8 у игрока, который уже взял золото.
    const paper = (facts?: PaperFixed) => ({ ...emptyStory(), papers: { '8': { day: 20, shown: true, ...(facts ? { facts } : {}) } } });
    const gold = { ...emptyCup(), title: 'gold' as const };
    const silver = { ...emptyCup(), title: 'silver' as const };
    expect(homePaperIsArchive(8, paper(fx({ silver: true })), gold)).toBe(true);
    expect(homePaperIsArchive(8, paper(fx({ silver: true })), silver)).toBe(false); // серебро ещё не побеждено — повтор финала актуален
    expect(homePaperIsArchive(8, paper(fx({ silver: false })), gold)).toBe(false); // вышел чемпионским
    expect(homePaperIsArchive(8, paper(fx()), gold)).toBe(false); // прежний снимок без поля
    expect(homePaperIsArchive(7, paper(fx({ silver: true })), gold)).toBe(false);
    expect(homePaperIsArchive(null, paper(fx({ silver: true })), gold)).toBe(false);
    // и в окне: без архива — «сыграть снова», с архивом — строка архива
    const f8 = paperFacts(8, { ...now, story: paper(fx({ silver: true })), cup: gold });
    expect(paperView(f8, { ...opts, archive: true }).next).not.toEqual(paperView(f8, opts).next);
  });

  it('068-Т11-К2 (068-Р44): проверка раздела — silver необязателен, булев проходит, нечисловой отвергается', () => {
    // Ловит: формат сохранения, который принимает мусор в silver или отвергает прежние выпуски без поля.
    const mk = (facts: unknown) => ({ ...emptyStory(), papers: { '8': { day: 20, shown: true, facts } } });
    expect(storyDef.check(mk(fx()))).toEqual([]);
    expect(storyDef.check(mk(fx({ silver: true })))).toEqual([]);
    expect(storyDef.check(mk(fx({ silver: false })))).toEqual([]);
    expect(storyDef.check(mk({ ...fx(), silver: 'да' }))).toContain('papers');
    expect(storyDef.check(mk(fx({ silver: true, final: { me: 1, opp: 3 } })))).toEqual([]);
    expect(storyDef.check(mk({ ...fx(), final: { me: 1 } }))).toContain('papers');
    expect(storyDef.check(mk({ ...fx(), final: { me: -1, opp: 3 } }))).toContain('papers');
  });

  it('068-Т7-К3: крупное «Знаток Двора!» — только в первом выпуске после звания (068-Р31)', () => {
    // Ловит: поздравление в каждом выпуске после звания или в самом свежем, а не в первом со званием.
    let s = releasePapers(emptyStory(), { cur: 22, cup: none, day: 7, facts: fx() });
    s = { ...s, papers: { ...s.papers, '7': { day: 9, shown: false, facts: fx({ title: true }) }, '8': { day: 10, shown: false, facts: fx({ title: true }) } } };
    expect(firstTitleIn(s, 6)).toBe(false);
    expect(firstTitleIn(s, 7)).toBe(true);
    expect(firstTitleIn(s, 8)).toBe(false);
    const f7 = paperFacts(7, { ...now, story: s });
    expect(paperView(f7, { ...opts, firstTitle: true }).rubric.big).toBe('Саша — Знаток Двора!');
    expect(paperView(f7, { ...opts, firstTitle: false }).rubric.big).toBe('');
    expect(paperView(f7, { ...opts, firstTitle: false }).rubric.text).toContain('Саша — Знаток Двора.');
  });

  it('068-Т7-К4: раздел с снимком проходит проверку, битый снимок — нет, старый выпуск без снимка — проходит', () => {
    // Ловит: принять в сохранение снимок с отрицательными числами или нечисловым званием (формат story свободен до выпуска, 060-Р7).
    const ok = releasePapers(emptyStory(), { cur: 6, cup: none, day: 3, facts: fx() });
    expect(storyDef.check(ok)).toEqual([]);
    expect(storyDef.check({ ...ok, papers: { '1': { day: 3, shown: true, facts: fx({ goals: -1 }) } } })).toContain('papers');
    expect(storyDef.check({ ...ok, papers: { '1': { day: 3, shown: true, facts: { ...fx(), title: 'да' } } } })).toContain('papers');
    expect(storyDef.check({ ...ok, papers: { '1': { day: 3, shown: true } } })).toEqual([]);
  });

  it('068-Т7-К5: вход на Дом «только выпуски» — комикс не занимает очередь и не помечается, выпуск открыт со снимком, повтор — окон нет', () => {
    // Ловит: потерянный комикс (помечен показанным, а окна нет) и выпуск, застрявший за комиксом, который Дом пока не рисует.
    const a = enterHome(emptyStory(), { cur: 6, cup: none, day: 3, facts: fx(), paperOnly: true });
    expect(a.window).toEqual({ kind: 'paper', n: 1 });
    expect(a.story.comics).toEqual({});
    expect(a.story.papers['1']).toEqual({ day: 3, shown: true, facts: fx() });
    expect(enterHome(a.story, { cur: 6, cup: none, day: 3, facts: fx(), paperOnly: true }).window).toBeNull();
  });
});

describe('комиксы Двора на Доме (068 Т7-3)', () => {
  const sections = { story: emptyStory(), cup: emptyCup(), school: { knower: 0, grade: null, tours: [], emblem: 0, solved: [], level: {}, trainerSkip: [] }, stadium: { fans: 9, goals: 7 }, day: emptyDay(), course: { current: '', lessons: {}, archive: {}, leaguesDone: {} }, seed: 1 };
  const ask = { off: false, done: false, status: 'ok', pid: 'p1', input: { cur: 6, day: 3 }, sections: () => sections };

  it('068-Т7-К6: вход на Дом без paperOnly — первым идёт комикс «Завязка», помечается показанным, выпуск ждёт следующего входа', () => {
    // Ловит: возврат к paperOnly (комикс теряется) или комикс, не помеченный при открытии (повтор после перезагрузки).
    const got = entryCtxOf(ask)!;
    expect(got.ctx.paperOnly).toBeUndefined();
    const a = enterHome(emptyStory(), { ...got.ctx, cup: none });
    expect(a.window).toEqual({ kind: 'comic', id: 'intro' });
    expect(a.story.comics.intro).toBe(3);
    expect(a.story.papers['1']?.shown).toBe(false);
    expect(enterHome(a.story, { ...got.ctx, cup: none }).window).toEqual({ kind: 'paper', n: 1 });
  });

  it('068-Т7-К6 условия входа: стенд, повторный вход, вторая вкладка, нет игрока или входа правил — вход не считается; иначе числа клуба идут в выпуски', () => {
    // Ловит: выпуск, вышедший без снимка чисел (facts), и вход, который пишет из второй вкладки или на стенде кадров.
    expect(entryCtxOf({ ...ask, off: true })).toBeNull();
    expect(entryCtxOf({ ...ask, done: true })).toBeNull();
    expect(entryCtxOf({ ...ask, status: 'busy' })).toBeNull();
    expect(entryCtxOf({ ...ask, pid: undefined })).toBeNull();
    expect(entryCtxOf({ ...ask, input: null })).toBeNull();
    const got = entryCtxOf(ask)!;
    expect(got.ctx).toMatchObject({ cur: 6, day: 3, facts: { fans: 9, goals: 7, played: 0 } });
  });

  it('068-Т7-К6 Знаток: подключение «Знаток Двора!» — крупно только в первом выпуске со званием (через newsViewOf)', () => {
    // Ловит: firstTitle не доходит до вида выпуска (мутация `firstTitle: false` раньше выживала, 068-Р45).
    const fx: PaperFixed = { played: 9, goals: 20, fans: 2680, speed: 14, tasks: 9, tours: 1, title: true };
    const story = { ...emptyStory(), papers: { '6': { day: 7, shown: true, facts: fx }, '7': { day: 9, shown: false, facts: fx } } };
    const who = { club: 'Прогресс', city: 'Тверь', player: 'Саша', coach: 'Макс', lessonName: (n: number) => `урок-${n}` };
    const s = { ...sections, story };
    expect(newsViewOf(6, s, who).rubric.big).toBe('Саша — Знаток Двора!');
    expect(newsViewOf(7, s, who).rubric.big).toBe('');
    expect(newsViewOf(6, s, who, true).next).toContain('архива');
  });

  it('068-Т7-К6 окно: Enter и → листают панели и закрывают на последней, Esc — сразу; Enter раньше паузы и при удержании молчит', () => {
    // Ловит: двойной Enter, пролетающий оба окна, и комикс, который не закрывается с клавиатуры.
    const k = (key: string, shown: number, o: Partial<{ repeat: boolean; now: number }> = {}) => comicKey({ key, repeat: false, openedAt: 1000, now: 1000 + ENTER_DELAY + 1, shown, ...o });
    expect(k('Enter', 1)).toBe('next');
    expect(k('ArrowRight', 1, { now: 1001 })).toBe('next');
    expect(k('Enter', PANELS)).toBe('close');
    expect(k('Escape', 1, { now: 1001 })).toBe('close');
    expect(k('Enter', 1, { now: 1000 + ENTER_DELAY - 1 })).toBeNull();
    expect(k('Enter', 1, { repeat: true })).toBeNull();
    expect(k('ArrowRight', 1, { repeat: true })).toBeNull();
    expect(k('a', 1)).toBeNull();
  });

  it('068-Т7-К6 вид: две панели у каждого комикса, печать «САША 7» — из клуба, табло группы — из модели Кубка', () => {
    // Ловит: третья панель (068-Р27), печать с чужим именем и табло, где нашей строки нет.
    const cup = emptyCup();
    const g = cupView(cup, { cur: 19, day: '2026-11-18', dayN: 5, pause5: false, seed: seedOf('p1') }).groups.find((x) => x.our)!;
    const who = { club: 'Прогресс', backName: 'Саша', backNumber: 7, group: g };
    for (const id of ['intro', 'group', 'final', 'silver'] as const) expect(comicView(id, who).panels).toHaveLength(2);
    expect(comicView('intro', who).print).toEqual({ name: 'САША', num: 7 });
    const board = groupBoard(g, 'Прогресс');
    expect(board.rows.filter((r) => r.our).map((r) => r.name)).toEqual(['Прогресс']);
    expect(board.rows).toHaveLength(groupTable('C', 0, [], 1).length);
    expect(comicView('group', who).panels[0].table).toEqual(board);
    expect(comicView('group', { ...who, group: null }).panels[0].table).toBeUndefined();
  });
});
