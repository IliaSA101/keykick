/**
 * «Что нового» (010-Р4, 063 Т11): раз после обновления у каждого игрока, новичку — нет; записи 0.x не показываются.
 * У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import newsJson from '../../src/content/news.json';
import { APP_VERSION, createPlayer } from '../../src/engine/save/envelope';
import { SECTIONS } from '../../src/app/save/sections';
import { seenDef } from '../../src/engine/seen/section';
import { NEWS_FROM, NEWS_KID_MAX, compareVersions, markNewsSeen, parentNews, pendingNews, systemWindow, updateLines, type NewsEntry } from '../../src/engine/versions/news';

const e = (version: string, kid: string[] = []): NewsEntry => ({ version, date: '', kid, parent: [] });
const NEWS = [e('2.2.0', ['три']), e('2.1.0', ['два']), e('2.0.1'), e('2.0.0', ['раз']), e('0.10.0', ['старое'])];

describe('«Что нового»: кому и сколько', () => {
  it('сравнение по числам: 2.10.0 новее 2.9.0', () => {
    // Ловит: сравнение строкой — 2.10.0 «старше» 2.9.0, карточка после 2.10 не появляется.
    expect(compareVersions('2.9.0', '2.10.0')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('новичку карточки нет: раздел seen создан с текущей версией', () => {
    // Ловит: новичок в первый же заход видит «что нового» про игру, которую ещё не знал (010-Р4).
    const env = createPlayer({ pid: 'p-new', name: 'Новичок' }, SECTIONS);
    const seen = env.sections.seen!.data as { news: string };
    expect(seen.news).toBe(APP_VERSION);
    expect(pendingNews(NEWS, seen.news, APP_VERSION)).toEqual([]);
  });

  it('после обновления — строки версий новее виденного, новые сверху; отметка — карточки нет', () => {
    // Ловит: карточка не показывается после обновления или показывается снова после «Отлично!» (отметка не легла).
    expect(pendingNews(NEWS, '2.0.0', '2.2.0')).toEqual(['три', 'два']);
    const done = markNewsSeen({ news: '2.0.0', firsts: {} }, '2.2.0');
    expect(done).toEqual({ news: '2.2.0', firsts: {} });
    expect(pendingNews(NEWS, done.news, '2.2.0')).toEqual([]);
  });

  it('двое игроков: отметка у каждого своя', () => {
    // Ловит: один «Отлично!» гасит карточку и второму игроку на том же устройстве.
    const sashaDone = markNewsSeen({ news: '2.0.0', firsts: {} }, '2.1.0');
    expect(pendingNews(NEWS, sashaDone.news, '2.1.0')).toEqual([]);
    expect(pendingNews(NEWS, '2.0.0', '2.1.0')).toEqual(['два']);
  });

  it('записи 0.x не показываются; пропустил много версий — не больше NEWS_KID_MAX строк; не новее текущей — не видно', () => {
    // Ловит: v1-записи 0.10.0 всплывают в карточке v2; пропустивший много версий получает простыню; будущая запись видна до выпуска.
    expect(pendingNews([e('0.10.0', ['старое'])], '0.9.0', '2.0.0')).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => e(`2.${i + 1}.0`, [`с${i + 1}`]));
    expect(pendingNews(many, '2.0.0', '2.9.0')).toHaveLength(NEWS_KID_MAX);
    expect(pendingNews(NEWS, '2.0.0', '2.1.0')).toEqual(['два']);
    expect(parentNews(NEWS, '2.1.0').map((n) => n.version)).toEqual(['2.1.0', '2.0.1', '2.0.0']);
  });

  it('отметка не идёт назад; битая — заменяется текущей', () => {
    // Ловит: старая вкладка откатывает «видел до» назад — карточка вылезает заново.
    expect(markNewsSeen({ news: '2.5.0', firsts: {} }, '2.1.0').news).toBe('2.5.0');
    expect(markNewsSeen({ news: 'мусор', firsts: {} }, '2.1.0').news).toBe('2.1.0');
    expect(seenDef.empty().news).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('контент news.json: у каждой записи годная версия, запись 2.0.0 есть', () => {
    // Ловит: правка news.json с битым номером или без записи 2.0.0 — карточка и список родителя молча пустеют.
    const list = newsJson as NewsEntry[];
    expect(list.every((n) => /^\d+\.\d+\.\d+$/.test(n.version))).toBe(true);
    expect(parentNews(list, '2.0.0').map((n) => n.version)).toContain(NEWS_FROM);
  });

  it('К14 (063-Р58): окно «Игра обновилась» — старая оболочка или непросмотренное; новичку и без нового — нет', () => {
    // Ловит: окно новичку (010-Р4) или без причины (каждый вход), и потеря строк «Что нового» у игрока после обновления.
    expect(updateLines(false, [])).toBeNull();
    expect(updateLines(true, [])).toEqual([]);
    expect(updateLines(false, ['раз'])).toEqual(['раз']);
    const fresh = createPlayer({ pid: 'p0000000001', name: 'А' }, SECTIONS);
    const seen = (fresh.sections['seen']?.data as { news: string }).news;
    expect(updateLines(false, pendingNews(NEWS, seen, APP_VERSION))).toBeNull();
  });

  it('К12 (063-Р58): какое окно — тихий маршрут, квота важнее обновления, «позже» у каждого окна, не легла отметка → квота', () => {
    // Ловит: окно посреди матча или на «Кто играет?»; обновление поверх квоты (перезагрузка теряет несохранённое); Esc закрывает чужое окно; после отказа записи отметки окно обновления остаётся и даёт петлю перезагрузок.
    const base = { bare: false, status: 'ok', laterQuota: false, laterUpdate: false, lines: ['раз'] as string[] | null };
    const rows: [string, Partial<typeof base>, 'quota' | 'update' | null][] = [
      ['тихий маршрут — ничего', { bare: true }, null],
      ['тихий маршрут не пускает и квоту', { bare: true, status: 'quota' }, null],
      ['обновление есть', {}, 'update'],
      ['обновления нет', { lines: null }, null],
      ['квота важнее обновления', { status: 'quota' }, 'quota'],
      ['квота без обновления', { status: 'quota', lines: null }, 'quota'],
      ['квота закрыта Esc — обновление при квоте не лезет', { status: 'quota', laterQuota: true }, null],
      ['обновление закрыто Esc', { laterUpdate: true }, null],
      ['Esc на обновлении не гасит квоту', { status: 'quota', laterUpdate: true }, 'quota'],
      ['Esc на квоте не гасит обновление после снятия отказа', { laterQuota: true }, 'update'],
      ['отметка «виденным» не легла: статус стал quota → квота', { status: 'quota' }, 'quota'],
    ];
    for (const [what, patch, want] of rows) expect(systemWindow({ ...base, ...patch }), what).toBe(want);
  });
});
