/**
 * Тренер клуба (спека 019, design §2, Р12): разбор `content/coach.json` и показ по id.
 * Незнакомый или пустой id в сохранении хранится как есть, а показывается тренер по умолчанию.
 */

export interface CoachInfo {
  id: string;
  name: string;
  /** Приветствие в пузыре на карте до первого доигранного матча. */
  greet: string;
}

export interface CoachData {
  coaches: CoachInfo[];
  /** id тренера по умолчанию (всегда есть в `coaches`). */
  defaultId: string;
}

function text(v: unknown, where: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`coach.${where}: expected non-empty string`);
  return v;
}

/** Разбор из content: ошибка в данных падает в тесте, а не на экране. */
export function parseCoachData(raw: unknown): CoachData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const list = r.coaches;
  if (!Array.isArray(list) || list.length === 0) throw new Error('coach.coaches: expected non-empty array');
  const coaches = list.map((c: unknown, n): CoachInfo => {
    const x = (c ?? {}) as Record<string, unknown>;
    return {
      id: text(x.id, `coaches[${n}].id`),
      name: text(x.name, `coaches[${n}].name`),
      greet: text(x.greet, `coaches[${n}].greet`),
    };
  });
  if (new Set(coaches.map((c) => c.id)).size !== coaches.length) throw new Error('coach.coaches: duplicate id');
  const defaultId = text(r.default, 'default');
  if (!coaches.some((c) => c.id === defaultId)) throw new Error('coach.default: unknown id');
  return { coaches, defaultId };
}

/** Тренер по умолчанию. */
export function defaultCoach(data: CoachData): CoachInfo {
  const found = data.coaches.find((c) => c.id === data.defaultId);
  if (!found) throw new Error('coach.default: unknown id');
  return found;
}

/** Тренер для показа: по id из сохранения; пустой или незнакомый — по умолчанию. */
export function coachOf(data: CoachData, id: string): CoachInfo {
  return data.coaches.find((c) => c.id === id) ?? defaultCoach(data);
}
