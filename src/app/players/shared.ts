/**
 * Общая на компьютер часть: часы перерыва и его настройки (ключ `shared`, не в сохранении игрока).
 * Хранилище — через app/storage: недоступно — игра идёт дальше, просто без сохранения.
 * Время игры по дням (`days`) в v2 не пишется: раздел дня придёт с 040 (018-Р28), блок у родителя скрыт.
 *
 * Снаружи часть только читают; меняют — функциями ниже, каждая сразу сохраняет.
 */
import { reactive } from 'vue';
import {
  applyBreakSettings,
  clockOf,
  emptySession,
  finishBreakIfOver,
  parseShared,
  recordAction,
  startBreakIfDue,
  type BreakClock,
  type BreakSettings,
  type SessionData,
  type SharedSession,
} from '../../engine/session';
import { saveStore } from '../save/instance';
import { SHARED_KEY, onKeyChange, readJson, writeJson } from '../storage';

const sharedState = reactive<SharedSession>(parseShared(readJson(SHARED_KEY)));

/** Общая на компьютер часть: часы перерыва и его настройки. Только чтение. */
export const shared: Readonly<SharedSession> = sharedState;

function persistShared(): void {
  // Сохранение новее программы — не пишем ничего, в том числе общую часть (design §5).
  if (saveStore.status().readOnly) return;
  writeJson(SHARED_KEY, { clock: { ...sharedState.clock }, breakSettings: { ...sharedState.breakSettings } });
}

// Другая вкладка начала или сняла перерыв — он общий, видим его и здесь.
onKeyChange(SHARED_KEY, () => {
  Object.assign(sharedState, parseShared(readJson(SHARED_KEY)));
});

/** Сеанс для движка: общие часы перерыва; дни движок считает вхолостую, мы их не храним. */
function sessionNow(): SessionData {
  return { ...emptySession(), ...sharedState.clock };
}

function sameClock(a: BreakClock, b: BreakClock): boolean {
  return (
    a.lastAction === b.lastAction &&
    a.sinceBreak === b.sinceBreak &&
    a.breakDue === b.breakDue &&
    a.breakUntil === b.breakUntil
  );
}

/**
 * Сеанс меняется на каждое действие ребёнка: подменяем часы только если они сменились, чтобы экраны
 * не перерисовывались от каждого нажатия. Движок возвращает тот же объект, если менять нечего, — тогда и не пишем.
 */
function commitSession(step: (cur: SessionData) => SessionData): void {
  const cur = sessionNow();
  const next = step(cur);
  if (next === cur) return;
  const clock = clockOf(next);
  if (!sameClock(clock, sharedState.clock)) {
    sharedState.clock = clock;
    persistShared();
  }
}

/** Чаще не пишем: промежуток короче всё равно войдёт в следующий, счёт не теряется. */
const ACTION_WRITE_MS = 2000;

/** Действие ребёнка (нажатие, клик): копит время до перерыва и назначает перерыв. */
export function noteAction(now: number, today: string): void {
  const { lastAction: last, breakUntil } = sharedState.clock;
  if (last !== null && now >= last && now - last < ACTION_WRITE_MS && breakUntil === null) return;
  commitSession((cur) => recordAction(cur, now, today, sharedState.breakSettings));
}

/** Переход экрана: назначенный перерыв начинается. */
export function beginDueBreak(now: number): void {
  commitSession((cur) => startBreakIfDue(cur, now, sharedState.breakSettings));
}

/** Перерыв кончился — снять. */
export function endBreakIfOver(now: number): void {
  commitSession((cur) => finishBreakIfOver(cur, now, sharedState.breakSettings));
}

/** Настройки перерыва — общие на компьютер, как и сам перерыв. */
export function setBreakSettings(next: BreakSettings): void {
  const settings = { ...next };
  sharedState.breakSettings = settings;
  sharedState.clock = clockOf(applyBreakSettings(sessionNow(), settings));
  persistShared();
}
