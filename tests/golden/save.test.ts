/**
 * Голдены сохранения (060 Т7): К21 — голден `fmt:1` проходит `openPlayer` + `reconcile` без потерь; замок — байты
 * голденов выпущенных форматов совпадают с отпечатком в `LOCK.json` (решение 062-Т4), команда `tools/golden-save.mjs`.
 * У каждого теста строка «Ловит:» — какую поломку он видит.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { reconcile, type CourseProgress } from '../../src/engine/course/reconcile';
import { serializePlayer, writePlayer } from '../../src/engine/save/envelope';
import { planImport } from '../../src/engine/save/import';
import { openPlayer } from '../../src/engine/save/open';
import type { SectionDef } from '../../src/engine/save/section';
import {
  GOLDEN_COURSES,
  GOLDEN_DEFS,
  GOLDEN_ORDER,
  GOLDEN_REG,
  GOLDEN_UNKNOWN,
  buildGoldens,
  goldenClubDef,
  goldenCourseDef,
} from '../fixtures/goldenSave';
import { key, setup } from '../fixtures/storageKit';

const exec = promisify(execFile);
/** Тесты с запуском `node tools/golden-save.mjs` (2–3 процесса подряд, ≈ 0,5 с каждый): под нагрузкой полного check и соседних
 *  прогонов стандартных 5 с vitest не хватало — красное «по таймауту» без поломки (dev 18.11, шаткость). Проверки те же. */
const SPAWN_MS = 20_000;
const root = join(__dirname, '..', '..');
const GOLDEN_DIR = join(__dirname, 'save');
const read = (name: string): string => readFileSync(join(GOLDEN_DIR, name), 'utf8');
const sha = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');
type Obj = Record<string, unknown>;

/** Следующая версия программы: курсовой раздел поднят до v2 (появилось поле `streak`), `club` прежний. */
const courseV2: SectionDef<unknown> = {
  ...goldenCourseDef,
  v: 2,
  empty: () => ({ ...goldenCourseDef.empty(), streak: 0 }),
  up: { 2: (d) => ({ ...(d as object), streak: 0 }) },
};
const DEFS_NEXT = [courseV2, goldenClubDef] as SectionDef<unknown>[];

// --- К21: голден fmt:1 открывается нынешним кодом ---------------------------------------------------------------

describe('К21: голден fmt:1 — игрок (060 Т7)', () => {
  it('К21: openPlayer — без миграции и правок, байт в байт, незнакомые разделы целы', () => {
    // Ловит: openPlayer трогает то, что не знает (теряет, переупорядочивает, «чинит» значения) или чужая миграция задевает текущий формат.
    const raw = read('fmt1.player.json');
    const opened = openPlayer(raw.trimEnd(), GOLDEN_DEFS);
    expect(opened.kind).toBe('ok');
    if (opened.kind !== 'ok') return;
    expect(opened.changed).toBe(false);
    expect(`${serializePlayer(opened.env)}\n`).toBe(raw);
    const original = JSON.parse(raw) as { sections: Obj };
    for (const name of GOLDEN_UNKNOWN) {
      expect(Object.hasOwn(opened.env.sections, name)).toBe(true);
      expect(JSON.stringify(opened.env.sections[name])).toBe(JSON.stringify(original.sections[name]));
    }
  });

  it('К21: reconcile голдена при том же реестре — без изменений', () => {
    // Ловит: reconcile «чинит» живой прогресс (двигает current, архивирует живое, теряет отметку).
    const opened = openPlayer(read('fmt1.player.json').trimEnd(), GOLDEN_DEFS);
    if (opened.kind !== 'ok') throw new Error('golden not ok');
    const data = opened.env.sections['course:ru']!.data as CourseProgress;
    const done = reconcile(data, GOLDEN_REG, GOLDEN_ORDER);
    expect(done.changes).toEqual([]);
    expect(done.progress).toEqual(data);
  });

  it('К21: цепочка up — голден fmt:1 на разделе, поднятом до v2: миграция, копия формата не теряется', () => {
    // Ловит: старый формат не открывается новой программой, миграция теряет поля или задевает чужие разделы (golden «каждого выпуска»).
    const raw = read('fmt1.player.json').trimEnd();
    const opened = openPlayer(raw, DEFS_NEXT);
    expect(opened.kind).toBe('ok');
    if (opened.kind !== 'ok') return;
    expect(opened.changed).toBe(true);
    const course = opened.env.sections['course:ru']!;
    expect(course.v).toBe(2);
    const before = (JSON.parse(raw) as { sections: Record<string, { data: Obj }> }).sections['course:ru']!.data;
    expect(course.data).toEqual({ ...before, streak: 0 });
    const orig = JSON.parse(raw) as { sections: Obj };
    for (const name of ['club', ...GOLDEN_UNKNOWN]) expect(JSON.stringify(opened.env.sections[name])).toBe(JSON.stringify(orig.sections[name]));
  });
});

