/**
 * Подключение перехвата ошибок (спека 014-Т5, design §7). Первый импорт `main.ts`: слушатели окна ставятся
 * при оценке модуля, раньше, чем читаются список игроков и сохранение, — бросок при загрузке тоже попадает на экран.
 * Здесь настоящие зависимости чистой `app/crash/crash.ts` и показ `CrashScreen` отдельным приложением Vue.
 * Ничего из импортируемого не читает хранилище при оценке (читает слой хранилища `app/save/`, он идёт позже).
 */
import { createApp, type App } from 'vue';
import { createCrash, setActiveCrash, type CrashView } from '../../app/crash/crash';
import { downloadBackup } from '../../app/save/backup';
import { eventLog } from '../../app/save/eventLog';
import { saveStore } from '../../app/save/instance';
import { tabFlag } from '../../app/storage';
import { ru } from '../../i18n/ru';
import CrashScreen from './CrashScreen.vue';

/** Экран, который сейчас показан (одна карточка): новый сбой заменяет карточку «хранилище переполнено». */
let shown: { app: App; node: HTMLElement } | null = null;

function clear(): void {
  try {
    shown?.app.unmount();
  } catch {
    // Снимаем свой экран — ошибка снятия ничего не меняет.
  }
  shown?.node.remove();
  shown = null;
}

/** Файл для папы из хранилища и памяти; false — не вышло. Без `progress` и роутера. */
async function saveFile(): Promise<boolean> {
  try {
    await downloadBackup();
    return true;
  } catch (err) {
    eventLog.log('error', `crash save-file: ${String(err).slice(0, 200)}`);
    return false;
  }
}

/** Совсем запасной вариант: экран не собрался — простой текст без Vue. */
function plain(node: HTMLElement): void {
  node.textContent = ru.crash.fallback;
  node.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;padding:24px;background:#15143a;color:#fff6e0;font:18px system-ui,sans-serif');
}

function show(view: CrashView): void {
  clear();
  const node = document.createElement('div');
  node.id = 'crash';
  document.body.append(node);
  try {
    const app = createApp(CrashScreen, {
      kind: view.kind,
      again: view.again,
      save: saveFile,
      onHome: () => crash.goHome(),
      onUpdate: () => crash.update(),
      onClose: clear,
    });
    // Ошибки самого экрана сбоя не должны вызывать новый сбой по кругу.
    app.config.errorHandler = (err) => eventLog.log('error', `crash screen: ${String(err).slice(0, 200)}`);
    app.mount(node);
    shown = { app, node };
  } catch (err) {
    eventLog.log('error', `crash screen mount: ${String(err).slice(0, 200)}`);
    plain(node);
  }
}

export const crash = createCrash({
  now: () => Date.now(),
  log: (kind, text, extra) => eventLog.log(kind, text, extra),
  flush: () => eventLog.ingest(saveStore.events()),
  flag: tabFlag,
  reload: () => location.reload(),
  status: () => saveStore.status(),
  home: () => {
    // Смена одного хэша страницу не перезагружает, а главное приложение уже снято. При строке запроса (`?utm=`,
    // `?seed=`) assign — настоящий переход, и reload сразу за ним его перебивал (014-Т7, тестировщик): reload только без неё.
    const base = import.meta.env.BASE_URL;
    if (location.search === '' && location.pathname === base) {
      location.hash = '#/';
      location.reload();
    } else location.assign(`${base}#/`);
  },
  show,
  own: [`${location.origin}${import.meta.env.BASE_URL}`],
});

setActiveCrash(crash);
crash.listen(window);

/** Что делать при запуске: события слоя — в журнал; `migrate-failed` и «новее» — экран без игры. true — игру можно монтировать. */
export function startupCheck(): boolean {
  eventLog.ingest(saveStore.events());
  crash.recheck();
  return !crash.crashed();
}
