/**
 * Ссылки для взрослого (068 Т9-2, 068-Р10, Р11): отзыв — Telegram и форма, донат — шов с пустым адресом (ссылка скрыта).
 */
import { describe, expect, it } from 'vitest';
import { parentLinks, playerMenu } from '../../src/engine/support';
import cfg from '../../src/content/support.json';
import { ru } from '../../src/i18n/ru';

const full = { telegram: 'https://t.me/x', form: 'https://forms.gle/y', donate: 'https://pay.example/z' };

describe('ссылки для взрослого', () => {
  it('068-Т9-К19 отзыв — Telegram и форма, затем донат; порядок стабилен', () => {
    // Ловит: пропавший путь отзыва (владелец 19.11: Telegram + форма) и смену порядка блока.
    expect(parentLinks(full).map((l) => l.kind)).toEqual(['telegram', 'form', 'donate']);
  });

  it('068-Т9-К19 донат — шов: адрес в support.json пуст, ссылка скрыта; пустая форма — тоже', () => {
    // Ловит: ссылка «поддержать» без адреса (068-Р11) и пустая строка формы, показанная как ссылка.
    expect(cfg.donate.url).toBe('');
    expect(parentLinks({ telegram: ru.system.telegram.url, form: ru.system.form.url, donate: cfg.donate.url }).map((l) => l.kind)).toEqual(['telegram', 'form']);
    expect(parentLinks({ ...full, donate: '' }).map((l) => l.kind)).toEqual(['telegram', 'form']);
    expect(parentLinks({ ...full, form: '  ' }).map((l) => l.kind)).toEqual(['telegram', 'donate']);
  });

  it('068-Т9-К19 край: нет ни одного адреса — блока нет; не-https (javascript:, http:) отбрасывается', () => {
    // Ловит: пустая строка «Взрослым:» без ссылок и опасная схема из JSON, ставшая href.
    expect(parentLinks({ telegram: '', form: '', donate: '' })).toEqual([]);
    expect(parentLinks({ telegram: 'javascript:alert(1)', form: 'http://x.example', donate: '//x.example' })).toEqual([]);
  });
});

describe('меню игрока в шапке (068-Р82)', () => {
  const src = { telegram: ru.system.telegram.url, form: ru.system.form.url, donate: cfg.donate.url };

  it('068-Т9-6а меню: «Сменить игрока», «Что нового», «Старая версия» — всегда, в этом порядке; взрослому — отзыв и форма без доната', () => {
    // Ловит: пропавший пункт меню (нельзя сменить игрока или уйти на v1) и «поддержать игру» без адреса при пустом шве доната.
    const m = playerMenu(src);
    expect(m.actions).toEqual(['change', 'news', 'old']);
    expect(m.adults.map((l) => l.kind)).toEqual(['telegram', 'form']);
    expect(playerMenu(full).adults.map((l) => l.kind)).toEqual(['telegram', 'form', 'donate']);
  });

  it('068-Т9-6а меню: адресов для взрослого нет — раздел пуст (ни разделителя, ни подписи), действия остаются', () => {
    // Ловит: пустой раздел «Взрослым:» с разделителем без ссылок и пропажу действий игрока вместе с ним.
    const m = playerMenu({ telegram: '', form: '', donate: '' });
    expect(m.adults).toEqual([]);
    expect(m.actions).toHaveLength(3);
  });
});
