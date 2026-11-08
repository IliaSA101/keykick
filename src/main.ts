// Первым: перехват ошибок (спека 014-Т5) — слушатели окна встают раньше, чем читаются игроки и сохранение.
import { crash, startupCheck } from './components/crash/installCrash';
// Дальше: в dev-сборке кладёт фикстуру ?seed= в хранилище до загрузки app/players (в выпуске — пусто).
import './dev/boot';
import { createApp } from 'vue';
import App from './App.vue';
import { startJournal } from './app/journal/boot';
import { router } from './app/router';
import { watchViewport } from './app/viewport';
import { addDevRoutes } from './dev/routes';
import './styles/tokens.css';

// Страница обходчика кадров — только в dev-сборке (в dist её нет).
if (import.meta.env.DEV) addDevRoutes(router);
watchViewport();
// Журнал игры (IndexedDB), сеанс и крючки файла выгрузки — до монтирования; режим v1 — ничего.
startJournal(router);
// Сохранение не открылось (`migrate-failed`) или новее программы — вместо игры экран; бросок раньше уже показал сбой.
if (startupCheck()) {
  const app = createApp(App).use(router);
  app.config.errorHandler = (err, _instance, info) => crash.report(err, `vue ${info}`);
  crash.attachMain(app);
  app.mount('#app');
  // Бросок при самом монтировании: экран сбоя уже показан, остатки игры под ним не нужны.
  if (crash.crashed()) app.unmount();
}