describe('К21: голден fmt:1 — снимок клуба (060 Т7)', () => {
  it('К21: planImport на пустом устройстве — оба игрока, байт в байт', () => {
    // Ловит: импорт теряет или меняет игрока снимка (поле, раздел, незнакомое), считает свой же снимок «плохим».
    const raw = read('fmt1.club.json');
    const plan = planImport(raw.trimEnd(), { device: { players: [] }, players: [] }, GOLDEN_DEFS, GOLDEN_COURSES);
    expect(plan.kind).toBe('ok');
    if (plan.kind !== 'ok') return;
    expect(plan.clash).toEqual([]);
    expect(plan.overLimit).toBe(false);
    const files = (JSON.parse(raw) as { players: unknown[] }).players.map((p) => JSON.stringify(p));
    expect(plan.add.map(serializePlayer)).toEqual(files);
  });

  it('К21: снимок с тем же клубом — всё совпадения, добавлять нечего', () => {
    // Ловит: совпадение pid не замечено (импорт затёр бы игрока без выбора родителя).
    const raw = read('fmt1.club.json').trimEnd();
    const first = planImport(raw, { device: { players: [] }, players: [] }, GOLDEN_DEFS, GOLDEN_COURSES);
    if (first.kind !== 'ok') throw new Error('golden not ok');
    const here = { device: { players: first.add.map((e, order) => ({ pid: e.pid, order })) }, players: first.add };
    const again = planImport(raw, here, GOLDEN_DEFS, GOLDEN_COURSES);
    expect(again.kind === 'ok' && again.add.length).toBe(0);
    expect(again.kind === 'ok' && again.clash.map((c) => c.pid)).toEqual(['golden-a', 'golden-b']);
  });

  it('К21: после снятия урока в новой версии — архив и наследник, незнакомое и клуб целы', () => {
    // Ловит: сверка с реестром при импорте старого снимка теряет отметку снятого урока или задевает чужие разделы.
    const reg = { ...GOLDEN_REG, released: [...GOLDEN_REG.released], retired: { 'ru.yard.ao-pairs': 'ru.yard.vl' } };
    const order = GOLDEN_ORDER.filter((id) => id !== 'ru.yard.ao-pairs');
    const raw = read('fmt1.club.json').trimEnd();
    const plan = planImport(raw, { device: { players: [] }, players: [] }, GOLDEN_DEFS, { ru: { reg, order } });
    if (plan.kind !== 'ok') throw new Error('plan not ok');
    const orig = (JSON.parse(raw) as { players: { sections: Record<string, { data: Obj }> }[] }).players;
    plan.add.forEach((env, i) => {
      const data = env.sections['course:ru']!.data as CourseProgress;
      expect(data.archive['ru.yard.ao-pairs']).toEqual({ stars: 2, best: 80, tries: 1, done: '2026-11-02' });
      expect(data.lessons['ru.yard.ao-pairs']).toBeUndefined();
      expect(data.lessons['ru.yard.vl']?.stars).toBe(2); // лучшее от снятого урока — наследнику
      for (const name of ['club', ...GOLDEN_UNKNOWN]) {
        expect(JSON.stringify(env.sections[name])).toBe(JSON.stringify(orig[i]!.sections[name]));
      }
    });
  });
});

