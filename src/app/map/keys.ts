/**
 * Клавиатура карты (спека 019, design §5.3, ТЗ-0.16, К13): что делать на нажатие. Чистая функция без DOM — экран
 * только применяет ответ. Куда уходит фокус, решает `engine/map/focus` (`nextFocus`); здесь — Enter, Esc и край.
 *
 * 019-Р18: если `nextFocus` ответил «на месте» (`null`) — Tab не забирается (`native`), браузер сам уводит фокус
 * дальше: Tab с шапки и Shift+Tab с первой точки покидают карту, а не застревают в ней.
 */
import { HEADER_FOCUS, nextFocus } from '../../engine/map/focus';
import { isPlayablePoint, type MapModel } from '../../engine/map/model';

export type KeyAction =
  /** Не наше: браузер делает своё (Tab из карты, Esc при закрытой карточке, любая другая клавиша). */
  | { do: 'native' }
  /** Клавишу забрать, ничего не менять (край ряда, повтор Enter при удержании). */
  | { do: 'stay' }
  | { do: 'focus'; id: string }
  | { do: 'open' }
  | { do: 'close' }
  | { do: 'play'; id: string };

export interface KeyContext {
  /** id в фокусе (`data-focus` ближайшего элемента) или `null`, если фокус на чём-то без id (кнопка карточки). */
  from: string | null;
  /** Последний выбранный элемент: от него идут стрелки, когда фокус ушёл на кнопку карточки. */
  active: string;
  shift: boolean;
  repeat: boolean;
  cardOpen: boolean;
  /** Есть ли на экране элемент с таким id (шапки в Т7 нет — тогда Tab на неё не забирается). */
  exists: (id: string) => boolean;
}

export function keyAction(model: MapModel, key: string, o: KeyContext): KeyAction {
  if (key === 'Escape') return o.cardOpen ? { do: 'close' } : { do: 'native' };

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    // Стрелки внутри шапки (кнопки, поля) — её собственные: карта их не забирает.
    if (o.from === HEADER_FOCUS) return { do: 'native' };
    const to = nextFocus(model, o.from ?? o.active, key === 'ArrowLeft' ? 'left' : 'right');
    return to !== null && o.exists(to) ? { do: 'focus', id: to } : { do: 'stay' };
  }

  if (key === 'Tab') {
    if (o.from === null) return { do: 'native' };
    const to = nextFocus(model, o.from, o.shift ? 'shiftTab' : 'tab');
    return to !== null && o.exists(to) ? { do: 'focus', id: to } : { do: 'native' };
  }

  if (key === 'Enter') {
    // Enter на кнопках шапки — их собственное нажатие (иначе «Путь клуба» не нажать с клавиатуры).
    if (o.from === null || o.from === HEADER_FOCUS) return { do: 'native' };
    if (o.repeat) return { do: 'stay' };
    if (!o.cardOpen) return { do: 'open' };
    const point = model.points.find((p) => p.id === o.from);
    return point && isPlayablePoint(point) ? { do: 'play', id: point.id } : { do: 'stay' };
  }

  return { do: 'native' };
}
