/**
 * Разделы сохранения v2 (спека 018-Т1): общий блок по реестру — каждый раздел, добавленный подсистемой,
 * проверяется сам; бюджет конверта; помощники разбора. Блок «разделы Э1» дописывает Т8; касса и «Школа» — в `wallet.test.ts` и `school.test.ts`.
 * Отдельный файл: другая подготовка (реестр, каталог, семя).
 * Ловит у каждого теста — строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { registry } from '../src/app/save/registry';
import { courseLessons, leagues } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import { createRandom } from '../src/engine/random';
import { SAVE_DRAFT, SAVE_FORMAT, fullSample } from '../src/engine/save/format';
import { emptyClub } from '../src/engine/club/create';
import { section as clubSection } from '../src/engine/club/save';
import { section as courseSection } from '../src/engine/course/save';
import { formFingers, section as matchSection } from '../src/engine/match/save';
import { TASK_NO_MAX } from '../src/engine/tasks';
import {
  ENVELOPE_MAX_BYTES,
  SECTION_PLAN,
  defineSection,
  int,
  permille,
  time,
  type Catalog,
  type SectionDef,
} from '../src/engine/save/section';
import { assertFull, compareReleased, probe } from './saveFixtures';

/** Каталог из настоящего контента; `taskNoMax` — потолок номера задачи (`TASK_NO_MAX`, 018 design §3.2). */
const cat: Catalog = {
  lessonIds: courseLessons.map((l) => l.id),
  leagueIds: leagues.map((l) => l.id),
  keyCodes: [...keymap.byCode.keys()],
  taskNoMax: TASK_NO_MAX,
};

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Мусорные входы: фиксированные края и случайные от семени (повторяемо). */
function garbage(): unknown[] {
  const rnd = createRandom(20251108);
  const fixed: unknown[] = [null, undefined, [], {}, 'x', 0, -1, 1e9, NaN, Infinity, -Infinity, 3.7, true, [1, 'a', null], { a: { b: [] } }];
  const junk = (depth: number): unknown => {
    const r = rnd();
    if (depth > 2 || r < 0.3) return [null, 'x', -1, 1e9, NaN, 3.7, true, '', 0][Math.floor(rnd() * 9)];
    if (r < 0.6) return Array.from({ length: Math.floor(rnd() * 3) }, () => junk(depth + 1));
    return Object.fromEntries(Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => [`k${i}`, junk(depth + 1)]));
  };
  return [...fixed, ...Array.from({ length: 15 }, () => junk(0))];
}

/** Нецелые числа на любой глубине (инвариант «числа v2 целые», 018-Р5). */
function fractions(v: unknown, path = ''): string[] {
  if (typeof v === 'number') return Number.isInteger(v) ? [] : [`${path}: ${v}`];
  if (Array.isArray(v)) return v.flatMap((x, i) => fractions(x, `${path}[${i}]`));
  if (v !== null && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => fractions(x, `${path}.${k}`));
  return [];
}

/** Бюджет по JSON всего конверта (`format/draft/rev/app` и имена ключей, 018-Р18), а не суммой разделов; подпись — размеры разделов. */
function budget(defs: readonly SectionDef[]): { total: number; by: string } {
  const sections = Object.fromEntries(defs.map((d) => [d.name, d.maxSample(cat)]));
  const sizes = defs.map((d) => [d.name, JSON.stringify(d.maxSample(cat)).length] as const);
  const envelope = { format: SAVE_FORMAT, draft: SAVE_DRAFT, rev: 999_999, app: '999.999.999', sections };
  return { total: JSON.stringify(envelope).length, by: sizes.map(([n, b]) => `${n} ${b} Б`).join(', ') };
}

describe('реестр разделов (018 design §1)', () => {
  // Ловит: раздел назван не по плану (опечатка, чужое имя) или имя повторено — второй затрёт первый в конверте.
  it('имена уникальны и из SECTION_PLAN', () => {
    const names = registry.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => !SECTION_PLAN.includes(n))).toEqual([]);
  });

  // Ловит: раздел вне папки своей подсистемы (имя ≠ папка engine/<имя>/save.ts).
  it('имя раздела = папка подсистемы', () => {
    const files = import.meta.glob<{ section?: SectionDef }>('../src/engine/*/save.ts', { eager: true });
    for (const [path, mod] of Object.entries(files)) {
      expect(mod.section?.name, path).toBe(/engine\/([a-z]+)\/save\.ts$/.exec(path)?.[1]);
    }
  });

  // Ловит: у раздела нет владельца — в Э2–Э6 непонятно, чья это форма.
  it('у каждого раздела есть владелец', () => {
    expect(registry.filter((d) => d.owner === '')).toEqual([]);
  });
});