describe('К3, К21: голден fmt:1 — через хранилище, а не только движком (063 Т2)', () => {
  const GOLDEN_PID = 'golden-a';

  it('К21: createStore.loadPlayer открывает голден без миграции, копий нет; запись обратно — незнакомые разделы байт в байт', () => {
    // Ловит: хранилище (разрез store/copies/quarantine) читает выпущенный формат иначе, чем движок: «чинит», теряет незнакомое или плодит копии без миграции.
    const raw = read('fmt1.player.json').trimEnd();
    const { open, mem } = setup();
    mem.map.set(key(GOLDEN_PID), raw);
    const store = open(GOLDEN_DEFS);
    const loaded = store.loadPlayer(GOLDEN_PID);
    expect(loaded).toMatchObject({ kind: 'ok', changed: false, backup: true });
    if (loaded.kind !== 'ok') return;
    expect(serializePlayer(loaded.env)).toBe(raw);
    expect(mem.map.has(`${key(GOLDEN_PID)}.c1`)).toBe(false);
    const next = writePlayer(loaded.env, { club: { coins: 43 } });
    expect(store.savePlayer(GOLDEN_PID, next, loaded.env.rev)).toEqual({ ok: true });
    const original = JSON.parse(raw) as { sections: Obj };
    const after = JSON.parse(mem.map.get(key(GOLDEN_PID)) ?? '{}') as { rev: number; sections: Obj };
    expect(after.rev).toBe(loaded.env.rev + 1);
    for (const name of GOLDEN_UNKNOWN) expect(JSON.stringify(after.sections[name])).toBe(JSON.stringify(original.sections[name]));
  });

  it('К21: следующая версия раздела — loadPlayer мигрирует, голден байт в байт уходит в c1 до записи', () => {
    // Ловит: миграция при загрузке через хранилище не оставляет прежний выпущенный байт в копии — откат на прошлую версию невозможен.
    const raw = read('fmt1.player.json').trimEnd();
    const { open, mem } = setup();
    mem.map.set(key(GOLDEN_PID), raw);
    const loaded = open(DEFS_NEXT).loadPlayer(GOLDEN_PID);
    expect(loaded).toMatchObject({ kind: 'ok', changed: true, backup: true });
    expect(mem.map.get(`${key(GOLDEN_PID)}.c1`)).toBe(raw);
    expect(mem.map.get(key(GOLDEN_PID))).toBe(raw);
  });
});

// --- Замок голденов (062-Т4) --------------------------------------------------------------------------------------

/** Выпущенные форматы: сюда запись добавляется вместе с новым голденом; убрать — значит нарушить замок. */
const RELEASED = ['fmt1.club.json', 'fmt1.player.json'];

describe('Замок голденов: байты выпущенных форматов (062-Т4)', () => {
  const lock = JSON.parse(read('LOCK.json')) as { files: Record<string, string> };
  const onDisk = readdirSync(GOLDEN_DIR).filter((n) => n !== 'LOCK.json').sort();

  it('замок знает все выпущенные форматы', () => {
    // Ловит: выпущенный голден убран вместе со своей строкой замка (удалили оба — красного не было бы).
    for (const name of RELEASED) expect(Object.hasOwn(lock.files, name), `${name} должен быть в LOCK.json`).toBe(true);
  });

  it('каждый файл рядом — в замке, каждая строка замка — файл (изменение набора голденов — красное)', () => {
    // Ловит: голден удалён (строка замка осталась) или добавлен руками, в обход `golden-save.mjs --lock`.
    expect(onDisk).toEqual(Object.keys(lock.files).sort());
  });

  it('байты каждого голдена — sha-256 из замка', () => {
    // Ловит: правка голдена «под код» — один изменённый байт выпущенного формата.
    for (const [name, hash] of Object.entries(lock.files)) {
      expect(sha(readFileSync(join(GOLDEN_DIR, name))), `${name}: байты голдена изменены`).toBe(hash);
    }
  });
});

