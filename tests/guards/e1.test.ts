/**
 * Стражи этапа Э1 по исходникам (063 design §7: С1 касса, С4 перехват первым, С5 «Сломать» только в dev).
 * Вынесены из tests/guards.test.ts (очередь п. 12); правит только главная.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codeFiles, rel, root, withoutComments } from './lib';

/** Первый импорт модуля (без комментариев): путь из `import … from '…'` или `import '…'`. */
export function firstImport(source: string): string | null {
  const m = /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/m.exec(withoutComments(source));
  return m?.[1] ?? null;
}

describe('перехват ошибок — первым (063 С4, К6)', () => {
  it('страж видит нарушение: другой первый импорт', () => {
    expect(firstImport("import { createApp } from 'vue';\nimport { crash } from './app/crash/boot';")).toBe('vue');
    expect(firstImport("// ПЕРВЫМ\nimport { crash } from './app/crash/boot';\nimport App from './App.vue';")).toBe('./app/crash/boot');
    expect(firstImport("import './app/crash/boot';")).toBe('./app/crash/boot');
  });

  it('первый импорт src/main.ts — перехват из src/app/crash/', () => {
    // Ловит: перестановку импортов — бросок при оценке App.vue или роутера до перехвата дал бы белый экран, а не окно сбоя.
    expect(firstImport(readFileSync(join(root, 'src/main.ts'), 'utf8'))).toMatch(/^\.\/app\/crash\//);
  });
});


/** Файлы, которые импортируют модуль по пути (статический `from` и `import()`), а не по слову: ключ текста — не подключение. */
export function importersOf(files: Array<[string, string]>, name: string): string[] {
  const re = new RegExp(`(from|import)\\s*\\(?\\s*['"][^'"]*/${name}(\\.vue|\\.ts)?['"]`);
  return files.filter(([, src]) => re.test(withoutComments(src))).map(([p]) => p);
}

describe('кнопка «Сломать» — только в dev (063 С5)', () => {
  const files = codeFiles('src').map((p) => [rel(p), readFileSync(p, 'utf8')] as [string, string]);

  it('страж видит файлы и узнаёт подключение по пути, а не по слову', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(importersOf([['a.vue', "import B from './BreakButton.vue';"]], 'BreakButton')).toEqual(['a.vue']);
    expect(importersOf([['b.ts', "const C = () => import('../../screens/dev/KitSheet.vue');"]], 'KitSheet')).toEqual(['b.ts']);
    expect(importersOf([['c.ts', 'const t = ru.kit.sheet.breakNow; // BreakButton']], 'BreakButton')).toEqual([]);
  });

  it('BreakButton подключает только лист сверки, а лист — только роутер под import.meta.env.DEV', () => {
    // Ловит: импорт кнопки сбоя из экрана, оболочки или main.ts в обход dev-маршрута — она попала бы в выпускную сборку.
    expect(importersOf(files, 'BreakButton')).toEqual(['src/screens/dev/KitSheet.vue']);
    expect(importersOf(files, 'KitSheet')).toEqual(['src/app/router/routes.ts']);
    const routes = withoutComments(readFileSync(join(root, 'src/app/router/routes.ts'), 'utf8'));
    expect(routes).toMatch(/import\.meta\.env\.DEV\s*\?[\s\S]*?import\(\s*['"][^'"]*\/KitSheet\.vue['"]\s*\)/);
  });
});


/** Вызов `.save(…)`, в аргументе которого есть ключ `wallet` (весь аргумент до парной скобки, а не до первой `}`). */
export function saveWritesWallet(code: string): boolean {
  const src = withoutComments(code);
  for (const m of src.matchAll(/\.save\s*\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i++) depth += src[i] === '(' ? 1 : src[i] === ')' ? -1 : 0;
    if (/\bwallet\s*:/.test(src.slice(start, i))) return true;
  }
  return false;
}

