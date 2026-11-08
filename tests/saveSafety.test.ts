/**
 * Сохранение не теряется (спека 014-Т2, движок): разбор при загрузке, миграции, формы и голдены, копии.
 * Слой хранилища (две «вкладки», квота целиком) — Т3; здесь — чистые функции и их контракты.
 * Ловит у каждого теста — строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import {
  CATALOG_FILTER_EXEMPT,
  MIGRATIONS,
  SAVE_DRAFT,
  SAVE_FORMAT,
  classify,
  emptyEnvelope,
  fullSample,
  lostPaths,
  migrate,
  migrationGaps,
  nextEnvelope,
  parseSections,
  type Migrations,
  type SaveEnvelope,
} from '../src/engine/save/format';
import {
  COPIES_CEILING_BYTES,
  EVENTS_KEEP_BYTES,
  copyThenWrite,
  deleteName,
  importName,
  isCopyName,
  migrateName,
  overCeiling,
  planCopies,
  planFree,
  planSingle,
  quarantineName,
  recentImport,
  repairName,
  resetName,
  snapName,
  type CopyIo,
} from '../src/engine/save/copies';
import { registry } from '../src/app/save/registry';
import { PROBES, full, probe } from './saveFixtures';
import { ctx } from './saveStoreHelpers';

const P0 = { format: 0, draft: 1 };
const env = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ format: 0, draft: 1, rev: 4, app: '0.10.1', sections: { probe: full }, ...over });

describe('classify: что делать с лежащим в ключе (design §2)', () => {
  // Ловит: путаницу «нет ключа» и «битый» — первый запуск не должен давать карантин.
  it('ключа нет → fresh', () => {
    expect(classify(null, P0)).toEqual({ kind: 'fresh' });
  });

  // Ловит: голый SaveData версии 1 (без format) принят за годный конверт — v2 прочёл бы чужую форму как свою (Р34).
  it('голый SaveData версии 1 без format → broken(shape): конверт v2 его не принимает', () => {
    expect(classify(JSON.stringify(full), P0)).toEqual({ kind: 'broken', reason: 'shape' });
  });

  // Ловит: битое молча заменяется чистым без карантина — решение должно быть broken для любой формы мусора.
  it.each(['{не json', '[]', '7', 'null', '"s"', '{"format":"0","sections":{}}', '{"format":0,"draft":1}', '{"format":0,"sections":[]}', '{"format":-1,"sections":{}}', '{"format":1.5,"sections":{}}'])(
    'мусор %s → broken',
    (text) => {
      expect(classify(text, P0).kind).toBe('broken');
    },
  );

  // Ловит: старый черновик читается как годный — несовместимое должно уходить в карантин (Т18-Р3).
  it('format 0, черновик меньше → stale-draft; при SAVE_FORMAT ≥ 1 любой format 0 — тоже', () => {
    expect(classify(env({ draft: 0 }), { format: 0, draft: 2 }).kind).toBe('stale-draft');
    expect(classify(env({ draft: undefined }), P0).kind).toBe('stale-draft');
    expect(classify(env(), { format: 1, draft: 1 }).kind).toBe('stale-draft');
  });

  // Ловит: черновик новее программы уходит в карантин и затирается (В5) — должен быть newer, только чтение.
  it('draft > SAVE_DRAFT → newer, не карантин; format > SAVE_FORMAT → newer', () => {
    expect(classify(env({ draft: 2 }), P0)).toEqual({ kind: 'newer', format: 0, draft: 2 });
    expect(classify(JSON.stringify({ format: 3, rev: 1, app: 'x', sections: {} }), { format: 2, draft: 1 }).kind).toBe('newer');
    expect(classify(env({ format: 1, draft: undefined }), P0).kind).toBe('newer');
  });

  // Ловит: странный rev/app из чужой записи ломает счётчик записей (Б2) или разбор — они должны сводиться к 0 и ''.
  it.each([['"7"'], ['1.5'], ['-3'], ['null'], ['[]']])('rev=%s → 0; app не строка → пустая строка', (rev) => {
    const d = classify(`{"format":0,"draft":1,"rev":${rev},"app":5,"sections":{}}`, P0);
    expect(d.kind).toBe('ok');
    if (d.kind === 'ok') expect([d.envelope.rev, d.envelope.app]).toEqual([0, '']);
  });

  // Ловит: будущий формат без `sections` (или с другим составом) принят за битый и затёрт карантином (порядок проверок, В5).
  it('номер новее программы решает раньше состава: без sections → newer', () => {
    expect(classify('{"format":5}', P0).kind).toBe('newer');
    expect(classify('{"format":0,"draft":9,"parts":[]}', P0).kind).toBe('newer');
    expect(classify('{"format":0,"draft":1}', P0).kind).toBe('broken');
  });

  // Ловит: годный конверт теряет rev/app/незнакомый раздел при разборе.
  it('ok: конверт возвращается с rev, app и незнакомым разделом', () => {
    const d = classify(env({ sections: { probe: full, future: { a: 1 } } }), P0);
    expect(d.kind).toBe('ok');
    if (d.kind === 'ok') {
      expect(d.envelope).toMatchObject({ format: 0, draft: 1, rev: 4, app: '0.10.1' });
      expect(d.envelope.sections.future).toEqual({ a: 1 });
    }
  });

  // Ловит: старый формат N ≥ 1 не доходит до миграции.
  it('1 ≤ format < SAVE_FORMAT → migrate с номером исходного формата', () => {
    const d = classify(JSON.stringify({ format: 1, rev: 1, app: 'x', sections: {} }), { format: 3, draft: 1 });
    expect(d).toMatchObject({ kind: 'migrate', from: 1 });
  });
});

describe('миграции (design §3, правило 1)', () => {
  // Ловит: SAVE_FORMAT поднят без migrate(N−1→N) (К1) или реестр оброс лишним ключом.
  it('для каждого N в 2..SAVE_FORMAT есть миграция, лишних нет', () => {
    expect(migrationGaps(MIGRATIONS, SAVE_FORMAT)).toEqual({ missing: [], extra: [] });
  });

  // Ловит: проверка правила пустая — на искусственном реестре она обязана краснеть.
  it('migrationGaps находит пропуск и лишний ключ', () => {
    const noop = (s: SaveEnvelope): SaveEnvelope => s;
    expect(migrationGaps({ 2: noop, 4: noop }, 4)).toEqual({ missing: [3], extra: [] });
    expect(migrationGaps({ 1: noop, 2: noop, 5: noop }, 3)).toEqual({ missing: [3], extra: [1, 5] });
  });

  // Ловит: цепочка идёт не по одному шагу, не в порядке или не ставит номер формата.
  it('migrate идёт по одному шагу от format до target', () => {
    const trail: number[] = [];
    const m: Migrations = {
      2: (s) => (trail.push(2), { ...s, sections: { ...s.sections, a: 1 } }),
      3: (s) => (trail.push(3), { ...s, sections: { ...s.sections, b: s.sections.a } }),
    };
    const r = migrate({ format: 1, rev: 5, app: 'x', sections: {} }, m, 3);
    expect(trail).toEqual([2, 3]);
    expect(r).toEqual({ ok: true, envelope: { format: 3, rev: 5, app: 'x', sections: { a: 1, b: 1 } } });
  });

  // Ловит: бросок миграции уходит наружу или портит исходный конверт (Р4: сохранение не тронуто).
  it('бросок шага → ok:false с номером шага, исходный конверт цел', () => {
    const src: SaveEnvelope = { format: 1, rev: 1, app: 'x', sections: { k: 1 } };
    const r = migrate(src, { 2: () => { throw new Error('bug'); } }, 2);
    expect(r).toMatchObject({ ok: false, at: 2 });
    expect(src).toEqual({ format: 1, rev: 1, app: 'x', sections: { k: 1 } });
  });

  // Ловит: пустой реестр ведёт себя иначе, чем «нечего делать» (текущий формат без шагов).
  it('при format = target миграция — тождество', () => {
    const e = emptyEnvelope('1', PROBES, ctx);
    expect(migrate(e, {}, e.format)).toEqual({ ok: true, envelope: e });
  });
});

describe('конверт и разделы', () => {
  // Ловит: rev не растёт — две вкладки не отличат чужую запись (Б2); формат и черновик пишутся не программы.
  it('nextEnvelope: rev + 1, формат и черновик программы', () => {
    const next = nextEnvelope({ rev: 7 }, { probe: {} }, '0.11.0');
    expect(next).toEqual({ format: SAVE_FORMAT, ...(SAVE_FORMAT === 0 ? { draft: SAVE_DRAFT } : {}), rev: 8, app: '0.11.0', sections: { probe: {} } });
  });

  // Ловит: чистый конверт, который не проходит собственный разбор.
  it('emptyEnvelope проходит classify как ok', () => {
    const e = emptyEnvelope('0.10.1', PROBES, ctx);
    expect(classify(JSON.stringify(e)).kind).toBe('ok');
    expect(Object.keys(e.sections)).toEqual(['probe']);
  });

  // Ловит: незнакомый раздел теряется при записи (В2) — откат указателя стирал бы будущие данные.
  it('parseSections сохраняет незнакомые разделы как есть', () => {
    const out = parseSections({ probe: full, future: { x: [1, 2] } }, ctx, PROBES);
    expect(out.future).toEqual({ x: [1, 2] });
  });

  // Ловит: список исключений из «parse не фильтрует каталог» разросся (018 исключений не добавляет).
  it('CATALOG_FILTER_EXEMPT — пуст (исключение `legacy` ушло в 018-Т6б)', () => {
    expect([...CATALOG_FILTER_EXEMPT]).toEqual([]);
  });

  // Ловит: образец расходится с разбором — тогда голден и форма проверяют не то, что читает игра.
  it('fullSample проходит разбор раздела без потерь — для каждого раздела реестра', () => {
    const sample = fullSample(registry).sections;
    expect(Object.keys(sample).sort()).toEqual(registry.map((d) => d.name).sort());
    for (const def of registry) expect([def.name, lostPaths(sample[def.name], def.parse(sample[def.name], ctx))]).toEqual([def.name, []]);
  });
});

describe('lostPaths: что выбросила починка (В3)', () => {
  // Ловит: починка раздела выбросила данные молча — путей нет, а сырое в repair не уходит.
  it('считает выброшенное и изменённое, новые поля по умолчанию — нет', () => {
    const raw = { ...full, coins: 'много', matches: 7, extra: { deep: [1, 2] } };
    const lost = lostPaths(raw, probe.parse(raw, ctx));
    expect(lost).toContain('coins');
    expect(lost).toContain('extra');
    expect(lost).not.toContain('matches');
  });

  // Ловит: чистый (годный) раздел считается битым — на каждой загрузке копия repair.
  it('годный раздел и пустой корень — без потерь; не-объект вместо объекта — потеря корня', () => {
    expect(lostPaths(full, probe.parse(full, ctx))).toEqual([]);
    expect(lostPaths({}, probe.empty(ctx))).toEqual([]);
    expect(lostPaths([1], null)).toEqual(['(root)']);
  });
});

describe('копии: имена и планы (design §4)', () => {
  const T = '2026-11-08';

  // Ловит: имя копии начинается с `save.` — savedPlayerIds() примет её за игрока.
  it('ни одно имя копии не начинается с save. и все распознаются', () => {
    const names = [snapName('p1', T), migrateName('p1', 1), importName('p1', 5), repairName('p1', T), resetName('p1', 5), deleteName('p1', 5), quarantineName('p1', 5)];
    for (const n of names) {
      expect(n.startsWith('save.')).toBe(false);
      expect(isCopyName(n)).toBe(true);
    }
    expect(isCopyName('save.p1')).toBe(false);
    expect(isCopyName('events')).toBe(false);
    expect(isCopyName('snap.p1.вчера')).toBe(false);
  });

  // Ловит: снимков больше трёх (или «3 дня» вместо «3 ключей»), чужой игрок затронут, снимок за сегодня пишется дважды.
  it('planCopies: пишет снимок за сегодня, оставляет 3 новейших ключа, чужих не трогает', () => {
    const names = ['snap.p1.2026-11-01', 'snap.p1.2026-11-03', 'snap.p1.2026-11-05', 'snap.p1.2026-10-01', 'snap.p2.2026-01-01'];
    const plan = planCopies(names, 'p1', T);
    expect(plan.write).toEqual([snapName('p1', T)]);
    expect(plan.remove.sort()).toEqual(['snap.p1.2026-10-01', 'snap.p1.2026-11-01']);
    const again = planCopies([...names, snapName('p1', T)], 'p1', T);
    expect(again.write).toEqual([]);
  });

  // Ловит: после перерыва в месяц все снимки пропадают — считаем ключи, а не дни.
  it('planCopies: перерыв не стирает — старые 3 остаются', () => {
    const names = ['snap.p1.2026-09-01', 'snap.p1.2026-09-02'];
    const plan = planCopies(names, 'p1', T);
    expect(plan.remove).toEqual([]);
  });

  // Ловит: repair растёт без предела.
  it('planCopies режет repair до 3 новейших', () => {
    const names = ['01', '02', '03', '04'].map((d) => repairName('p1', `2026-10-${d}`));
    expect(planCopies(names, 'p1', T).remove).toEqual([repairName('p1', '2026-10-01')]);
  });

  // Ловит: вторая загрузка файла за сутки затирает pre.import (В7).
  it('recentImport: моложе суток — да, старше — нет', () => {
    const day = 24 * 3600 * 1000;
    expect(recentImport([importName('p1', 1_000_000)], 'p1', 1_000_000 + day - 1)).toBe(true);
    expect(recentImport([importName('p1', 1_000_000)], 'p1', 1_000_000 + day)).toBe(false);
    expect(recentImport([importName('p2', 1_000_000)], 'p1', 1_000_001)).toBe(false);
  });

  // Ловит: «по одному» для reset/delete/import не держится — копии копятся.
  it('planSingle оставляет только указанную копию', () => {
    const a = resetName('p1', 1);
    const b = resetName('p1', 2);
    expect(planSingle([a, b, importName('p1', 3)], 'p1', 'reset', b)).toEqual([a]);
  });
});

describe('освобождение места (В4)', () => {
  const T = '2026-11-08';
  const NOW = Date.parse(`${T}T12:00:00Z`);

  // Ловит: порядок освобождения нарушен — журнал → снимки (кроме сегодняшних) → (next) карантин и pre.*, старые раньше.
  it('порядок: журнал, снимки кроме сегодняшнего, затем только на next — старое', () => {
    const names = ['events', snapName('p1', T), snapName('p1', '2026-11-01'), repairName('p1', '2026-11-02'), quarantineName('p1', 200), importName('p1', 100), migrateName('p1', 1)];
    const sizes = { events: EVENTS_KEEP_BYTES + 1 };
    const steps = planFree(names, sizes, 'next', T, NOW);
    expect(steps.map((s) => s.kind)).toEqual(['events', 'snaps', 'old']);
    expect(steps[1]?.remove.sort()).toEqual([repairName('p1', '2026-11-02'), snapName('p1', '2026-11-01')]);
    expect(steps[2]?.remove).toEqual([importName('p1', 100), quarantineName('p1', 200), migrateName('p1', 1)]);
  });

  // Ловит: на release (общий origin со старой версией) удаляется карантин; журнал в пределах 16 КБ режется зря.
  it('на release карантин не трогается; журнал в пределах нормы — не шаг', () => {
    const steps = planFree(['events', quarantineName('p1', 1)], { events: EVENTS_KEEP_BYTES }, 'release', T, NOW);
    expect(steps).toEqual([]);
  });

  // Ловит: копию «до загрузки файла» моложе суток удаляет освобождение места (шаг «old») или потолок — прежний прогресс
  // пропадает (Р11). Старше суток — по-прежнему первой в очереди.
  it('Р11: pre.*.import.* моложе суток не удаляется ни планом, ни потолком; старше — удаляется', () => {
    const young = importName('p1', NOW - 3600 * 1000);
    const old = importName('p2', NOW - 2 * 24 * 3600 * 1000);
    const quarantine = quarantineName('p1', NOW - 1000);
    const steps = planFree([young, old, quarantine], {}, 'next', T, NOW);
    expect(steps.map((s) => s.remove)).toEqual([[old, quarantine]]);
    const sizes = { [young]: 600_000, [old]: 300_000, [quarantine]: 300_000 };
    expect(overCeiling([young, old, quarantine], sizes, 'next', NOW)).toEqual([old]);
    expect(planFree([young], {}, 'next', T, NOW)).toEqual([]);
  });

  // Ловит: копия с отметкой из будущего (часы планшета переводили на год вперёд) считается «моложе суток» бессрочно —
  // её не удалить, а новые загрузки файла не делают копию «до» (ревью 014-Т4д2).
  it('Р11: копия из будущего больше суток — старая; на секунды вперёд — свежая', () => {
    const future = importName('p1', NOW + 365 * 24 * 3600 * 1000);
    const skew = importName('p2', NOW + 5000);
    expect(planFree([future, skew], {}, 'next', T, NOW).map((s) => s.remove)).toEqual([[future]]);
    expect(recentImport([future], 'p1', NOW)).toBe(false);
    expect(recentImport([skew], 'p2', NOW)).toBe(true);
  });

  // Ловит: потолок 512 КБ не соблюдается или режет не самое старое / режет снимки.
  it('overCeiling: на next старые карантин и pre.* до потолка; на других каналах — ничего', () => {
    const a = quarantineName('p1', 1);
    const b = quarantineName('p1', 2);
    const c = importName('p1', 3);
    const snap = snapName('p1', '2026-11-01');
    const sizes = { [a]: 300_000, [b]: 300_000, [c]: 100_000, [snap]: 900_000 };
    expect(overCeiling([a, b, c, snap], sizes, 'next', NOW)).toEqual([a]);
    expect(overCeiling([a, b, c, snap], sizes, 'release', NOW)).toEqual([]);
    expect(COPIES_CEILING_BYTES).toBe(512 * 1024);
  });
});

describe('copyThenWrite: копия раньше основного ключа (Б1)', () => {
  function memory(quota: number, failRead = false): CopyIo & { data: Map<string, string> } {
    const data = new Map<string, string>();
    const used = (): number => [...data.values()].reduce((s, v) => s + v.length, 0);
    return {
      data,
      write(key, text) {
        if (used() - (data.get(key)?.length ?? 0) + text.length > quota) return false;
        data.set(key, text);
        return true;
      },
      read: (key) => (failRead ? 'испорчено' : (data.get(key) ?? null)),
    };
  }

  // Ловит: основной ключ пишется, хотя копия не легла — потеря «до» при переполнении.
  it('копия не влезла → основной ключ побайтно прежний', () => {
    const io = memory(30);
    io.data.set('main', 'старое'); // 6 знаков
    expect(copyThenWrite(io, 'copy', 'x'.repeat(40), 'main', 'новое')).toBe('copy-failed');
    expect(io.data.get('main')).toBe('старое');
    expect(io.data.has('copy')).toBe(false);
  });

  // Ловит: копия записана, но не перечитана — битая копия считается резервом.
  it('копия не перечиталась такой же → основной ключ прежний', () => {
    const io = memory(1000, true);
    io.data.set('main', 'старое');
    expect(copyThenWrite(io, 'copy', 'сырое', 'main', 'новое')).toBe('copy-failed');
    expect(io.data.get('main')).toBe('старое');
  });

  // Ловит: хранилище бросает (приватный режим, запрет) — исключение уходит наружу, ломая загрузку.
  it('бросок хранилища → copy-failed / main-failed, без исключения', () => {
    const boom = (): never => {
      throw new Error('quota');
    };
    expect(copyThenWrite({ write: boom, read: () => null }, 'c', 'a', 'm', 'b')).toBe('copy-failed');
    let writes = 0;
    const io: CopyIo = { write: (k, t) => (++writes === 2 ? boom() : (void k, void t, true)), read: () => 'a' };
    expect(copyThenWrite(io, 'c', 'a', 'm', 'b')).toBe('main-failed');
  });

  // Ловит: порядок записи — основной ключ раньше копии.
  it('успех: сперва копия, потом основной ключ', () => {
    const order: string[] = [];
    const store = new Map<string, string>();
    const io: CopyIo = { write: (k, t) => (order.push(k), store.set(k, t), true), read: (k) => store.get(k) ?? null };
    expect(copyThenWrite(io, 'copy', 'сырое', 'main', 'новое')).toBe('ok');
    expect(order).toEqual(['copy', 'main']);
  });
});
