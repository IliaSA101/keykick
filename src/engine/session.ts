/**
 * Время игры и перерыв (как в «СОЛО», для ребёнка короче): после N минут активной игры —
 * перерыв на M минут. Чистые функции: часы (now, мс) и местную дату (today, «ГГГГ-ММ-ДД»)
 * передаёт app-слой.
 *
 * Активное время — промежутки между действиями (нажатия, клики) не длиннее IDLE_MS.
 * Пауза длиннее — сеанс прерван, промежуток не считается; пауза не короче перерыва —
 * ребёнок и так отдохнул, счёт до перерыва начинается заново.
 *
 * Перерыв не обрывает тайм: набралось время — перерыв «назначен» (breakDue) и начинается
 * на следующем переходе экрана (startBreakIfDue зовёт app-слой).
 */

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;
/** Без действий дольше — сеанс прерван, время не растёт. */
export const IDLE_MS = 4 * MINUTE_MS;
/** Сколько дней хранить: неделя для родителя и запас. */
export const KEEP_DAYS = 14;

export const PLAY_MINUTES = [10, 15, 20, 25] as const;
export const BREAK_MINUTES = [3, 5, 10] as const;
export type PlayMinutes = (typeof PLAY_MINUTES)[number];
export type BreakMinutes = (typeof BREAK_MINUTES)[number];

export interface BreakSettings {
  enabled: boolean;
  playMinutes: PlayMinutes;
  breakMinutes: BreakMinutes;
}

/**
 * Часы перерыва — общие на компьютер (docs/design.md, 04.11, «несколько игроков»): смена игрока
 * не снимает перерыв и не обнуляет счёт до него. Время по дням — у каждого игрока своё (days).
 */
export interface BreakClock {
  /** Время последнего действия (мс от эпохи); null — сеанса нет. */
  lastAction: number | null;
  /** Активное время с прошлого перерыва, мс. */
  sinceBreak: number;
  /** Время набралось, перерыв начнётся на следующем переходе экрана. */
  breakDue: boolean;
  /** Конец идущего перерыва (мс от эпохи); null — перерыва нет. */
  breakUntil: number | null;
}

/** Сеанс для подсчётов: общие часы перерыва и время по дням текущего игрока. */
export interface SessionData extends BreakClock {
  /** Активное время по местным датам «ГГГГ-ММ-ДД», мс. */
  days: Record<string, number>;
}

/** Общая на компьютер часть: часы перерыва и настройки родителя (ключ 'keykick.session'). */
export interface SharedSession {
  clock: BreakClock;
  breakSettings: BreakSettings;
}

export function defaultBreakSettings(): BreakSettings {
  return { enabled: true, playMinutes: 15, breakMinutes: 5 };
}

export function emptySession(): SessionData {
  return { days: {}, lastAction: null, sinceBreak: 0, breakDue: false, breakUntil: null };
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Номер дня по календарю (без часового пояса); null — не дата. */
export function dayNumber(key: string): number | null {
  const m = DAY_KEY.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const first = Date.UTC(y, mo - 1, 1);
  // Дней в месяце — от первого числа до первого числа следующего: 31 февраля — битая дата.
  const inMonth = Math.round((Date.UTC(y, mo, 1) - first) / DAY_MS);
  if (mo < 1 || mo > 12 || d < 1 || d > inMonth) return null;
  return Math.round(first / DAY_MS) + d - 1;
}

function time(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}

function ms(v: unknown, max: number): number {
  const t = time(v);
  return t === null ? 0 : Math.min(t, max);
}

/** Битое поле — пустое, остальные живут; дней — не больше KEEP_DAYS последних. */
export function parseSession(v: unknown): SessionData {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return emptySession();
  const r = v as Record<string, unknown>;
  const days: Record<string, number> = {};
  if (r.days !== null && typeof r.days === 'object' && !Array.isArray(r.days)) {
    const ok = Object.entries(r.days as Record<string, unknown>)
      .map(([key, n]) => [key, ms(n, DAY_MS)] as const)
      .filter(([key, n]) => n > 0 && dayNumber(key) !== null)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, KEEP_DAYS);
    for (const [key, n] of ok) days[key] = n;
  }
  return {
    days,
    lastAction: time(r.lastAction),
    sinceBreak: ms(r.sinceBreak, DAY_MS),
    breakDue: r.breakDue === true,
    breakUntil: time(r.breakUntil),
  };
}

/** Часы перерыва без времени по дням. */
export function clockOf(s: SessionData): BreakClock {
  return { lastAction: s.lastAction, sinceBreak: s.sinceBreak, breakDue: s.breakDue, breakUntil: s.breakUntil };
}

