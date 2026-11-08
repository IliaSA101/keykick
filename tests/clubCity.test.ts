/**
 * Точное совпадение города (019-Т15): Enter на полностью набранном городе — сразу «Готово». Сравнение — то же, что у подсказок:
 * без регистра, Ё = Е. DOM-тестов в наборе нет (окружение node), поэтому «один Enter» в самом поле проверяет e2e
 * (`tests/e2e/map-targets.spec.ts`), а здесь — решение «набрано точно или нет», на котором оно стоит.
 */
import { describe, expect, it } from 'vitest';
import { clubData } from '../src/app/kits';
import { exactCity, sameCity } from '../src/engine/club/create';

const cities = clubData.cities;

describe('точное совпадение города (019-Т15)', () => {
  it('Тверь, тверь, « Тверь » — это Тверь; неполное и латиница — нет', () => {
    // Ловит: Enter на неполном вводе завершает форму («Тве») или не узнаёт набранное другим регистром.
    expect(exactCity(cities, 'Тверь')).toBe('Тверь');
    expect(exactCity(cities, 'тверь')).toBe('Тверь');
    expect(exactCity(cities, '  ТВЕРЬ ')).toBe('Тверь');
    expect(exactCity(cities, 'Тве')).toBeNull();
    expect(exactCity(cities, 'ndthm')).toBeNull();
    expect(exactCity(cities, '')).toBeNull();
    expect(exactCity(cities, '   ')).toBeNull();
  });

  it('Ё = Е: «орел» — это Орёл, и отдаётся написание из списка', () => {
    // Ловит: ребёнок печатает «Орел», Enter подставляет «Орёл» и требует второго Enter.
    expect(exactCity(cities, 'орел')).toBe('Орёл');
    expect(exactCity(cities, 'ОРЁЛ')).toBe('Орёл');
  });

  it('sameCity: регистр, Ё = Е и пробелы по краям не важны, разные города — разные', () => {
    expect(sameCity('Орел', 'Орёл')).toBe(true);
    expect(sameCity(' тверь', 'Тверь')).toBe(true);
    expect(sameCity('Тверь', 'Тула')).toBe(false);
  });
});