describe('tools/golden-save.mjs (на временной копии)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'golden-save-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  /** Запуски — параллельно (каждый поднимает vite ≈ 1 с): тесты ниже идут одновременно. */
  const run = async (dir: string, ...flags: string[]): Promise<{ status: number; stdout: string; stderr: string }> => {
    try {
      const done = await exec('node', ['tools/golden-save.mjs', '--dir', dir, ...flags], { cwd: root, encoding: 'utf8' });
      return { status: 0, stdout: done.stdout, stderr: done.stderr };
    } catch (e) {
      const err = e as { code: number; stdout: string; stderr: string };
      return { status: err.code, stdout: err.stdout, stderr: err.stderr };
    }
  };

  it.concurrent('пишет голдены детерминированно; замок — только с --lock', async () => {
    // Ловит: команда пишет замок сама (без флага), недетерминирована (время, порядок ключей) или замок не по байтам файлов.
    const dir = join(tmp, 'fresh');
    expect((await run(dir)).status).toBe(0);
    expect(existsSync(join(dir, 'LOCK.json'))).toBe(false);
    expect((await run(dir, '--lock')).status).toBe(0);
    const files = buildGoldens();
    for (const [name, text] of Object.entries(files)) expect(readFileSync(join(dir, name), 'utf8')).toBe(text);
    const lock = JSON.parse(readFileSync(join(dir, 'LOCK.json'), 'utf8')) as { files: Record<string, string> };
    expect(lock.files).toEqual(Object.fromEntries(Object.entries(files).map(([n, t]) => [n, sha(t)]).sort()));
  }, SPAWN_MS);

  it.concurrent('голдены репозитория: команда с --lock холостая — ни файлов, ни замка не меняет', async () => {
    // Ловит: образцы разошлись с записанными голденами (правка fixtures/goldenSave.ts без нового голдена) или повтор --lock переписывает замок.
    const dir = join(tmp, 'same');
    cpSync(GOLDEN_DIR, dir, { recursive: true });
    const snapshot = () => Object.fromEntries(readdirSync(dir).map((n) => [n, readFileSync(join(dir, n), 'utf8')]));
    const before = snapshot();
    const out = await run(dir, '--lock');
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('записано 0, в замок добавлено 0');
    expect(snapshot()).toEqual(before);
  }, SPAWN_MS);

  it.concurrent('голден из замка не перезаписывается: изменённый файл — отказ, замок цел', async () => {
    // Ловит: команда «чинит» голден по текущему коду — замок превращается в декорацию.
    const dir = join(tmp, 'changed');
    cpSync(GOLDEN_DIR, dir, { recursive: true });
    const lockBefore = readFileSync(join(dir, 'LOCK.json'), 'utf8');
    const target = join(dir, 'fmt1.player.json');
    writeFileSync(target, readFileSync(target, 'utf8').replace('Образец А', 'Образец Я'));
    const res = await run(dir, '--lock');
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('fmt1.player.json');
    expect(readFileSync(target, 'utf8')).toContain('Образец Я');
    expect(readFileSync(join(dir, 'LOCK.json'), 'utf8')).toBe(lockBefore);
  }, SPAWN_MS);

  it.concurrent('удалённый голден из замка не восстанавливается молча: отказ, замок цел', async () => {
    // Ловит: удаление выпущенного голдена проходит незамеченным (команда пишет файл заново и всё «зелёное»).
    const dir = join(tmp, 'removed');
    cpSync(GOLDEN_DIR, dir, { recursive: true });
    const lockBefore = readFileSync(join(dir, 'LOCK.json'), 'utf8');
    rmSync(join(dir, 'fmt1.club.json'));
    const res = await run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('fmt1.club.json');
    expect(existsSync(join(dir, 'fmt1.club.json'))).toBe(false);
    expect(readFileSync(join(dir, 'LOCK.json'), 'utf8')).toBe(lockBefore);
  }, SPAWN_MS);
});
