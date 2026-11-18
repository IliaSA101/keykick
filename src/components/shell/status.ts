/**
 * Состояние сеанса для плашек оболочки (контракт Т4 ↔ Т5, 063 §2). Тип — свой: оболочка не знает моста сохранения,
 * мост не знает компонентов; совпадение значений держит тест `tests/shell/shell.test.ts`.
 */
import { ru } from '../../i18n/ru';

export type ShellStatus = 'ok' | 'busy' | 'readonly' | 'quota' | 'conflict' | 'broken';

export interface Notice {
  status: Exclude<ShellStatus, 'ok'>;
  text: string;
  /** Мелкая строка под текстом. */
  hint?: string;
}

/** Плашка для состояния: `ok` — нет плашки. `playerName` — имя игрока вкладки (нужно `busy`: «Миша уже играет в другой вкладке»). */
export function noticeFor(status: ShellStatus, playerName: string): Notice | null {
  const n = ru.frame.notice;
  switch (status) {
    case 'ok':
      return null;
    case 'busy':
      return { status, text: playerName === '' ? n.busyAnon : `${playerName} ${n.busyTail}`, hint: n.busyHint };
    case 'readonly':
      return { status, text: n.readonly };
    case 'quota':
      return { status, text: n.quota };
    case 'conflict':
      return { status, text: n.conflict };
    case 'broken':
      return { status, text: n.broken };
  }
}