describe('общий блок: каждый раздел реестра', () => {
  for (const def of registry) {
    describe(def.name, () => {
      // Ловит: образец с пустотами — форма новых полей не попадёт в голден (Б1).
      it('образец полный', () => {
        expect(() => assertFull(def.sample(), def.name)).not.toThrow();
      });

      // Ловит: parse портит пустой, образцовый и потолочный разделы (потеря полей, смена значений).
      it('parse не меняет empty, sample и maxSample', () => {
        expect(def.parse(json(def.empty({})), {})).toEqual(def.empty({}));
        expect(def.parse(json(def.sample()), {})).toEqual(def.sample());
        expect(def.parse(json(def.maxSample(cat)), {})).toEqual(def.maxSample(cat));
      });

      // Ловит: мусор роняет разбор, ломает инвариант раздела или оставляет дробь там, где числа целые.
      it('30 мусорных входов: не бросает, check пуст, числа целые', () => {
        const inputs = garbage();
        expect(inputs).toHaveLength(30);
        for (const g of inputs) {
          const parsed = def.parse(g, {});
          expect(def.check(parsed, cat), JSON.stringify(g)).toEqual([]);
          expect(fractions(parsed), JSON.stringify(g)).toEqual([]);
        }
      });
    });
  }
});

describe('сам общий блок: обратные случаи', () => {
  // Ловит: проверка «образец полный» стала пропускать пустоты (null, [], {} на любой глубине).
  it('assertFull краснеет с путём на null, [] и {}', () => {
    expect(() => assertFull({ a: { b: {} } })).toThrow('a.b: {}');
    expect(() => assertFull({ a: [null] })).toThrow('a[0]: null');
    expect(() => assertFull({ a: [] })).toThrow('a: []');
    expect(() => assertFull({ a: [{ b: 1 }], c: 'x' })).not.toThrow();
  });

  // Ловит: раздел с нецелым числом проходит инвариант «числа v2 целые».
  it('нецелые числа находятся с путём', () => {
    expect(fractions({ a: [1, { b: 0.5 }] })).toEqual(['.a[1].b: 0.5']);
  });
});

describe('бюджет конверта (018-Р13, В2)', () => {
  // Ловит: разделы на потолках вместе не влезают в 40 КБ — копии не уложатся в квоту.
  it('все разделы на maxSample ≤ ENVELOPE_MAX_BYTES', () => {
    const { total, by } = budget(registry);
    expect(total, by).toBeLessThanOrEqual(ENVELOPE_MAX_BYTES);
  });

  // Ловит: проверка бюджета ничего не ловит — раздел сверх бюджета обязан краснить сумму, а сообщение — называть раздел.
  it('раздел сверх бюджета виден в сумме и в подписи', () => {
    const fat = defineSection({
      name: 'fat',
      owner: '000',
      parse: (raw) => raw as string,
      empty: () => '',
      sample: () => 'x',
      maxSample: () => 'x'.repeat(ENVELOPE_MAX_BYTES),
      counters: () => ({}),
      check: () => [],
    });
    const { total, by } = budget([fat]);
    expect(total).toBeGreaterThan(ENVELOPE_MAX_BYTES);
    expect(budget([{ ...fat, maxSample: () => 'x' }]).total).toBeLessThan(ENVELOPE_MAX_BYTES);
    expect(ENVELOPE_MAX_BYTES).toBe(40_960);
    expect(by).toContain('fat');
  });
});

describe('помощники разбора (018 design §1)', () => {
  // Ловит: int пропускает дробь, NaN или выход за границы.
  it('int: не число, NaN, дробь, границы', () => {
    expect(int('7', 2, 9)).toBe(2);
    expect(int(NaN, 0, 9)).toBe(0);
    expect(int(3.7, 0, 9)).toBe(3);
    expect(int(-1, 0, 9)).toBe(0);
    expect(int(1e9, 0, 9)).toBe(9);
    expect(int(Infinity, 0, 9)).toBe(9);
  });

  // Ловит: время зажато как count() до 1e6 — дата уехала бы в 1970 («Капитан вернулся!» после каждого матча).
  it('time: настоящие миллисекунды не зажимаются до 1e6', () => {
    expect(time(1_800_000_000_000)).toBe(1_800_000_000_000);
    expect(time(-5)).toBe(0);
    expect(time(1e20)).toBe(8.64e15);
  });

  // Ловит: доля в тысячных считается дробью, а не целым; деление на ноль даёт NaN.
  it('permille: floor, нулевой знаменатель', () => {
    expect(permille(97, 100)).toBe(970);
    expect(permille(1, 3)).toBe(333);
    expect(permille(5, 0)).toBe(0);
    expect(permille(-1, 10)).toBe(0);
  });
});

