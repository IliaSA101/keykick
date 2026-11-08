/**
 * «Что нового» (спека 010): сравнение версий, отбор строк для ребёнка и родителя, контент news.json
 * и поле сохранения «видел новости до версии» (сюда, а не в save.test.ts — тот у предела 600 строк).
 */
import { describe, expect, it } from 'vitest';
import newsJson from '../src/content/news.json';
import {
  NEWS_KID_MAX,
  NEWS_LEGACY_SEEN,
  compareVersions,
  isVersion,
  laterVersion,
  parentNews,
  unseen,
  type NewsEntry,
} from '../src/engine/news';
import { formatDate, pendingCard, replayCard, shortVersion } from '../src/app/whatsNew';

const entry = (version: string, kid: string[] = [], parent: string[] = []): NewsEntry => ({
  version,
  date: '',
  kid,
  parent,
});

describe('сравнение версий', () => {
  it('по числам, а не по строкам: 0.9.0 < 0.10.0', () => {
    expect(compareVersions('0.9.0', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0);
    expect(compareVersions('0.10.1', '0.10.0')).toBeGreaterThan(0);
    expect(compareVersions('0.10.0', '0.10.0')).toBe(0);
  });

  it('isVersion: только X.Y.Z из чисел', () => {
    expect(['0.9.0', '12.0.3'].every(isVersion)).toBe(true);
    for (const bad of ['', '1.2', '1.2.3.4', 'v1.2.3', '1.2.x', '1.-2.3', ' 1.2.3', 7, null, undefined, {}]) {
      expect(isVersion(bad)).toBe(false);
    }
  });

  it('laterVersion: растёт, битое уступает годному', () => {
    expect(laterVersion('0.9.0', '0.10.0')).toBe('0.10.0');
    expect(laterVersion('0.10.0', '0.9.0')).toBe('0.10.0');
    expect(laterVersion('мусор', '0.10.0')).toBe('0.10.0');
    expect(laterVersion('0.10.0', 'мусор')).toBe('0.10.0');
    expect(laterVersion('мусор', 'ещё')).toBe(NEWS_LEGACY_SEEN);
  });
});

describe('unseen: карточка ребёнка', () => {
  const news = [
    entry('0.10.0', ['точка']),
    entry('0.9.1'), // исправление без строк для ребёнка
    entry('0.9.0', ['старое']),
  ];

  it('показывает только новее виденного и не новее текущей, ничего больше', () => {
    expect(unseen(news, '0.9.0', '0.10.0')).toEqual(['точка']);
    expect(unseen(news, '0.8.0', '0.10.0')).toEqual(['точка', 'старое']);
    // будущая запись (выпуск ещё не наступил) не показывается
    expect(unseen(news, '0.9.0', '0.9.5')).toEqual([]);
  });

  it('всё увидено — пусто; отметка новее текущей — тоже', () => {
    expect(unseen(news, '0.10.0', '0.10.0')).toEqual([]);
    expect(unseen(news, '0.11.0', '0.10.0')).toEqual([]);
  });

  it('исправление без kid-строк карточки не даёт', () => {
    expect(unseen([entry('0.10.1', [], ['чинили'])], '0.10.0', '0.10.1')).toEqual([]);
    // а пропущенное до него — по-прежнему показывается
    expect(unseen([entry('0.10.1'), entry('0.10.0', ['точка'])], '0.9.0', '0.10.1')).toEqual(['точка']);
  });

  it('пропущено несколько версий: новые сверху, не больше шести, порядок файла не важен', () => {
    const many = [1, 2, 3, 4].map((n) => entry(`0.${n}.0`, [`а${n}`, `б${n}`])).reverse();
    const lines = unseen([...many].reverse(), '0.0.1', '0.4.0');
    expect(lines).toHaveLength(NEWS_KID_MAX);
    expect(lines).toEqual(['а4', 'б4', 'а3', 'б3', 'а2', 'б2']);
  });

  it('битая отметка — как у старого сохранения', () => {
    expect(unseen(news, 'мусор', '0.10.0')).toEqual(['точка']);
  });
});

describe('parentNews: список родителя', () => {
  it('все версии не новее текущей, новые сверху', () => {
    const news = [entry('0.9.0'), entry('0.11.0'), entry('0.10.0'), entry('битая')];
    expect(parentNews(news, '0.10.0').map((n) => n.version)).toEqual(['0.10.0', '0.9.0']);
    expect(parentNews(news, '0.8.0')).toEqual([]);
  });
});

describe('контент news.json', () => {
  const news = newsJson as NewsEntry[];

  it('версии годные, без повторов, новые сверху', () => {
    expect(news.every((n) => isVersion(n.version))).toBe(true);
    expect(new Set(news.map((n) => n.version)).size).toBe(news.length);
    const sorted = [...news].sort((a, b) => compareVersions(b.version, a.version));
    expect(news.map((n) => n.version)).toEqual(sorted.map((n) => n.version));
  });

  it('у каждой записи строки не пустые, дата пуста или ГГГГ-ММ-ДД', () => {
    for (const n of news) {
      expect([...n.kid, ...n.parent].every((s) => s.trim() !== '')).toBe(true);
      expect(n.date === '' || /^\d{4}-\d{2}-\d{2}$/.test(n.date)).toBe(true);
    }
  });

  it('ребёнок на 0.9.0 увидит новое, на 0.10.0 — нет', () => {
    expect(unseen(news, NEWS_LEGACY_SEEN, '0.10.0').length).toBeGreaterThan(0);
    expect(unseen(news, '0.10.0', '0.10.0')).toEqual([]);
  });
});

describe('карточка для экранов (app/whatsNew)', () => {
  const list = [
    entry('0.10.1', [], ['Исправление']),
    entry('0.10.0', ['Точка'], ['Точка в лиге']),
    entry('0.9.0', [], ['Номер версии']),
  ];

  it('после обновления: строки новых версий, на плашке — свежая версия со строками', () => {
    expect(pendingCard(list, '0.9.0', '0.10.0')).toEqual({ version: '0.10', lines: ['Точка'] });
  });

  it('исправление без строк для ребёнка: карточки нет, номер в углу сменился', () => {
    expect(pendingCard(list, '0.10.0', '0.10.1')).toBeNull();
    expect(pendingCard(list, '0.9.0', '0.10.1')).toEqual({ version: '0.10', lines: ['Точка'] });
  });

  it('всё увидено или версия ещё не вышла — карточки нет', () => {
    expect(pendingCard(list, '0.10.0', '0.10.0')).toBeNull();
    expect(pendingCard(list, '0.9.0', '0.9.0')).toBeNull();
  });

  it('«ещё раз»: у текущей версии нет строк — берётся последняя, где они есть; нет таких — null', () => {
    expect(replayCard(list, '0.10.1')).toEqual({ version: '0.10', lines: ['Точка'] });
    expect(replayCard(list, '0.10.0')).toEqual({ version: '0.10', lines: ['Точка'] });
    expect(replayCard(list, '0.9.0')).toBeNull();
    expect(replayCard([], '0.10.0')).toBeNull();
  });

  it('даты — ДД.ММ.ГГГГ, пустая дата — пусто; номер на плашке без «.0»', () => {
    expect(formatDate('2026-11-05')).toBe('05.11.2026');
    expect(formatDate('')).toBe('');
    expect(formatDate('вчера')).toBe('');
    expect([shortVersion('0.10.0'), shortVersion('0.10.1'), shortVersion('1.0.0')]).toEqual(['0.10', '0.10.1', '1.0']);
  });
});
