/**
 * Цвет соперника урока без макета (067-Т21, развилки Р38/Р50/Р239): `greenish`, `blends`, `rivalColor`, ТАБУ формы соперника.
 * Отдельный файл: подготовка без `tools/mock-*` и `docs/mockups/`, чтобы тест шёл и в открытом `main` (сверка с макетом — `teams.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import clubs from '../../src/content/clubs.json';
import { hasRed, yellowWithBlue } from '../../src/engine/club/paint';
import { rivalBodyOf, rivalKitOf } from '../../src/engine/club/rival';
import { blends, greenish, rivalColor, rivalOf, teamOf, TEAMS } from '../../src/engine/cup/teams';

/** Расцветка клуба образца макетов — зелёная с белым (023-Р30), она же по умолчанию в игре. */
const GREEN_CLUB = { body: '#2f9a27' };

describe('Т21-К3: цвет соперника — c1 команды, при зелёном c1 — c2', () => {
  it('Т21-К3 Р38: урок 3 при зелёном клубе образца — c1 команды', () => {
    // Ловит: цвет соперника урока не c1 команды (оранжевый «Старт» против зелёных).
    expect(rivalBodyOf(rivalOf(3), GREEN_CLUB)).toBe(rivalOf(3).c1);
  });

  it('Т21-К3 Р50: зелёный c1 — вторая форма c2, остальные — c1 (оттенок 80–170°)', () => {
    // Ловит: правило «зелёный» ушло от макета (порог оттенка) — Кедр, Связист, Спутник, Флагман остались бы зелёными против зелёных.
    const green = TEAMS.filter((t) => greenish(t.c1)).map((t) => t.name);
    expect(green).toEqual(['Кедр', 'Связист', 'Спутник', 'Флагман']);
    for (const t of TEAMS) expect(rivalColor(t, GREEN_CLUB), t.name).toBe(green.includes(t.name) ? t.c2 : t.c1);
  });

  it('Т21-К3 Р239: цвет, слившийся с формой клуба, уступает второму цвету команды (сначала body, полосы — потом); сливаются оба — остаётся первый', () => {
    // Ловит: красный соперник на красном клубе и белый на белом (фишки не отличить); подмена команды, когда выбора нет.
    const kedr = teamOf('Лесной')!;
    const rassvet = teamOf('Яблоневой')!;
    const white = { body: '#f4f4f4', alt: '#2f6fe0' };
    const red = { body: '#c8102e' };
    expect(rivalColor(kedr, white)).toBe(kedr.c1); // Кедр — c2 белый слился бы с белым клубом: остаётся его зелёный c1
    expect(rivalColor(rassvet, red)).toBe(rassvet.c2); // красный на красном — второй цвет, белый
    expect(rivalColor(rassvet, { body: '#c8102e', alt: '#ffffff' })).toBe(rassvet.c2); // основной цвет важнее полос: красный слился с body, белый — только с alt
    expect(rivalColor({ c1: '#c8102e', c2: '#c0392b' }, red)).toBe('#c8102e'); // оба слились с body — остаётся первый, команду не подменяем
    expect(rivalColor({ c1: '#c8102e', c2: '#1f6fd0' }, { body: '#2f9a27', alt: '#c8102e' })).toBe('#1f6fd0'); // оба годны по body — полосы решают
    expect(rivalColor({ c1: '#c8102e', c2: '#1f6fd0' }, { body: '#2f9a27', alt: '#ffffff' })).toBe('#c8102e'); // и полосы не мешают — первый
    expect(blends('#c8102e', '#c0392b')).toBe(true);
    expect(blends('#ffffff', '#f4f4f4')).toBe(true);
    expect(blends('#ffffff', '#16161a')).toBe(false);
    expect(blends('#16161a', '#1b2631')).toBe(true); // чёрное с тёмно-синим
    expect(blends('#2f9a27', '#1d6b66')).toBe(false);
  });
});

describe('Т21-К4: ТАБУ — соперник не сине-жёлтый и не красный со звездой', () => {
  it('Т21-К4 ТАБУ: форма соперника любой из 31 команд при любой расцветке клуба — без жёлтого рядом с синим, без звезды', () => {
    // Ловит: команда с жёлтым или золотым c1/c2 рядом с синим (В1, 038-Р21); форма соперника получила звезду (красное и бордо со звездой — ТАБУ).
    for (const team of TEAMS) {
      for (const club of clubs.palettes) {
        const kit = rivalKitOf(team, club);
        expect(yellowWithBlue(kit), `${team.name} против ${club.body}`).toBe(false);
        expect(Object.keys(kit).sort(), team.name).toEqual(['body', 'pattern', 'sleeves', 'trim']); // звёзд и канта вехи у соперника нет
      }
      // вторая форма с полосами c1 + c2 (Р57: у фишек Мини полосы всегда)
      expect(yellowWithBlue({ pattern: 'stripes', body: team.c1, alt: team.c2, sleeves: team.c1, trim: team.c1 }), team.name).toBe(false);
    }
  });

  it('Т21-К4 ТАБУ: список красных команд не растёт без решения владельца (038-Р28, Р36: у красных эмблемы без звезды)', () => {
    // Ловит: в контент добавили красную команду без решения про звезду на эмблеме.
    expect(TEAMS.filter((t) => hasRed({ pattern: 'plain', body: t.c1, sleeves: t.c1, trim: t.c1 })).map((t) => t.name)).toEqual(['Рассвет', 'Темп', 'Маяк', 'Вымпел', 'Пересвет']);
  });
});