/** Импорт — только типы: `import type {…}`, `import { type A, type B }` (стирается при сборке, раздела не подключает). */
function typeOnlyClause(clause: string): boolean {
  const c = clause.trim();
  if (/^type\s/.test(c)) return true;
  const m = /^\{([^}]*)\}$/.exec(c);
  if (!m) return false;
  const items = m[1]!.split(',').map((x) => x.trim()).filter(Boolean);
  return items.length > 0 && items.every((x) => /^type\s/.test(x));
}

/**
 * Файлы, импортирующие раздел кошелька (`engine/rewards/section`) как значение: внутри папки rewards — `./section`,
 * снаружи — по пути. Импорт одних типов (`import type`, `import { type X }`) не подключение — `Wallet` экраны читают.
 */
export function walletImporters(files: Array<[string, string]>): string[] {
  return files
    .filter(([p, src]) => {
      const path = p.startsWith('src/engine/rewards/') ? String.raw`\.\/section` : String.raw`[^'"]*rewards\/section`;
      const code = withoutComments(src);
      const stmt = new RegExp(String.raw`\b(?:import|export)\s+([^;'"]*?)\s*from\s*['"]${path}(?:\.ts)?['"]`, 'g');
      if ([...code.matchAll(stmt)].some((m) => !typeOnlyClause(m[1]!))) return true;
      // Побочный `import '…/section'` и динамический `import('…/section')` — всегда значение.
      return new RegExp(String.raw`\bimport\s*\(?\s*['"]${path}(?:\.ts)?['"]`).test(code);
    })
    .map(([p]) => p);
}

