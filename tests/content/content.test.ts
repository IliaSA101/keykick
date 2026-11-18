/**
 * Схемы контента курса (060-Т2, К5, К6): раскладки, course.json, каркас лиг, тексты курса.
 * Проверяются все файлы курса `ru` и пробный `en`; схемы ловят порчу (испорченные копии).
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import goldenJcuken from '../golden/layouts/jcuken-win.json';
import goldenQwerty from '../golden/layouts/qwerty-win.json';
import jcuken from '../../src/content/layouts/jcuken-win.json';
import qwerty from '../../src/content/layouts/qwerty-win.json';
import ruCourse from '../../src/content/courses/ru/course.json';
import ruLeagues from '../../src/content/courses/ru/leagues.json';
import ruText from '../../src/content/courses/ru/text/ru.json';
import yardManifest from '../../src/content/packs/ru.yard/pack.json';
import yardLessons from '../../src/content/packs/ru.yard/lessons.json';
import yardText from '../../src/content/packs/ru.yard/text.ru.json';
import enCourse from '../fixtures/courses/en/course.json';
import enLeagues from '../fixtures/courses/en/leagues.json';
import enText from '../fixtures/courses/en/text/en.json';
import enLessons from '../fixtures/courses/en/packs/en.yard/lessons.json';
import * as layoutSchema from '../../src/content/schema/layout';
import * as courseSchema from '../../src/content/schema/course';
import * as leaguesSchema from '../../src/content/schema/leagues';
import * as textSchema from '../../src/content/schema/text';
import type { Course, Layout, LeagueFrame, Pack } from '../../src/content/schema';
import { parseLessons } from '../../src/engine/plan/parseLessons';
import { keymap } from '../../src/engine/typing/layouts';
import { checkManifest, checkPack, fits } from '../../src/engine/packs/manifest';

const copy = <T>(x: T): T => structuredClone(x);
const layouts: Record<string, unknown> = { 'jcuken-win': jcuken, 'qwerty-win': qwerty };

interface GoldenKey { code: string; row: number; finger: string; ch?: string[]; bump?: boolean; width?: number; label?: string }
interface Golden { id: string; rows: GoldenKey[][] }

/** Расхождения раскладки с голденом: ряды по порядку, у каждой клавиши знаки, палец, засечка, ширина, подпись. Пусто — совпала. */
function diffGolden(layout: { id?: string; rows: string[][]; keys: Record<string, unknown> }, golden: Golden): string[] {
  const errs: string[] = [];
  if (layout.id !== golden.id) errs.push(`id ${String(layout.id)} ≠ ${golden.id}`);
  if (JSON.stringify(layout.rows) !== JSON.stringify(golden.rows.map((r) => r.map((k) => k.code)))) errs.push('ряды не совпали');
  const want = golden.rows.flat();
  if (Object.keys(layout.keys).length !== want.length) errs.push('число клавиш');
  for (const k of want) {
    const got = layout.keys[k.code] as GoldenKey | undefined;
    if (!got) {
      errs.push(`${k.code}: нет клавиши`);
      continue;
    }
    for (const f of ['ch', 'finger', 'row', 'bump', 'width', 'label'] as const) {
      if (JSON.stringify(got[f]) !== JSON.stringify(k[f])) errs.push(`${k.code}.${f}`);
    }
  }
  return errs;
}

/** Курс целиком: связи между файлами (раскладка есть, лиги и тексты на месте). Пусто — годен. */
function checkCourseSet(course: Course, frames: LeagueFrame[], text: { leagues: object; cups: object }): string[] {
  const errs: string[] = [];
  if (!(course.layout in layouts)) errs.push(`раскладки ${course.layout} нет`);
  if (course.leagues.join() !== frames.map((f) => f.id).join()) errs.push('course.leagues не совпадает с каркасом лиг');
  for (const f of frames) {
    if (!(f.id in text.leagues)) errs.push(`нет текста лиги ${f.id}`);
    if (!(f.cup in text.cups)) errs.push(`нет названия кубка ${f.cup}`);
    if (f.pack !== null && !f.pack.startsWith(`${course.id}.`)) errs.push(`пакет ${f.pack} — не этого курса`);
  }
  return errs;
}

