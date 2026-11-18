/**
 * Реестр id курса и его правила (060 §2, 059-Р7). Чистые функции: живые id приходят из контента снаружи,
 * каждая проверка возвращает список замечаний (пусто — годен), как схемы в `content/schema`.
 */
import { ID_RE } from '../../content/schema/ids';
import type { Registry } from '../../content/schema/ids';

/** Правило 1: id в контенте уникальны и по формату; `prefix` — `ru.` курса или `ru.yard.` пакета (если задан). */
export function checkLiveIds(live: readonly string[], prefix = ''): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const id of live) {
    if (!ID_RE.test(id)) errs.push(`id "${id}": bad format, want <course>.<league>.<word>`);
    else if (prefix !== '' && !id.startsWith(prefix)) errs.push(`id "${id}": outside ${prefix}`);
    if (seen.has(id)) errs.push(`id "${id}": duplicate`);
    seen.add(id);
  }
  return errs;
}

/**
 * Наследник снятого id: идём по цепочке до живого. `null` — наследника нет (цепочка кончилась на `null`,
 * на неизвестном id или замкнулась в цикл). Живой id возвращает сам себя.
 */
export function resolveHeir(reg: Registry, live: ReadonlySet<string>, id: string): string | null {
  const seen = new Set<string>();
  let cur: string | null = id;
  while (cur !== null) {
    if (live.has(cur)) return cur;
    if (seen.has(cur) || !Object.hasOwn(reg.retired, cur)) return null;
    seen.add(cur);
    cur = reg.retired[cur] ?? null;
  }
  return null;
}

/** Правила 2–4: связь реестра с живым контентом. */
export function checkRegistry(reg: Registry, live: readonly string[]): string[] {
  const errs: string[] = [];
  const liveSet = new Set(live);
  const retired = Object.keys(reg.retired);
  // (2) выпущенный id — живой или снят: выпущенное не пропадает молча.
  for (const id of reg.released) {
    if (!liveSet.has(id) && !Object.hasOwn(reg.retired, id)) errs.push(`released id "${id}" vanished: not in content, not in retired`);
  }
  // (4) id не живой и снятый одновременно.
  for (const id of retired) if (liveSet.has(id)) errs.push(`id "${id}" is both live and retired`);
  // (3) наследник — живой, снятый (цепочка) или null; цепочка без циклов и кончается живым или null.
  for (const old of retired) {
    const seen = new Set<string>([old]);
    let cur = reg.retired[old] ?? null;
    while (cur !== null && !liveSet.has(cur)) {
      if (seen.has(cur)) {
        errs.push(`heir chain from "${old}" is a cycle at "${cur}"`);
        break;
      }
      seen.add(cur);
      if (!Object.hasOwn(reg.retired, cur)) {
        errs.push(`dangling heir "${cur}" (chain from "${old}"): not live, not retired, not null`);
        break;
      }
      cur = reg.retired[cur] ?? null;
    }
  }
  return errs;
}

/** Правило 5: голден (список, записанный командой выпуска) целиком входит в `released` — список не сокращается. */
export function checkGolden(reg: Registry, golden: readonly string[]): string[] {
  const released = new Set(reg.released);
  return golden.filter((id) => !released.has(id)).map((id) => `golden id "${id}" disappeared from released`);
}

/** Правило 6: `order` пакета по длине равен `lessons` лиги в каркасе. Сумму каркаса проверяет `content.test.ts`. */
export function checkPackSize(order: readonly string[], frame: { id: string; lessons: number }): string[] {
  return order.length === frame.lessons ? [] : [`league ${frame.id}: frame ${frame.lessons} lessons, pack ${order.length}`];
}

/** Выпуск: к `released` дописываются живые id, которых там ещё нет (порядок прежних не меняется). Вход не меняется. */
export function releaseIds(reg: Registry, live: readonly string[]): Registry {
  const have = new Set(reg.released);
  const added = live.filter((id, i) => !have.has(id) && live.indexOf(id) === i);
  return { course: reg.course, released: [...reg.released, ...added], retired: { ...reg.retired } };
}
