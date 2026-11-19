/**
 * Раздел `coach` (067-Р276, §9а): окна последних нажатий по буквам — источник «трудных клавиш» (Клуб, панель Базы,
 * «Минута тренера»). Пишут только итог матча и итог минуты (`applyKeys`); игры Базы и учебные — нет (067-Р272).
 * Миграции нет: раздела в старом сохранении нет — он пуст (067-Р277).
 */
import cfg from '../../content/match.json';
import { isRecord, type SectionDef } from '../save/section';

/** Ключ — строчная буква (ожидаемый знак); значение — окно `'1'`/`'0'` последних нажатий, старые слева, ≤ `form.window`. */
export interface CoachKeys {
  keys: Record<string, string>;
}

/** Сколько букв раздел вмещает (с запасом на кириллицу и латиницу вместе). */
export const MAX_KEYS = 64;
/** Ключ раздела — одна строчная буква: одно правило для записи (`applyKeys`) и проверки (`check`), иначе раздел уйдёт в карантин. */
export const LETTER = /^\p{Ll}$/u;

export const emptyCoach = (): CoachKeys => ({ keys: {} });

export const coachDef: SectionDef<CoachKeys> = {
  name: 'coach',
  v: 1,
  empty: emptyCoach,
  up: {},
  check(d) {
    if (!isRecord(d) || !isRecord(d.keys)) return ['shape'];
    const entries = Object.entries(d.keys);
    if (entries.length > MAX_KEYS) return ['keys:count'];
    for (const [ch, w] of entries) {
      if (!LETTER.test(ch)) return ['keys:ch'];
      if (typeof w !== 'string' || !/^[01]*$/.test(w) || w.length > cfg.form.window) return ['keys:w'];
    }
    return [];
  },
};