describe('раскладки', () => {
  it('jcuken-win и qwerty-win годны', () => {
    expect(layoutSchema.check(jcuken)).toEqual([]);
    expect(layoutSchema.check(qwerty)).toEqual([]);
  });

  it('знаки, пальцы, засечки, ширины, подписи и ряды совпадают с голденом (снят с keyboard.json)', () => {
    expect(diffGolden(jcuken, goldenJcuken)).toEqual([]);
    expect(diffGolden(qwerty, goldenQwerty)).toEqual([]);
  });

  // Ловит: голден сверяет всё, что сверял keyboard.json, — порча любого поля одной клавиши или порядка рядов не проходит.
  it('сверка с голденом видит порчу знака, пальца, засечки, ширины, подписи, ряда и состава', () => {
    const bad = (mutate: (l: { rows: string[][]; keys: Record<string, Record<string, unknown>> }) => void): string[] => {
      const l = copy(jcuken) as unknown as { rows: string[][]; keys: Record<string, Record<string, unknown>> };
      mutate(l);
      return diffGolden(l, goldenJcuken);
    };
    expect(bad(() => undefined)).toEqual([]);
    expect(bad((l) => (l.keys.KeyA!.ch = ['ф', 'Ы']))).not.toEqual([]);
    expect(bad((l) => (l.keys.KeyA!.finger = 'lr'))).not.toEqual([]);
    expect(bad((l) => delete l.keys.KeyF!.bump)).not.toEqual([]);
    expect(bad((l) => (l.keys.KeyA!.bump = true))).not.toEqual([]);
    expect(bad((l) => (l.keys.Backspace!.width = 1))).not.toEqual([]);
    expect(bad((l) => (l.keys.Enter!.label = 'Ввод'))).not.toEqual([]);
    expect(bad((l) => (l.keys.KeyA!.row = 3))).not.toEqual([]);
    expect(bad((l) => l.rows[1]!.reverse())).not.toEqual([]);
    expect(bad((l) => delete l.keys.Tab)).not.toEqual([]);
    expect(diffGolden(qwerty, goldenJcuken)).not.toEqual([]);
  });

  it('на домашнем ряду: А и О на засечках у ru, F и J у en', () => {
    expect(jcuken.keys.KeyF.ch).toEqual(['а', 'А']);
    expect(jcuken.keys.KeyF.bump).toBe(true);
    expect(qwerty.keys.KeyJ.ch).toEqual(['j', 'J']);
    expect(qwerty.keys.KeyJ.bump).toBe(true);
  });

  it('ловит порчу: лишний, пропавший и двойной знак, чужой палец и ряд', () => {
    const bad = (mutate: (l: Layout) => void): string[] => {
      const l = copy(jcuken) as unknown as Layout;
      mutate(l);
      return layoutSchema.check(l);
    };
    expect(bad(() => undefined)).toEqual([]);
    expect(bad((l) => delete l.keys.KeyA)).not.toEqual([]); // клавиша из rows без описания
    expect(bad((l) => (l.keys.Ghost = { finger: 'li', row: 0, ch: ['x', 'X'] }))).not.toEqual([]); // нет в rows
    expect(bad((l) => ((l.keys.KeyA as { finger: string }).finger = 'xx'))).not.toEqual([]);
    expect(bad((l) => ((l.keys.KeyA as { row: number }).row = 3))).not.toEqual([]);
    expect(bad((l) => (l.keys.KeyA = { finger: 'lp', row: 2 }))).not.toEqual([]); // ни ch, ни label
    expect(bad((l) => (l.keys.KeyA = { finger: 'lp', row: 2, ch: ['аб', 'А'] }))).not.toEqual([]);
    expect(bad((l) => ((l.keys.KeyS as unknown as { ch: [string, string] }).ch = ['а', 'А']))).not.toEqual([]); // знак на двух клавишах
    expect(bad((l) => l.rows[2]?.push('KeyA'))).not.toEqual([]); // клавиша в двух местах
    expect(bad((l) => (l.rows = []))).not.toEqual([]);
    expect(bad((l) => ((l as { os: string }).os = 'mac'))).not.toEqual([]);
    expect(layoutSchema.check(null)).not.toEqual([]);
    expect(layoutSchema.check('x')).not.toEqual([]);
  });
});

