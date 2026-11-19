/**
 * Кадр матча для стенда (065 Т9г, К-Г): матч доигрывается верной печатью по строке исходов до нужного места — без часов реального
 * времени, клавиш и таймеров. Чистая функция: время — условное (шаг 300 мс), случайности нет (семя — в `start`).
 * Нужна `tools/accepted` и экрану в режиме `frame`: кадр «атака 4 из 4, счёт 2 : 1» не надо печатать руками.
 */
import { expectedHit } from '../../engine/typing/typing';
import type { Shown } from './effects';
import type { AfterGame } from '../break/cards';
import { feed, startRun, type Run } from './run';
import type { RunningMatch, StartEvent } from '../../engine/match';

/** Куда доиграть. `outcomes` — по символу на атаку плана: `k` — разминка, `g` — гол, `s` — вратарь отбил, `c` — гол соперника. */
export interface FrameSpec {
  outcomes: string;
  /** В текущей атаке допечатать верно столько строк (с нуля); `last` — стать на последнюю строку атаки. */
  row?: number | 'last';
  /** …и в строке столько знаков; без `until` и `chars` — стоим в начале строки. */
  chars?: number;
  /** Печатать дальше, пока цель не станет: `reach` — клавиша не под пальцем стойки (не А С В А О Л Д Ж), `space` — пробел. Ищет с текущего места. */
  until?: 'reach' | 'space';
  /** Знаков до конца строки не допечатывать: оставить столько (разминка: «строка допечатана», остался последний знак). */
  leave?: number;
  /** Пенальти у последней атаки: `ask` — стоим на листе (Э1.18), `hit` — верный ответ уже дан (Э1.19, счёт с голом). Без поля пенальти пропускается. */
  penalty?: 'ask' | 'hit';
  /**
   * Дойти до перерыва и остановиться в нём (067 Т18: окно учебной игры стоит поверх перерыва): недостающие атаки — разминка `k`,
   * первая атака первого тайма — гол, остальные — вратарь отбил; перерыв не доигрывается. Счёт перерыва — «1 : 0».
   */
  toBreak?: boolean;
}

/**
 * Что кадр стенда показывает вместо того, что даёт курс (065-Р96): в кадрах макета слоги и улица соперника — образец, а в курсе
 * Двора таких строк нет. Только DEV-стенд: в игре поля нет. Сверка мерит вёрстку, поэтому текст подставляем, а не подгоняем контент.
 */
export interface FrameShow {
  /** Текущая строка набора и сколько знаков в ней уже напечатано (`pos` = длина — строка допечатана, курсора нет). */
  text?: string;
  pos?: number;
  /** Следующие строки атаки. */
  next?: string[];
  /** «Строка N из M». */
  row?: { n: number; of: number };
  /** Код клавиши-цели (`KeyboardEvent.code`) и половина пробела; палец («Бей пальцем») выводится из карты клавиатуры. */
  target?: string;
  thumb?: 'left' | 'right';
  /** Название улицы соперника: «Двор на <улица>» (родительный падеж, как в `ru.home.rival`). */
  street?: string;
  /** Лист пенальти (065 Т10б): задача — id из `tasks.json` или своя целиком (длинная, Э1.20); `scrollEnd` — лист прокручен до конца; `verdict` — лист после ответа. */
  task?: string | Record<string, unknown>;
  scrollEnd?: boolean;
  verdict?: 'goal' | 'miss';
}

/** То, что хранит фикстура стенда `match` и принимает экран в проп `frame` (065 К-Г): номер урока, семя, состояние. */
export interface FrameMatch {
  lesson: number;
  seed: number;
  /** Вступление пройдено (кадр до «Начать» — `false`). */
  started: boolean;
  spec: FrameSpec;
  /** Возглас над воротами в кадре (в игре он живёт 1,6 с после удара). */
  shout?: Shown['shout'];
  /** Подстановка текста кадра (065-Р96). */
  show?: FrameShow;
  /** Плашка над вступлением (065 Т10г): `comeback` — «Капитан вернулся!» (Э1.25). */
  banner?: 'comeback';
  /** Поверх перерыва открыто окно учебной игры (его рисует стенд отдельно): клавиатуры и «Пауза» за окном нет, как в игре. */
  learn?: boolean;
  /** Перерыв «после игры» (Э4.17): итог сыгранной игры вместо карточек. */
  after?: AfterGame;
  /** «Права на компьютер» поверх перерыва (Э4.20): игра, давшая умение, отмечена «новое». */
  rights?: { fresh: string };
}

const STEP = 300;
/** Заведомо неверные знаки (ъ и ё — в уроках Двора их нет); записаны кодами, текстов интерфейса здесь нет. */
const HARD = '\u044a';
const SOFT = '\u0451';
/** Клавиши под пальцами в стойке (ФЫВА ОЛДЖ): всё остальное — тянуться к цели. */
const HOME = new Set(['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon']);

const running = (run: Run): RunningMatch => {
  if (run.state.phase === 'idle') throw new Error('frameRun: match not started');
  return run.state;
};

/** Верный знак цели: клавиша и символ — по карте клавиатуры начала матча. */
function right(run: Run, t: number): Run {
  const s = running(run);
  if (s.typing === null) return run;
  const hit = expectedHit(s.keymap, s.typing);
  return feed(run, { type: 'key', code: hit?.key.code ?? '', key: s.typing.text[s.typing.pos] ?? '', t }).run;
}