/** Файлы, которые зовут кассу: импортируют `rewards/cash` и вызывают `credit(`. */
export function cashCallers(files: Array<[string, string]>): string[] {
  return files
    .filter(([, src]) => {
      const code = withoutComments(src);
      return /(from|import)\s*\(?\s*['"][^'"]*rewards\/cash(\.ts)?['"]/.test(code) && /\bcredit\s*\(/.test(code);
    })
    .map(([p]) => p);
}

/** Какие `id` наград файл передаёт кассе: первая строка-литерал после `credit(…,` — в любых кавычках (ревью 067 Т1). */
export function creditedIds(src: string): string[] {
  return [...withoutComments(src).matchAll(/\bcredit\s*\([^'"`]*?,\s*(['"`])([a-z-]+)\1/g)].map((m) => m[2]!);
}

/** Файлы, которые списывают монеты: импортируют `rewards/cash` и вызывают `debit(` (067-Р24: только Лавка). */
export function debitCallers(files: Array<[string, string]>): string[] {
  return files
    .filter(([, src]) => {
      const code = withoutComments(src);
      return /(from|import)\s*\(?\s*['"][^'"]*rewards\/cash(\.ts)?['"]/.test(code) && /\bdebit\s*\(/.test(code);
    })
    .map(([p]) => p);
}

describe('касса наград — только через реестр (063 С1, ТЗ-0.3)', () => {
  const files = codeFiles('src').map((p) => [rel(p), readFileSync(p, 'utf8')] as [string, string]);
  const walletSection = 'src/engine/rewards/section.ts';
  const SHOW = (p: string) => p.startsWith('src/screens/') || p.startsWith('src/components/');

  it('страж видит файлы и узнаёт вызов кассы и импорт кошелька, а подставное — нет', () => {
    expect(files.length).toBeGreaterThan(20);
    const fake: Array<[string, string]> = [
      ['src/screens/x/Shop.vue', "import { credit } from '../../engine/rewards/cash';\ncredit(p, 'match-coins', 5);"],
      ['src/screens/x/Wallet.vue', "import { walletDef } from '../../engine/rewards/section';"],
      ['src/screens/x/Note.vue', "// credit( rewards/cash rewards/section\nconst t = 'credit(';"],
    ];
    expect(cashCallers(fake)).toEqual(['src/screens/x/Shop.vue']);
    expect(walletImporters(fake)).toEqual(['src/screens/x/Wallet.vue']);
    expect(walletImporters([['src/engine/rewards/cash.ts', "import { type Wallet, walletDef } from './section';"]])).toEqual(['src/engine/rewards/cash.ts']);
    // Типы — не подключение раздела (поправка 18.11: `Wallet` читают Дом, Карта и их мосты).
    const types: Array<[string, string]> = [
      ['src/app/home/input.ts', "import type { Wallet } from '../../engine/rewards/section';"],
      ['src/screens/map/useMapInput.ts', "import { type Wallet } from '../../engine/rewards/section';"],
      ['src/screens/map/Two.vue', "import { type Wallet, type Other } from '../../engine/rewards/section';"],
    ];
    expect(walletImporters(types)).toEqual([]);
    // Значение вместе с типом, обычный, побочный и динамический импорт — подключение.
    const values: Array<[string, string]> = [
      ['src/screens/match/A.vue', "import { walletDef, type Wallet } from '../../engine/rewards/section';"],
      ['src/screens/match/B.vue', "import { walletDef } from '../../engine/rewards/section';"],
      ['src/screens/match/C.vue', "import '../../engine/rewards/section';"],
      ['src/screens/match/D.vue', "const m = await import('../../engine/rewards/section');"],
    ];
    expect(walletImporters(values)).toHaveLength(4);
    expect(creditedIds("credit(purse, 'minute-coins', n, ref)")).toEqual(['minute-coins']);
    expect(creditedIds('credit(purse, "lesson-pack", 1)')).toEqual(['lesson-pack']);
    const debits: Array<[string, string]> = [
      ['src/engine/day/chain.ts', "import { debit } from '../rewards/cash';\ndebit(p, 'shop-buy', 1, 'x');"],
      ['src/engine/shop/note.ts', "// debit( rewards/cash\nconst t = 'debit(';"],
    ];
    expect(debitCallers(debits)).toEqual(['src/engine/day/chain.ts']);
  });

  it('монеты списывает только Лавка: `debit(` — только из DEBIT_CALLERS (067-Р24, ТЗ-3.9)', async () => {
    // Ловит: движок или экран списывает монеты мимо покупки — вызов `debit(` из файла, которого нет в DEBIT_CALLERS.
    const { DEBIT_CALLERS, CASH_FILE } = await import('../../src/engine/rewards/sources');
    expect(debitCallers(files).filter((p) => p !== CASH_FILE && !DEBIT_CALLERS.includes(p))).toEqual([]);
  });

  it('реестр наград: файлы существуют, у каждой награды свой вызов кассы', async () => {
    // Ловит: запись в реестре без файла (награда «висит»), вызов кассы из файла, которого в реестре нет, и обратно.
    const { REWARD_SOURCES, CASH_FILE } = await import('../../src/engine/rewards/sources');
    expect(REWARD_SOURCES.length).toBeGreaterThan(2);
    expect(existsSync(join(root, CASH_FILE))).toBe(true);
    expect(existsSync(join(root, walletSection))).toBe(true);
    for (const s of REWARD_SOURCES) {
      expect(s.callers.length, s.id).toBeGreaterThan(0);
      for (const c of s.callers) {
        expect(existsSync(join(root, c)), `${s.id}: ${c}`).toBe(true);
        const src = files.find(([p]) => p === c)?.[1] ?? '';
        expect(creditedIds(src), `${c} не зовёт кассу с «${s.id}»`).toContain(s.id);
      }
    }
    const allowed = new Set(REWARD_SOURCES.flatMap((s) => s.callers));
    expect(cashCallers(files).filter((p) => p !== CASH_FILE && !allowed.has(p))).toEqual([]);
    // Каждый файл вызывает кассу только с наградами, у которых он в `callers`.
    for (const [p, src] of files.filter(([p]) => allowed.has(p))) {
      const mine = new Set(REWARD_SOURCES.filter((s) => s.callers.includes(p)).map((s) => s.id as string));
      expect(creditedIds(src).filter((id) => !mine.has(id)), p).toEqual([]);
    }
  });

  it('раздел кошелька импортирует только касса (и реестр разделов сборки)', () => {
    // Ловит: запись в кошелёк мимо кассы — экран, движок или мост импортирует раздел и пишет монеты сам.
    expect(walletImporters(files).sort()).toEqual(['src/app/save/sections.ts', 'src/engine/rewards/cash.ts']);
  });

  it('файлы показа (экраны, компоненты) кассу и кошелёк не трогают и в сохранение монеты не пишут', () => {
    // Ловит: экран итога или Дома сам начисляет монеты: `credit(`, импорт кассы или раздела, `wallet` в патче `save`.
    const shows = files.filter(([p]) => SHOW(p));
    expect(shows.length).toBeGreaterThan(5);
    const bad = shows
      .filter(([p, src]) => {
        const code = withoutComments(src);
        // Кошелёк — значением (тип `Wallet` экран читает); касса — любым импортом.
        return walletImporters([[p, src]]).length > 0 || /rewards\/cash/.test(code) || /\bcredit\s*\(/.test(code) || saveWritesWallet(code);
      })
      .map(([p]) => p);
    expect(bad).toEqual([]);
    // Ловит: значение `walletDef` в экране (MatchScreen до 063 Т8) и подставное `credit(…)` — показ не должен трогать кассу.
    const showBad = (code: string): boolean => walletImporters([['src/screens/x/S.vue', code]]).length > 0 || /\bcredit\s*\(/.test(withoutComments(code));
    expect(showBad("import { walletDef } from '../../engine/rewards/section';")).toBe(true);
    expect(showBad("credit(p, 'match-coins', 5);")).toBe(true);
    expect(showBad("import type { Wallet } from '../../engine/rewards/section';")).toBe(false);
    expect(saveWritesWallet("session.save({ day: { n: 1 }, wallet: w });")).toBe(true);
  });

  it('запись кошелька через save — нигде в src (только касса через патч)', () => {
    // Ловит: файл app или движка пишет монеты мимо кассы — `session.save({ …, wallet: … })` (ТЗ-0.3; ревью 063 Т8).
    expect(files.filter(([, src]) => saveWritesWallet(src)).map(([p]) => p)).toEqual([]);
    expect(saveWritesWallet("s.save({ day: d, wallet: { coins: 99 } })")).toBe(true);
    expect(saveWritesWallet("s.save({ day: d })")).toBe(false);
  });
});

/** Нарушения С3 в исходнике: адрес `/parent` строкой или константа `PARENT` (путь `#/parent` из engine/players/entry). */
export function parentLinks(source: string): string[] {
  const code = withoutComments(source);
  return [...code.matchAll(/['"`][^'"`\n]*\/parent\b[^'"`\n]*['"`]|\bPARENT\b/g)].map((m) => m[0]);
}

describe('родитель — только по набранному адресу (063 С3, З3)', () => {
  // Экраны ребёнка и общие компоненты; страница родителя и dev-кадры — не экраны ребёнка, роутер — в src/app/.
  const child = [...codeFiles('src/screens'), ...codeFiles('src/components')]
    .map((p) => [rel(p), readFileSync(p, 'utf8')] as [string, string])
    .filter(([p]) => !p.startsWith('src/screens/parent/') && !p.startsWith('src/screens/dev/'));

  it('страж видит нарушение: адрес строкой, адрес с параметром, константу', () => {
    expect(parentLinks("router.push('/parent')")).toEqual(["'/parent'"]);
    expect(parentLinks('location.hash = `#/parent?tab=file`')).toEqual(['`#/parent?tab=file`']);
    expect(parentLinks("import { PARENT } from '../../engine/players/entry';")).toEqual(['PARENT']);
    expect(parentLinks("const a = '/parents-guide'; // ссылка '/parent' в комментарии не в счёт")).toEqual([]);
  });

  it('ни один экран и компонент ребёнка не ведёт на #/parent', () => {
    // Ловит: кнопку или ссылку «Для взрослых» на экране игры — ребёнок попадёт к выгрузке и корзине (063 З3, design §1).
    expect(child.length).toBeGreaterThan(3);
    expect(child.filter(([, src]) => parentLinks(src).length > 0).map(([p]) => p)).toEqual([]);
  });
});
