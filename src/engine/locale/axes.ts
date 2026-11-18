/**
 * Три оси языка (060-Т10, 059-В9). Чистая функция: ничего не читает снаружи.
 *   ui      — язык интерфейса, на устройстве (`device.uiLang`);
 *   course  — курс игрока: раскладка и материал;
 *   explain — язык советов и текстов контента, у игрока; обязан быть среди `course.explain`.
 * Курс принимается структурно: тип из content/schema/course.ts подойдёт без правок (сводит оркестратор после Т2).
 */

export interface AxesDevice {
  uiLang: string;
}

export interface AxesPlayer {
  /** Выбранный язык пояснений; нет — берём язык интерфейса, если курс его знает. */
  explain?: string | undefined;
}

export interface AxesCourse {
  id: string;
  explain: readonly string[];
}

export interface Axes {
  ui: string;
  course: string;
  explain: string;
}

export function resolveAxes(device: AxesDevice, player: AxesPlayer, course: AxesCourse): Axes {
  const first = course.explain[0];
  if (first === undefined) throw new Error(`course "${course.id}": empty explain list`);
  const known = (lang: string): boolean => course.explain.includes(lang);
  // Выбор игрока вне списка курса — первый язык курса; выбора нет — язык интерфейса, если курс его знает.
  const wanted = player.explain ?? device.uiLang;
  return { ui: device.uiLang, course: course.id, explain: known(wanted) ? wanted : first };
}