describe('разделы Э1: club, course, match (018-Т8)', () => {
  const sizeOf = (d: SectionDef): number => JSON.stringify(d.maxSample(cat)).length;

  // Ловит: раздел Э1 пропал из реестра (файл save.ts не найден маской) или образец конверта не из реестра (018-Р18).
  it('в реестре club, course, match; fullSample(реестр) — ровно их имена', () => {
    const names = registry.map((d) => d.name);
    for (const n of ['club', 'course', 'match']) expect(names).toContain(n);
    expect(Object.keys(fullSample(registry).sections).sort()).toEqual([...names].sort());
  });

  // Ловит: Э1 не влез в бюджет или раздел раздулся сверх замера design §3.4 (course ≈ 19 КБ, match ≈ 7 КБ, club < 1 КБ).
  it('размеры разделов на потолках в рамках замера и конверт ≤ 40 КБ', () => {
    expect(sizeOf(courseSection)).toBeLessThan(24_000);
    expect(sizeOf(matchSection)).toBeLessThan(14_000);
    expect(sizeOf(clubSection)).toBeLessThan(1_000);
    const { total, by } = budget(registry);
    expect(total, by).toBeLessThanOrEqual(ENVELOPE_MAX_BYTES);
  });

  // Ловит: «клуб есть» вывелся из имени, а не из createdAt; мусорная дата стирает клуб (019 design §2, В2).
  it('club: createdAt «x» при живом имени → 1; пустое и ноль — клуба нет', () => {
    expect(clubSection.parse({ name: 'Гром', createdAt: 'x' }, {}).createdAt).toBe(1);
    expect(clubSection.parse({ name: '', city: '', createdAt: 0 }, {})).toEqual(emptyClub());
    expect(clubSection.parse({ name: 'Гром', createdAt: 5 }, {}).createdAt).toBe(5);
  });

  // Ловит: битые цвет, город и версия остаются в разделе (в v2 всплыли бы новости v1, форма не нарисуется).
  it('club: битая форма → по умолчанию, город вне правил → пусто, newsSeen → 2.0.0', () => {
    const c = clubSection.parse({ name: 'Гром', kit: { pattern: 'x' }, city: 'Moscow', newsSeen: 'abc', createdAt: 9 }, {});
    expect(c.kit).toEqual(emptyClub().kit);
    expect(c.city).toBe('');
    expect(c.newsSeen).toBe('2.0.0');
  });

  // Ловит: у club нет счётчика даты — createdAt мог бы вернуться в 0 незамеченным (ТЗ-0.11).
  it('club: counters и check — createdAt растёт; имя без даты — ошибка', () => {
    expect(clubSection.counters(clubSection.sample())).toEqual({ createdAt: 1_800_000_000_000 });
    expect(clubSection.check({ ...emptyClub(), name: 'X' }, cat)).toHaveLength(1);
  });

  // Ловит: счётчики course/match пусты или не те — сторож «не убывает» (ТЗ-0.11, инвариант 4) молчал бы о звёздах, рангах и дате конца.
  it('course и match: counters на образце — точные ключи и значения', () => {
    expect(courseSection.counters(courseSection.sample())).toEqual({ passed: 2, stars: 4 });
    // parse(sample): DeepRequired делает кортеж счёта массивом, а counters ждёт настоящий тип.
    expect(matchSection.counters(matchSection.parse(matchSection.sample(), {}))).toEqual({ maxRank: 16, leagueHits: 1234, lastFinishedAt: 1_800_000_000_000 });
  });

  // Ловит: дубли в «пройденных», потеря незнакомых id (014-В2), звёзды и помощь вне границ.
  it('course: дубли убраны, незнакомые id и порядок хранятся, значения зажаты', () => {
    const c = courseSection.parse({ lesson: 'yard-9', passed: ['b', 'a', 'b', '', 7], lessons: { zz: { stars: 9, cpm: -5, acc: 5000, help: 'x', back: 1 }, '': {} } }, {});
    expect(c.passed).toEqual(['b', 'a']);
    expect(c.lessons).toEqual({ zz: { stars: 3, cpm: 0, acc: 1000, fails: 0, help: 'none', back: false } });
    expect(c.lesson).toBe('yard-9');
    expect(courseSection.check({ lesson: '', passed: ['a', 'a'], lessons: {} }, cat)).toHaveLength(1);
  });

  // Ловит: длинный id в passed обрезается (чужой урок) вместо отбрасывания; passed не ограничен 400.
  it('course: длинный id в passed отброшен, passed не больше 400', () => {
    const long = 'a'.repeat(41);
    const many = Array.from({ length: 1000 }, (_, i) => `l${i}`);
    expect(courseSection.parse({ passed: [long, 'ok'] }, {}).passed).toEqual(['ok']);
    expect(courseSection.parse({ passed: many }, {}).passed).toHaveLength(400);
  });

  // Ловит: число уроков не ограничено — мусорный словарь раздувает конверт (защита от мусора).
  it('course: записей уроков не больше потолка', () => {
    const lessons = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`l${i}`, {}]));
    expect(Object.keys(courseSection.parse({ lessons }, {}).lessons)).toHaveLength(400);
  });

  // Ловит: у пальца нет окна/ранга (читатели формы ждут все 8), в окне чужие знаки или оно длиннее 300.
  it('match: 8 пальцев всегда, окно только 0/1 и хвост ≤ 300, ранг 0–4', () => {
    expect(formFingers).toHaveLength(8);
    const m = matchSection.parse({ form: { windows: { lp: `0${'1'.repeat(300)}`, rp: 5 }, maxRank: { lp: 9, li: -1 } } }, {});
    expect(Object.keys(m.form.windows)).toEqual([...formFingers]);
    expect(m.form.windows.lp).toBe('1'.repeat(300));
    expect(m.form.windows.rp).toBe('');
    expect(m.form.maxRank.lp).toBe(4);
    expect(m.form.maxRank.li).toBe(0);
    expect(m.form.candidate.lm).toEqual({ rank: 0, n: 0 });
  });

  // Ловит: мусор из файла раздувает раздел за бюджет — лиг больше 12 или ключей ошибок больше 100.
  it('match: лиг не больше 12, ключей ошибок не больше 100', () => {
    const many = (n: number, v: unknown) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, v]));
    const m = matchSection.parse({ played: many(13, []), leagueHits: many(13, 1), keyErrors: many(101, 1) }, {});
    expect(Object.keys(m.played)).toHaveLength(12);
    expect(Object.keys(m.leagueHits)).toHaveLength(12);
    expect(Object.keys(m.keyErrors)).toHaveLength(100);
  });

  // Ловит: «последние 3» превратились в «первые 3» или не ограничены; мусорные записи матчей остаются.
  it('match: по лиге последние 3, нечисловые записи отброшены', () => {
    const mk = (n: number) => ({ at: n, lessonId: `y${n}`, league: 'yard', kind: 'cup', cpm: n, accuracy: 2000, passed: true, stars: 3, help: 'coach' });
    const m = matchSection.parse({ played: { yard: [1, 2, 3, 4, 5].map(mk).concat(['x' as never]), bad: 'x' } }, {});
    expect(m.played.yard?.map((p) => p.at)).toEqual([3, 4, 5]);
    expect(m.played.yard?.[0]?.accuracy).toBe(1000);
    expect(m.played.bad).toEqual([]);
  });

  // Ловит: ожидающий 2-й тайм без урока «оживает» пустым; неизвестный повод ломает ветку «продолжить».
  it('match: half2 без урока → null, повод по умолчанию break, счёт зажат', () => {
    expect(matchSection.parse({ half2: { seed: 5 } }, {}).half2).toBeNull();
    const h = matchSection.parse({ half2: { lessonId: 'yard-2', reason: 'zzz', score: [500, 'a'] } }, {}).half2;
    expect(h).toMatchObject({ reason: 'break', score: [99, 0], seed: 0 });
    expect(matchSection.parse({ soften: { lessonId: '' } }, {}).soften).toBeNull();
  });

  // Ловит: сверка с выпуском молчит о незнакомом разделе — он потерялся бы при разборе, а голден остался бы зелёным.
  it('compareReleased: ключи вне реестра сверяются; ожидание — через JSON', () => {
    const reg = [probe];
    const l = probe.sample();
    expect(compareReleased({ probe: l, future: { a: 1 } }, { probe: l, future: { a: 1 } }, reg, {})).toEqual([]);
    expect(compareReleased({ probe: l, future: { a: 1 } }, { probe: l }, reg, {})).toEqual(['future: ключ вне реестра изменился']);
    expect(compareReleased({ probe: l }, { probe: l, extra: 1 }, reg, {})).toEqual(['extra: ключ вне реестра изменился']);
    expect(compareReleased({ probe: l, x: { u: undefined } }, { probe: l, x: {} }, reg, {})).toEqual([]);
  });

  // Ловит: бюджет считается суммой разделов и не видит корня конверта (format/draft/rev/app и имена ключей).
  it('бюджет считает JSON всего конверта, а не сумму разделов', () => {
    const one = defineSection({ name: 'one', owner: '000', parse: (r) => r as string, empty: () => '', sample: () => 'x', maxSample: () => 'x', counters: () => ({}), check: () => [] });
    expect(budget([one]).total).toBeGreaterThan(JSON.stringify(one.maxSample(cat)).length + 40);
  });
});