describe('курс ru', () => {
  const course: Course = ruCourse;
  const frames = ruLeagues as LeagueFrame[];

  it('course.json, каркас и тексты годны, связи сходятся', () => {
    expect(courseSchema.check(course)).toEqual([]);
    expect(leaguesSchema.check(frames)).toEqual([]);
    expect(textSchema.check(ruText)).toEqual([]);
    expect(checkCourseSet(course, frames, ruText)).toEqual([]);
  });

  it('К6: шесть лиг, сумма уроков 200, Двор — 32 и единственный готовый', () => {
    expect(frames.map((f) => f.id)).toEqual(['yard', 'district', 'city', 'country', 'europe', 'world']);
    expect(frames.reduce((s, f) => s + f.lessons, 0)).toBe(200);
    expect(frames[0]).toMatchObject({ id: 'yard', lessons: 32, status: 'ready', pack: 'ru.yard' });
    expect(frames.filter((f) => f.status === 'ready').map((f) => f.id)).toEqual(['yard']);
    expect(frames.slice(1).every((f) => f.status === 'building' && f.pack === null)).toBe(true);
  });

  it('числа уроков по лигам — те же, что были в прежнем каркасе (leagues.json до 060-Т9а)', () => {
    expect(frames.map((f) => [f.id, f.lessons])).toEqual([['yard', 32], ['district', 36], ['city', 30], ['country', 32], ['europe', 40], ['world', 30]]);
  });

  it('курс ru: раскладка jcuken-win, объяснение по-русски', () => {
    expect(course).toMatchObject({ id: 'ru', layout: 'jcuken-win', explain: ['ru'] });
  });

  it('ловит порчу: курс, каркас, тексты', () => {
    const bad = <T>(x: T, f: (c: T) => void, check: (x: unknown) => string[]): string[] => {
      const c = copy(x);
      f(c);
      return check(c);
    };
    // курс
    expect(bad(course, (c) => (c.explain = []), courseSchema.check)).not.toEqual([]);
    expect(bad(course, (c) => (c.leagues = ['yard', 'yard']), courseSchema.check)).not.toEqual([]);
    expect(bad(course, (c) => (c.layout = 'Жук'), courseSchema.check)).not.toEqual([]);
    expect(bad(course, (c) => ((c as { id: unknown }).id = 7), courseSchema.check)).not.toEqual([]);
    expect(checkCourseSet({ ...course, layout: 'dvorak-win' }, frames, ruText)).not.toEqual([]);
    expect(checkCourseSet({ ...course, leagues: ['city', 'yard'] }, frames, ruText)).not.toEqual([]);
    // каркас
    expect(bad(frames, (f) => ((f[0] as { lessons: unknown }).lessons = 0), leaguesSchema.check)).not.toEqual([]);
    expect(bad(frames, (f) => ((f[0] as { lessons: unknown }).lessons = 3.5), leaguesSchema.check)).not.toEqual([]);
    expect(bad(frames, (f) => ((f[1] as { status: string }).status = 'done'), leaguesSchema.check)).not.toEqual([]);
    expect(bad(frames, (f) => ((f[0] as { pack: unknown }).pack = null), leaguesSchema.check)).not.toEqual([]); // готовая без пакета
    expect(bad(frames, (f) => ((f[1] as { pack: unknown }).pack = 'ru.district'), leaguesSchema.check)).not.toEqual([]); // строится, а пакет есть
    expect(bad(frames, (f) => ((f[2] as { id: string }).id = 'yard'), leaguesSchema.check)).not.toEqual([]);
    expect(bad(frames, (f) => ((f[2] as { cup: string }).cup = 'cup-yard'), leaguesSchema.check)).not.toEqual([]);
    expect(bad(frames, (f) => ((f[2] as { layer: string }).layer = 'left'), leaguesSchema.check)).not.toEqual([]);
    expect(bad(frames, (f) => f.splice(0), leaguesSchema.check)).not.toEqual([]);
    expect(checkCourseSet(course, frames.map((f) => (f.id === 'world' ? { ...f, cup: 'cup-mars' } : f)), ruText)).not.toEqual([]);
    expect(checkCourseSet(course, frames.map((f) => (f.id === 'yard' ? { ...f, pack: 'en.yard' } : f)), ruText)).not.toEqual([]);
    // тексты
    const noCity = copy(ruText);
    delete (noCity.leagues as Record<string, unknown>).city;
    expect(textSchema.check(noCity)).toEqual([]); // сам файл годен, пропажу ловит проверка набора
    expect(checkCourseSet(course, frames, noCity)).not.toEqual([]);
    expect(bad(ruText, (t) => (t.leagues.yard.name = ' '), textSchema.check)).not.toEqual([]);
    expect(bad(ruText, (t) => ((t.cups as Record<string, unknown>)['cup-yard'] = 5), textSchema.check)).not.toEqual([]);
    expect(bad(ruText, (t) => ((t as { cups: unknown }).cups = []), textSchema.check)).not.toEqual([]);
  });
});

