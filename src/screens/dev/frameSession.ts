/**
 * Сеанс стенда кадров (065 К-Г): фикстура `tests/fixtures/accepted/<id>.json` → сеанс в памяти. Хранилище браузера не трогаем:
 * ключи — в `Map`, замков нет. Только для разработки и теста (`tests/accepted/fixtures.test.ts`); в выпускную сборку не входит.
 */
import { createBin } from '../../app/save/bin';
import { createSession, type Session } from '../../app/save/session';
import { createKeyValue, type Backend } from '../../app/save/storage';
import { createStore, newDevice } from '../../app/save/store';
import { SECTIONS } from '../../app/save/sections';
import { prefix } from '../../engine/release/keys';
import { createPlayer, writePlayer } from '../../engine/save/envelope';

/** Состояние кадра: то, что пишет `tools/accepted/states.mjs`. */
export interface FrameFixture {
  id: string;
  codes: Record<string, string>;
  screen: string;
  /** Маршрут экрана, который стенд открывает в этом состоянии (`/home`, `/map`, `/match`, `/result`). */
  route: string;
  state: string;
  clock: { now: number; day: string };
  /** Семя рассадки (одно на кадр, чтобы снимок повторялся). */
  seed: number;
  player: { pid: string; name: string };
  sections: Record<string, unknown>;
  /** Дом и Карта: вход правил из макета (`HomeInput`, К-Д) — для сверки экрана с одним источником. */
  home?: unknown;
  /** Карта: кадр показывает переезд (автобус и плашка «Едем…», Э2.08/.09) — а не обычную карточку «На матч» (065 Т8г). */
  travel?: boolean;
  /** Матч и итог: что кадр показывает сверх разделов (Т9/Т10 дописывают). */
  match?: unknown;
  /** Итог: готовый вид итога (`ResultView`), счёт 1-го тайма, номер урока и улица кадра (Т10а). */
  result?: unknown;
  /** Игрового дня в макете не было — взят образец. */
  dayGuess?: boolean;
  /** Страница родителя и окна (063 Т11): все игроки устройства по порядку (первый — игрок вкладки, его `sections` дублируют верхние) и день последней выгрузки. */
  players?: { pid: string; name: string; sections: Record<string, unknown>; binned?: string }[];
  exportedAgo?: number;
  /** Страница родителя (063-Р65): второй игрок списка (`p2`) записан битым файлом — строка «не открывается» и «Начать заново». */
  broken?: 'player';
  /** Страница родителя, «Загрузить файл»: файл, выбранный на кадре (`made` — ISO-время выгрузки, `players` — игроки файла). */
  file?: { made: string; players: { pid: string; name: string; sections: Record<string, unknown> }[] };
  /** Страница родителя, кадры корзины (063 Т12): вкладка, шаг блока «Игроки» (`ask`, `clear`, `back` — вернуть из корзины) и прокрутка к нему. */
  stand?: { tab?: string; step?: 'ask' | 'clear' | 'back'; scroll?: 'players' };
  /** Окно поверх экрана: «Игра обновилась» без списка или со списком «Что нового». */
  window?: { kind: 'updated' | 'news'; lines?: string[] };
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
  store.setTabPid(fx.player.pid); // игрок вкладки известен и при двух игроках (на странице родителя — «играет в этой вкладке»)
  const session = createSession({ store, newPid: () => `p${String(fx.seed).padStart(10, '0')}` });
  await session.init();
  return session;
}
