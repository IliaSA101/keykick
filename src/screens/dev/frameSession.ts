/**
 * Сеанс стенда кадров (065 К-Г): фикстура `tests/fixtures/accepted/<id>.json` → сеанс в памяти. Хранилище браузера не трогаем:
 * ключи — в `Map`, замков нет. Только для разработки и теста (`tests/accepted/fixtures.test.ts`); в выпускную сборку не входит.
 */
import type { CoachFrame } from '../../app/coach/frame';
import type { SchoolStand } from '../../app/school/frame';
import type { LearnFrame } from '../../app/learn/frame';
import type { PathStand } from '../path/stand';
import type { Rhythm } from '../../app/day/useResultDay';
import { createBin } from '../../app/save/bin';
import { createSession, type Session } from '../../app/save/session';
import { createKeyValue, type Backend } from '../../app/save/storage';
import { createStore, newDevice } from '../../app/save/store';
import { SECTIONS } from '../../app/save/sections';
import { prefix } from '../../engine/release/keys';
import type { KeepyStand } from '../../app/base/keepy';
import type { FreeStand } from '../../app/base/free';
import type { KeeperStand } from '../../app/base/keeper';
import type { MemoStand } from '../../app/base/memo';
import type { MiniStand } from '../../app/base/mini';
import { createPlayer, writePlayer } from '../../engine/save/envelope';

/** Состояние кадра: то, что пишет `tools/accepted/states.mjs`. */
export interface FrameFixture {
  id: string;
  codes: Record<string, string>;
  screen: string;
  /** Маршрут экрана, который стенд открывает в этом состоянии (`/home`, `/map`, `/match`, `/result`; Клуб, Музей, первый запуск — `/club`, `/museum`, `/start`; волна 4 — `/school`, `/school/tour`, `/school/kicks`, `/locker`, `/shop`, `/pack`, `/base`, `/base/<игра>`: до экрана их держит заглушка, стенд пишет «stub screen»). */
  route: string;
  state: string;
  clock: { now: number; day: string };
  /** Семя рассадки (одно на кадр, чтобы снимок повторялся). */
  seed: number;
  player: { pid: string; name: string };
  sections: Record<string, unknown>;
  /** Дом и Карта: вход правил из макета (`HomeInput`, К-Д) — для сверки экрана с одним источником. */
  home?: unknown;
  /** Путь клуба (067 Т10): вид входа, доля отъезда `t` и деление под мышью — стенд ставит их на экран. */
  path?: PathStand;
  /** Карта: кадр показывает переезд (автобус и плашка «Едем…», Э2.08/.09) — а не обычную карточку «На матч» (065 Т8г). */
  travel?: boolean;
  /** Карта: кадр с выбранным двором — номер ступени, окно уроков открыто (Э2.11, Э2.36); в игре окно открывает клик или стрелка. */
  mapPick?: number;
  /** Карта: окно поверх неё — «Лист лиги» (`sheet`) или «Карточка клуба» (`club`, Э2.30/.31/.37/.38); в игре его открывает чип или адрес `?win=`. */
  mapWindow?: 'sheet' | 'club';
  /** Матч и итог: что кадр показывает сверх разделов (Т9/Т10 дописывают). */
  match?: unknown;
  /** «Минута тренера» (067 Т25): шаг кадра, ход минуты и итог. */
  coach?: CoachFrame;
  /** Итог: готовый вид итога (`ResultView`), счёт 1-го тайма, номер урока и улица кадра (Т10а). */
  result?: unknown;
  /** Игрового дня в макете не было — взят образец. */
  dayGuess?: boolean;
  /** Страница родителя и окна (063 Т11): все игроки устройства по порядку (первый — игрок вкладки, его `sections` дублируют верхние) и день последней выгрузки. */
  players?: { pid: string; name: string; sections: Record<string, unknown>; binned?: string }[];
  exportedAgo?: number;
  /** Страница родителя (063-Р65): `player` — второй игрок списка (`p2`) записан битым файлом (строка «не открывается» и «Начать заново»); `device` — битым записано само устройство («Новый клуб»; сеанс без игрока, статус `broken`). */
  broken?: 'player' | 'device';
  /** Страница родителя, «Загрузить файл»: файл, выбранный на кадре (`made` — ISO-время выгрузки, `players` — игроки файла). */
  file?: { made: string; players: { pid: string; name: string; sections: Record<string, unknown> }[] };
  /** Страница родителя, кадры корзины (063 Т12): вкладка, шаг блока «Игроки» (`ask`, `clear`, `back` — вернуть из корзины) и прокрутка к нему. */
  stand?: { tab?: string; step?: 'ask' | 'clear' | 'back'; scroll?: 'players' };
  /** Окно «Клуб» (067 Т11): трудные клавиши кадра (в сохранении их нет) и открытое окно — «Твой клуб» (`edit`) или смена тренера (`swap`). */
  club?: { hardKeys?: string[]; win?: 'edit' | 'swap' };
  /** Музей (067 Т11): id купленных вещей каталога и открытые ролики кадра (в сохранении их пока нет). */
  museum?: { bought?: string[] };
  /** Лавка (067 Т12): вещь, чьё подтверждение покупки открыто на кадре (Э2К.03). */
  shop?: { ask?: string };
  /** Стенд пака (067 Т12): фаза, с которой экран начинает; нет ключа — закрытый пак, как в игре. */
  pack?: { phase?: 'shown' };
  /** Раздевалка (067 Т13): окно, открытое на кадре, — «Рассмотреть» (`kit`, `start` — стартовая форма) или «Игроки» (`players`); нет ключа — стенд альбома. */
  locker?: { view?: 'kit' | 'players'; start?: string };
  /** Школа (067 Т14): строка журнала под мышью (Э3.11) и шаг тура, на котором стенд открывает экран тура (Э3.19–23, Э3.39–42). */
  school?: SchoolStand;
  /** Первый запуск (`/start`): шаг, на котором стенд открывает экран (Э2К.34 — тренер, Э2К.41 — приветствие). */
  start?: { step: 'coach' | 'greet' };
  /** Учебная игра 1–4 (067 Т17, Э8): окно поверх перерыва (`/match`) или Базы (`/base`) — игра, место, шаг, промахи и время; состояние даёт `frameFlow`. */
  learn?: LearnFrame;
  /** Учебная игра: номер урока ребёнка и его выученные буквы (`keys` урока пакета; пакет в сборку не входит). */
  learnCtx?: { lesson: number; keys: string };
  /** База (067 Т19): кадр доски рекордов открывает вид с рекордами (`board`), `cup` — Кубок сыгран (Штрафной открыт, 067-Р18); в игре ключа нет. */
  base?: { board?: boolean; cup?: boolean; keepy?: KeepyStand; memo?: MemoStand; mini?: MiniStand; keeper?: KeeperStand; free?: FreeStand };
  /** Кубок (068 Т5, `/cup`): открытая вкладка, команда под мышью (подсказка Э5.22) и праздничная доска титула (Э5.20). */
  tab?: 'group' | 'bracket';
  hover?: string;
  festive?: boolean;
  /** Матч Кубка (068 Т6, `/match` и `/result`): раунд, шаг вступления (`intro`, `play`, `extra`) и счёт кадра итога (`cup-frames.mjs`). */
  cupFrame?: { round: 'g1' | 'g2' | 'g3' | 'r16' | 'qf' | 'sf' | 'f'; step?: string; score?: [number, number]; correct?: number; series?: 'w' | 'l'; award?: boolean; rhythm?: Rhythm; open?: 'summary' };
  /** Окно поверх экрана: «Игра обновилась» без списка или со списком «Что нового». */
  window?: { kind: 'updated' | 'news'; lines?: string[] };
  /**
   * Сюжет (068 Т7): окно поверх экрана — комикс (`comic`, `panel`, `coachBoard`), выпуск газеты (`paper`, `silver`, `archive` — из архива Музея),
   * стенд на Доме (`stand`), доска выпусков (`board`), пузырь тренера (`bubble`), нижняя строка (`foot`); `longName` и `longCity` — длинные имя и город
   * клуба для кадра края (в сохранении имя ≤ 20 знаков). Окна газеты рисует стенд поверх экрана кадра без записи в сеанс.
   */
  story?: {
    window?: { comic?: string; panel?: number; coachBoard?: boolean; paper?: number; silver?: boolean; archive?: boolean; stand?: boolean; board?: string; bubble?: string; foot?: string };
    longName?: string;
    longCity?: string;
  };
}