describe('пробный курс en (в сборку не идёт, 060-Р9)', () => {
  it('файлы годны и сходятся: раскладка qwerty-win, 2 урока', () => {
    const course: Course = enCourse;
    const frames = enLeagues as LeagueFrame[];
    expect(courseSchema.check(course)).toEqual([]);
    expect(leaguesSchema.check(frames)).toEqual([]);
    expect(textSchema.check(enText)).toEqual([]);
    expect(checkCourseSet(course, frames, enText)).toEqual([]);
    expect(course.layout).toBe('qwerty-win');
    expect(frames.reduce((s, f) => s + f.lessons, 0)).toBe(2);
    expect(enLessons.order.length).toBe(2);
  });

  it('клавиши уроков en есть в раскладке qwerty-win', () => {
    for (const id of enLessons.order) {
      const keys = (enLessons.lessons as Record<string, { keys: string }>)[id]?.keys ?? '';
      expect(keys, id).not.toBe('');
      for (const ch of keys) {
        const has = Object.values(qwerty.keys).some((k) => (k as { ch?: string[] }).ch?.[0] === ch);
        expect(has, `${id}: ${ch}`).toBe(true);
      }
    }
  });

  it('пробного курса нет в src/content — в сборку он не попадает', () => {
    expect(existsSync(new URL('../../src/content/courses/en', import.meta.url))).toBe(false);
  });
});

