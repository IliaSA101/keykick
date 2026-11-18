/**
 * Эффекты движка → что делает экран (065 Т9, ТЗ-11.24 звук): звук по имени, возглас над воротами, вспышка счёта, пенальти.
 * Чистая функция: звук играет экран, «Без звука» гасит всё (`mute`). Пенальти и итог доводит до маршрута Т10.
 */
import type { Effect, SoundName } from '../../engine/match';

/** Файлы звука в `public/art/sfx`: у матча их пять, остальные имена звука — тишина (ключ и промах — тоже без файла). */
export const SFX: Readonly<Partial<Record<SoundName, string>>> = {
  goal: 'goal.mp3',
  concede: 'groan.mp3',
  save: 'kick.mp3',
  whistle: 'whistle-end.mp3',
};

export interface Shown {
  /** Возглас над воротами: `goal` — «ГОЛ!», `save`, `concede`, `warm` — «В сетку!»; нет — ничего. */
  shout: 'goal' | 'save' | 'concede' | 'warm' | null;
  /** Чей счёт подпрыгивает на табло. */
  bump: 'us' | 'rival' | null;
  /** Файлы звука по порядку. */
  sounds: string[];
  /** Пора показать пенальти (Т10). */
  penalty: boolean;
}

export const quiet = (): Shown => ({ shout: null, bump: null, sounds: [], penalty: false });

/** `warmupEnd` — в этом шаге закончилась разминка (удар по пустым воротам, «В сетку!»); `mute` — звук выключен. */
export function shownOf(effects: readonly Effect[], opts: { warmupEnd?: boolean; mute?: boolean } = {}): Shown {
  const out = quiet();
  if (opts.warmupEnd === true) out.shout = 'warm';
  for (const e of effects) {
    if (e.kind === 'goal') {
      out.shout = e.side === 'me' ? 'goal' : 'concede';
      out.bump = e.side === 'me' ? 'us' : 'rival';
    } else if (e.kind === 'sound') {
      if (e.sound === 'save') out.shout = 'save';
      const file = SFX[e.sound];
      if (file !== undefined && opts.mute !== true) out.sounds.push(file);
    } else if (e.kind === 'penalty') out.penalty = true;
  }
  return out;
}
