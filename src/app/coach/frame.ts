/** Кадр стенда «Минуты тренера» (067 Т25, Э4.11–14): шаг и то, чего в сохранении нет — идущая минута и итог. В игре поля нет. */
import type { MinuteView } from '../../engine/match';

export interface CoachFrame {
  step: 'start' | 'play' | 'end';
  /** Идёт минута: строка, следующая строка, сколько набрано, где промахи, осталось мс, верно и ошибок. */
  play?: { text: string; next: string; pos: number; missed: number[]; leftMs: number; correct: number; errors: number };
  /** Итог: `MinuteView` и число ошибок. */
  end?: { view: MinuteView; errors: number };
}