describe('пакет ru.yard (060-Т4а)', () => {
  const pack = (): Pack => copy({ manifest: yardManifest, lessons: yardLessons, text: { ru: yardText } }) as unknown as Pack;

  it('настоящий пакет годен: манифест, уроки, тексты; 32 урока, id — по лиге, каркас указывает на него', () => {
    // Ловит: испорченный pack.json, урок без текста или текст без урока, id вне пакета, каркас без ссылки на пакет Двора.
    expect(checkManifest(yardManifest)).toEqual([]);
    expect(checkPack(pack())).toEqual([]);
    expect(yardLessons.order).toHaveLength(32);
    expect(yardLessons.order.every((id) => id.startsWith('ru.yard.'))).toBe(true);
    const frame = (ruLeagues as LeagueFrame[]).find((f) => f.id === 'yard');
    expect(frame?.pack).toBe(yardManifest.id);
    expect(yardManifest).toMatchObject({ id: 'ru.yard', course: ruCourse.id, league: 'yard', access: 'public', rev: 1, shellApi: 1 });
  });

  it('тексты отдельно: в файле уроков нет name и tip, а у каждого урока и ступени текст есть', () => {
    // Ловит: тексты, вернувшиеся в файл чисел (тогда перевод и правка текста трогали бы числа), и урок без названия.
    for (const l of Object.values(yardLessons.lessons)) expect(l).not.toHaveProperty('name');
    for (const l of Object.values(yardLessons.lessons)) expect(l).not.toHaveProperty('tip');
    expect(Object.keys(yardText.lessons)).toEqual(yardLessons.order);
    expect(Object.keys(yardText.stages)).toEqual(yardLessons.stages.map((s) => String(s.n)));
  });

  it('checkManifest: каждая поломка манифеста — замечание', () => {
    // Ловит: манифест, который загрузчик принял бы за годный: чужой id, ревизия 0, дробный shellApi, путь наверх, пустые тексты.
    const bad = (change: (m: Record<string, unknown>) => void): string[] => {
      const m = copy(yardManifest) as unknown as Record<string, unknown>;
      change(m);
      return checkManifest(m);
    };
    expect(checkManifest(null)).not.toEqual([]);
    expect(bad((m) => { m.id = 'ru.city'; })).not.toEqual([]); // id не сходится с курсом и лигой
    expect(bad((m) => { m.id = 'Ru.yard'; })).not.toEqual([]);
    expect(bad((m) => { m.access = 'secret'; })).not.toEqual([]);
    expect(bad((m) => { m.rev = 0; })).not.toEqual([]);
    expect(bad((m) => { m.rev = 1.5; })).not.toEqual([]);
    expect(bad((m) => { m.shellApi = '1.0.0'; })).not.toEqual([]); // semver не принимаем (060-Р5)
    expect(bad((m) => { m.shellApi = 0; })).not.toEqual([]);
    expect(bad((m) => { (m.files as { lessons: string }).lessons = '../lessons.json'; })).not.toEqual([]);
    expect(bad((m) => { (m.files as { lessons: string }).lessons = '/etc/passwd'; })).not.toEqual([]);
    expect(bad((m) => { (m.files as { text: object }).text = {}; })).not.toEqual([]);
    expect(bad((m) => { delete m.files; })).not.toEqual([]);
    expect(bad((m) => { m.access = 'closed'; })).toEqual([]); // закрытый пакет — тоже годный манифест
  });

  it('fits: пакету хватает оболочки, если её shellApi не меньше нужного (целые, 060-Р5)', () => {
    // Ловит: сравнение наоборот (пакет нового мира грузится в старую оболочку), дроби и мусор вместо целых.
    expect(fits({ shellApi: 1 }, 1)).toBe(true);
    expect(fits({ shellApi: 1 }, 3)).toBe(true);
    expect(fits({ shellApi: 2 }, 1)).toBe(false);
    expect(fits({ shellApi: 1.5 }, 2)).toBe(false);
    expect(fits({ shellApi: 1 }, 1.5)).toBe(false);
    expect(fits({ shellApi: 0 }, 1)).toBe(false);
  });

  it('checkPack: урок без текста, лишний текст, чужой id, тексты в файле чисел, нет файла языка — замечания', () => {
    // Ловит: пакет, у которого файлы разошлись: игра показала бы урок без названия или упала на лишнем тексте.
    const broken = (change: (p: Pack) => void): string => {
      const p = pack();
      change(p);
      return checkPack(p).join('\n');
    };
    expect(broken((p) => { delete p.text.ru!.lessons[p.lessons.order[3]!]; })).toContain('нет текстов');
    expect(broken((p) => { p.text.ru!.lessons['ru.yard.extra'] = { name: 'x', tip: 'y' }; })).toContain('лишний текст');
    expect(broken((p) => { p.text.ru!.lessons[p.lessons.order[0]!]!.name = ' '; })).toContain('name: пусто');
    expect(broken((p) => { p.text.ru!.stages = {}; })).toContain('нет названия ступени');
    expect(broken((p) => { p.lessons.order[2] = 'ru.city.vl'; })).toContain('вне пакета');
    expect(broken((p) => { p.lessons.order.push(p.lessons.order[0]!); })).toContain('повторяется');
    expect(broken((p) => { delete p.lessons.lessons[p.lessons.order[5]!]; })).toContain('нет урока');
    expect(broken((p) => { (p.lessons.lessons[p.lessons.order[0]!] as unknown as Record<string, unknown>).name = 'А'; })).toContain('тексты');
    expect(broken((p) => { p.text = {}; })).toContain('no text file');
    expect(broken((p) => { p.manifest.rev = 0; })).toContain('manifest');
  });

  it('parseLessons: числа из пакета, имена и советы из текстов, порядок — order', () => {
    // Ловит: разбор, потерявший имя или совет урока, сбивший порядок или не принявший текст другого языка за ошибку.
    const ctx = { lang: 'ru', layout: 'jcuken-win', keymap, league: 'yard', lessons: 32 };
    const lessons = parseLessons(pack(), ctx);
    expect(lessons.map((l) => l.id)).toEqual(yardLessons.order);
    expect(lessons[0]).toMatchObject({ id: 'ru.yard.ao', league: 'yard', name: yardText.lessons['ru.yard.ao'].name, attacks: [16, 18, 20, 22], layout: 'jcuken-win' });
    expect(lessons[0]!.tips).toEqual([yardText.lessons['ru.yard.ao'].tip].flat());
    expect(() => parseLessons(pack(), { ...ctx, lang: 'en' })).toThrow(/no text/);
  });
});