export function emptyShared(): SharedSession {
  return { clock: clockOf(emptySession()), breakSettings: defaultBreakSettings() };
}

/**
 * Общая часть. Читает и свой формат ({ clock, breakSettings }), и старое сохранение одного игрока
 * (до 04.11: { session, breakSettings }) — так переносится идущий перерыв.
 */
export function parseShared(raw: unknown): SharedSession {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptyShared();
  const r = raw as Record<string, unknown>;
  return {
    clock: clockOf(parseSession(r.clock ?? r.session)),
    breakSettings: parseBreakSettings(r.breakSettings),
  };
}

export function parseBreakSettings(v: unknown): BreakSettings {
  const d = defaultBreakSettings();
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return d;
  const r = v as Record<string, unknown>;
  const play = PLAY_MINUTES.find((m) => m === r.playMinutes);
  const rest = BREAK_MINUTES.find((m) => m === r.breakMinutes);
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    playMinutes: play ?? d.playMinutes,
    breakMinutes: rest ?? d.breakMinutes,
  };
}

/**
 * Сколько осталось перерыва, мс; 0 — перерыва нет. Не больше длины перерыва:
 * часы, переведённые назад, не растягивают его.
 */
export function breakLeft(s: BreakClock, now: number, settings: BreakSettings): number {
  if (!settings.enabled || s.breakUntil === null) return 0;
  return Math.max(0, Math.min(s.breakUntil - now, settings.breakMinutes * MINUTE_MS));
}

/** Старые дни выкидываются: от today назад хранится KEEP_DAYS дней. */
function prune(days: Record<string, number>, today: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(days)) {
    const d = dayNumber(key);
    if (d !== null && d <= today && d > today - KEEP_DAYS) out[key] = n;
  }
  return out;
}

/** Действие ребёнка: прибавляет промежуток с прошлого действия, если сеанс не прерван. */
export function recordAction(s: SessionData, now: number, today: string, settings: BreakSettings): SessionData {
  const todayNum = dayNumber(today);
  if (todayNum === null) return s;
  if (breakLeft(s, now, settings) > 0) return s;
  // Перерыв кончился (или выключен) — сеанс начинается заново: время перерыва игрой не считается.
  const last = s.breakUntil === null ? s.lastAction : null;
  const gap = last === null ? null : now - last;
  let { sinceBreak, breakDue } = s;
  let days = s.days;
  if (gap !== null && gap >= 0 && gap <= IDLE_MS) {
    sinceBreak = Math.min(DAY_MS, sinceBreak + gap);
    days = { ...days, [today]: Math.min(DAY_MS, (days[today] ?? 0) + gap) };
  } else if (gap !== null && gap >= settings.breakMinutes * MINUTE_MS) {
    // Долгая пауза — уже отдых.
    sinceBreak = 0;
    breakDue = false;
  }
  if (settings.enabled && sinceBreak >= settings.playMinutes * MINUTE_MS) breakDue = true;
  return { days: prune(days, todayNum), lastAction: now, sinceBreak, breakDue, breakUntil: null };
}

/** Переход экрана: назначенный перерыв начинается. */
export function startBreakIfDue(s: SessionData, now: number, settings: BreakSettings): SessionData {
  if (!settings.enabled) return s.breakDue ? { ...s, breakDue: false } : s;
  if (!s.breakDue || breakLeft(s, now, settings) > 0) return s;
  return { ...s, breakDue: false, sinceBreak: 0, breakUntil: now + settings.breakMinutes * MINUTE_MS };
}

/** Перерыв кончился — снять его; следующее действие начнёт новый сеанс. */
export function finishBreakIfOver(s: SessionData, now: number, settings: BreakSettings): SessionData {
  if (s.breakUntil === null || breakLeft(s, now, settings) > 0) return s;
  return { ...s, breakUntil: null, lastAction: null };
}

/**
 * Родитель поменял настройки. Выключил — перерыв снят и не назначается;
 * укоротил игру — перерыв назначается сразу, если время уже набралось.
 */
export function applyBreakSettings(s: SessionData, settings: BreakSettings): SessionData {
  if (!settings.enabled) return { ...s, breakDue: false, breakUntil: null };
  const due = s.breakDue || s.sinceBreak >= settings.playMinutes * MINUTE_MS;
  return due === s.breakDue ? s : { ...s, breakDue: due };
}

/** Активное время за последние count дней по today включительно, мс. */
export function playedDays(s: Pick<SessionData, 'days'>, today: string, count: number): number {
  const t = dayNumber(today);
  if (t === null) return 0;
  let sum = 0;
  for (const [key, n] of Object.entries(s.days)) {
    const d = dayNumber(key);
    if (d !== null && d <= t && d > t - count) sum += n;
  }
  return sum;
}
