/**
 * Формы и голдены сохранения (спека 014-Т2, ТЗ-12.6, Б3): файлы на номер, сверка `toEqual`, не снапшоты.
 * Файла формы нет — красное с подсказкой; создаёт его только явный `KK_GOLDEN_WRITE=1`.
 * Ловит у каждого теста — строка «Ловит:».
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAVE_DRAFT, SAVE_FORMAT, classify, fullPlayers, fullSample, fullShared, migrate, parseSections } from '../src/engine/save/format';
import { defineSection } from '../src/engine/save/section';
import { registry } from '../src/app/save/registry';
import { GOLDEN_DIR, compareReleased, matchGolden, probe, shapeOf } from './saveFixtures';
import { ctx } from './saveStoreHelpers';

describe('формы и голдены (ТЗ-12.6, Б3)', () => {
  /** Выпущенные форматы: нижняя граница зашита здесь, удалить файл голдена нельзя. С выпуском v2.0 — [1]. */
  const RELEASED_FORMATS: readonly number[] = [];
  const tag = `f${SAVE_FORMAT}.d${SAVE_DRAFT}`;
  const hint = 'форма изменилась без подъёма номера: поднимите SAVE_DRAFT (до v2.0) или SAVE_FORMAT с миграцией';

  // Ловит: правка корня конверта (поле, тип) без подъёма номера; содержимое разделов здесь не смотрим — у каждого свой файл.
  it('форма конверта — файл на номер, без содержимого разделов', () => {
    matchGolden(`save-shape.${tag}.json`, shapeOf({ ...fullSample(registry), sections: {} }), hint);
  });

  // Ловит: новое поле раздела без подъёма номера (образец DeepRequired не соберётся без поля, форма — не совпадёт);
  // раздел без файла формы (В5: файл на раздел).
  it('форма каждого раздела — свой файл на номер', () => {
    for (const def of registry) matchGolden(`save-shape.${tag}.${def.name}.json`, shapeOf(def.sample()), hint);
  });

  // Ловит: раздел убран из реестра, а файл его формы остался (удаление раздела — подъём номера, 018-Р2).
  it('файл формы текущего номера без зарегистрированного раздела — красное', () => {
    const names = new Set(registry.map((d) => d.name));
    const orphans = readdirSync(GOLDEN_DIR)
      .map((n) => new RegExp(`^save-shape\\.${tag.replace('.', '\\.')}\\.([a-z]+)\\.json$`).exec(n)?.[1])
      .filter((n): n is string => n !== undefined && !names.has(n));
    expect(orphans).toEqual([]);
  });

  // Ловит: правка списка игроков без подъёма номера (В6).
  it('форма списка игроков', () => {
    matchGolden(`players-shape.${tag}.json`, shapeOf(fullPlayers()), hint);
  });

  // Ловит: правка общей части (перерыв) без подъёма номера (В6).
  it('форма общей части', () => {
    matchGolden(`shared-shape.${tag}.json`, shapeOf(fullShared()), hint);
  });

  // Ловит: сверка с файлом превратилась в «пишет что угодно»: добавленное поле обязано краснить сверку.
  it('добавленное поле образца ломает сверку с файлом формы', () => {
    const def = registry[0];
    expect(def).toBeDefined();
    if (def === undefined) return;
    const sample = { ...(def.sample() as Record<string, unknown>), newField: 1 };
    expect(() => matchGolden(`save-shape.${tag}.${def.name}.json`, shapeOf(sample), hint)).toThrow();
  });

  // Ловит: у образца нет поля, которое пишет «чистый» игрок — новое поле забыли внести в sample() раздела.
  it('каждое поле empty() раздела есть в его образце', () => {
    for (const def of registry) {
      const empty = def.empty(ctx) as Record<string, unknown>;
      const sample = def.sample() as Record<string, unknown>;
      expect([def.name, Object.keys(empty).filter((k) => !(k in sample))]).toEqual([def.name, []]);
    }
  });

  // Ловит: голден выпущенного формата удалён (нижняя граница зашита в тест) или нет файла ожидания.
  it('для каждого выпущенного формата есть голден и ожидание; нижняя граница зашита', () => {
    expect(SAVE_DRAFT).toBeGreaterThanOrEqual(1);
    expect(SAVE_FORMAT).toBeGreaterThanOrEqual(Math.max(0, ...RELEASED_FORMATS));
    // Выпущенный формат: файлы обязаны лежать в репозитории — молча пересоздавать их нельзя.
    for (const f of RELEASED_FORMATS) {
      expect(existsSync(join(GOLDEN_DIR, `save-f${f}.json`)), `save-f${f}.json удалён`).toBe(true);
      expect(existsSync(join(GOLDEN_DIR, `save-f${f}.expected.json`)), `save-f${f}.expected.json удалён`).toBe(true);
    }
    // Текущий формат: голден создаётся явно (KK_GOLDEN_WRITE=1) в коммите выпуска.
    for (let f = 1; f <= SAVE_FORMAT; f++) matchGolden(`save-f${f}.json`, fullSample(registry), 'голден выпуска');
  });

  // Ловит: голден старого формата перестал проходить цепочку и разбор — итог не равен файлу ожидания.
  it('голден каждого формата → classify → migrate → разбор = ожидание', () => {
    for (let f = 1; f <= SAVE_FORMAT; f++) {
      const text = JSON.stringify(JSON.parse(readGolden(`save-f${f}.json`)));
      const d = classify(text);
      const e = d.kind === 'ok' ? d.envelope : d.kind === 'migrate' ? d.envelope : null;
      expect(e, `save-f${f}.json: разбор`).not.toBeNull();
      if (e === null) continue;
      const r = migrate(e);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const parsed = parseSections(r.envelope.sections, {}, registry);
      if (existsSync(join(GOLDEN_DIR, `save-f${f}.expected.json`))) {
        const expected = JSON.parse(readGolden(`save-f${f}.expected.json`)) as Record<string, unknown>;
        expect(compareReleased(expected, JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>, registry, {}), `save-f${f}.expected.json`).toEqual([]);
      } else {
        matchGolden(`save-f${f}.expected.json`, parsed, 'итог миграции изменился');
      }
    }
  });

  /** Временный реестр: `probe` и лишний раздел `extra`, которого в выпущенном ожидании нет (В1). */
  const extra = (empty: number) =>
    defineSection({ name: 'extra', owner: '000', parse: (raw) => raw as number, empty: () => empty, sample: () => 1,
      maxSample: () => 1, counters: () => ({}), check: () => [] });
  const released = { probe: probe.sample() } as Record<string, unknown>;

  // Ловит: голден выпуска требует правки при добавлении раздела (раздел после выпуска обязан быть empty(), ожидание не трогаем).
  it('сверка с выпуском: новый раздел = empty() — зелёное, выпущенный раздел не изменился', () => {
    const reg = [probe, extra(0)];
    expect(compareReleased(released, { probe: probe.sample(), extra: 0 }, reg, {})).toEqual([]);
  });

  // Ловит: сверка не смотрит на новые разделы (неверный empty() у нового раздела прошёл бы молча).
  it('сверка с выпуском: новый раздел не равен empty() — красное', () => {
    const reg = [probe, extra(0)];
    expect(compareReleased(released, { probe: probe.sample(), extra: 5 }, reg, {})).toEqual(['extra: новый раздел не равен empty()']);
  });

  // Ловит: сверка не смотрит на выпущенные разделы (потеря поля после разбора прошла бы молча).
  it('сверка с выпуском: выпущенный раздел изменился — красное', () => {
    expect(compareReleased(released, { probe: { ...probe.sample(), goals: 99 } }, [probe], {})).toEqual(['probe: не равен ожиданию выпуска']);
  });

  // Ловит: лишние файлы в golden/ (форма старого номера, оставшаяся после подъёма, не мешает — но чужой мусор да).
  it('в golden/ только известные виды файлов', () => {
    if (!existsSync(GOLDEN_DIR)) return;
    const ok = /^(save-f\d+(\.expected)?|save-shape\.f\d+\.d\d+(\.[a-z]+)?|(players|shared)-shape\.f\d+\.d\d+)\.json$/;
    expect(readdirSync(GOLDEN_DIR).filter((n) => !ok.test(n))).toEqual([]);
  });
});

function readGolden(name: string): string {
  return readFileSync(join(GOLDEN_DIR, name), 'utf8');
}