/** Хранилище в памяти. */
function memoryBackend(): Backend {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** Сеанс с одним игроком, разделы — из фикстуры. Часы и случайность — из фикстуры, браузерных не берём. */
export async function frameSession(fx: FrameFixture): Promise<Session> {
  const keys = prefix(2, 'next');
  const disk = memoryBackend();
  const store = createStore({ prefix: keys, local: createKeyValue(disk), session: createKeyValue(memoryBackend()) });
  const list = fx.players ?? [{ pid: fx.player.pid, name: fx.player.name, sections: fx.sections }];
  for (const e of list) store.savePlayer(e.pid, writePlayer(createPlayer({ pid: e.pid, name: e.name, course: 'ru', explain: 'ru' }, SECTIONS), e.sections), null);
  const dev = newDevice();
  const exported = fx.exportedAgo === undefined ? {} : { exported: new Date(Date.parse(fx.clock.day) - fx.exportedAgo * 86400e3).toISOString().slice(0, 10) };
  store.saveDevice({ ...dev, rev: 1, players: list.map((e, order) => ({ pid: e.pid, order })), parent: { ...dev.parent, ...exported } }, null);
  // игрок в корзине: конверт под `trash.*`, день удаления — в устройстве (как после настоящего «Удалить»)
  const bin = createBin({ store });
  for (const e of list) if (e.binned !== undefined) await bin.remove(e.pid, e.binned);
  if (fx.broken === 'player' && list[1]) disk.setItem(`${keys}player.${list[1].pid}`, `{"name":${JSON.stringify(list[1].name)},"rev":4}`); // оборванная запись: имя читается, конверт — нет
  if (fx.broken === 'device') disk.setItem(`${keys}device`, '{broken json'); // оборванная запись устройства: файлы игроков целы, список не читается
  store.setTabPid(fx.player.pid); // игрок вкладки известен и при двух игроках (на странице родителя — «играет в этой вкладке»)
  const session = createSession({ store, newPid: () => `p${String(fx.seed).padStart(10, '0')}` });
  await session.init();
  return session;
}