/** Неверное нажатие, пока ошибок в строке не станет больше (первое нажатие тайма игра прощает — тогда нажимаем ещё). */
function wrong(run: Run, t: number): Run {
  let r = run;
  const before = running(r).typing?.lineErrors ?? 0;
  for (let i = 0; i < 4 && (running(r).typing?.lineErrors ?? 0) === before; i++) {
    const want = running(r).typing?.text[running(r).typing?.pos ?? 0] ?? '';
    r = feed(r, { type: 'key', code: want === HARD ? 'Backquote' : 'BracketRight', key: want === HARD ? SOFT : HARD, t: t + i }).run;
  }
  return r;
}

/** Атака до конца: верно, а ошибки — в начале строки (`errors` неверных нажатий до первого верного). */
function playAttack(run: Run, errors: number, t0: number): { run: Run; t: number } {
  let r = run;
  let t = t0;
  const at = running(r).at;
  const phase = running(r).phase;
  for (let i = 0; i < errors; i++) r = wrong(r, (t += STEP));
  for (let guard = 0; guard < 5000; guard++) {
    const s = running(r);
    if (s.phase !== phase || s.at !== at) break;
    r = right(r, (t += STEP));
  }
  return { run: r, t };
}

/** Между атаками: перерыв — «Второй тайм», пенальти — «Не бить»; `keep` — пенальти оставить (последняя атака кадра с листом), `stay` — в перерыве остаться. */
function settle(run: Run, t0: number, keep = false, stay = false): { run: Run; t: number } {
  let r = run;
  let t = t0;
  for (let i = 0; i < 4; i++) {
    const s = running(r);
    if (s.phase === 'break' && !stay) r = feed(r, { type: 'half2', t: (t += s.rules.breakMs + STEP) }).run;
    else if (s.phase === 'penalty' && !keep) r = feed(r, { type: 'penalty', t: (t += STEP), answer: 'skip' }).run;
    else break;
  }
  return { run: r, t };
}

const reach = (s: RunningMatch): boolean => {
  const hit = s.typing === null ? null : expectedHit(s.keymap, s.typing);
  return hit !== null && hit.key.finger !== 'th' && !HOME.has(hit.key.code);
};
const onSpace = (s: RunningMatch): boolean => (s.typing === null ? false : s.typing.text[s.typing.pos] === ' ');

/** Доиграть матч `start` до места `spec` верной печатью; несовместимое с планом урока — ошибка (кадр не соберётся тихо неверным). */
export function frameRun(start: StartEvent, spec: FrameSpec): Run {
  const { concedeMin } = running(startRun(start).run).rules;
  let r = startRun(start).run;
  let t = 1000;
  for (const [i, o] of [...spec.outcomes].entries()) {
    const s = running(r);
    if (s.phase === 'break') throw new Error(`frameRun: outcome ${i} after break`); // исходы за перерывом — не молча отбрасываем
    const warm = s.phase === 'warmup';
    if (o === 'k' !== warm) throw new Error(`frameRun: outcome ${i} '${o}' does not fit phase '${s.phase}'`);
    if (!'kgsc'.includes(o)) throw new Error(`frameRun: unknown outcome '${o}'`);
    const done = playAttack(r, o === 's' ? 1 : o === 'c' ? concedeMin : 0, t);
    // `toBreak`: исходы покрыли весь первый тайм — в перерыве остаёмся, а не уходим во второй тайм
    const next = settle(done.run, done.t, spec.penalty !== undefined && i === spec.outcomes.length - 1, spec.toBreak === true);
    r = next.run;
    t = next.t;
  }
  if (spec.toBreak === true) {
    for (let guard = 0; guard < 200 && running(r).phase !== 'break'; guard++) {
      const s = running(r);
      if (s.phase !== 'warmup' && s.phase !== 'half1') throw new Error(`frameRun: no break before phase '${s.phase}'`);
      const done = playAttack(r, s.phase === 'half1' && s.log.some((a) => a.phase === 'half1') ? 1 : 0, t);
      const next = settle(done.run, done.t, false, true);
      r = next.run;
      t = next.t;
    }
    return r;
  }
  if (spec.penalty !== undefined) {
    if (running(r).phase !== 'penalty') throw new Error('frameRun: no penalty after the last outcome');
    if (spec.penalty === 'hit') r = feed(r, { type: 'penalty', t: (t += STEP), answer: 'hit' }).run;
  }
  for (let guard = 0; guard < 5000; guard++) {
    const s = running(r);
    if (s.typing === null) break;
    const rows = spec.row === 'last' ? (s.plan[s.at]?.rows.length ?? 1) - 1 : (spec.row ?? 0);
    const lastKey = s.typing.pos >= s.typing.text.length - 1;
    const wantRow = s.row < rows;
    const wantChars = s.row === rows && s.typing.pos < (spec.chars ?? 0);
    const wantUntil = spec.until !== undefined && s.row >= rows && !(spec.until === 'reach' ? reach(s) : onSpace(s)) && s.typing.pos < s.typing.text.length - 1;
    const wantLeave = spec.leave !== undefined && s.row >= rows && s.typing.pos < s.typing.text.length - spec.leave;
    if (!wantRow && !wantChars && !wantUntil && !wantLeave) break;
    if (lastKey && !wantRow && !wantLeave) break;
    r = right(r, (t += STEP));
  }
  const end = running(r);
  if (spec.until !== undefined && !(spec.until === 'reach' ? reach(end) : onSpace(end))) throw new Error(`frameRun: no '${spec.until}' target in the attack`);
  return r;
}
