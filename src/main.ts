import { crash } from './app/crash/boot'; // ПЕРВЫМ: перехват ставится до App.vue и роутера (К6, ТЗ-12.14)
import { createApp } from 'vue';
import App from './App.vue';
import { phoneNow } from './app/phone/device';
import { router } from './app/router';
import { isParentRoute } from './engine/players/entry';
import { useSession } from './app/save/session';
import { mountCrashWindow } from './screens/system/mountCrash';
import './styles/tokens.css';
import './styles/kit/index.css';

crash.setPresenter((view) => mountCrashWindow(crash, view));

// сеанс (устройство и игрок вкладки) открыт до монтирования: охране входа нужно знать, кто играет;
// страница родителя (#/parent) только смотрит: игрока не берёт, чтобы не запирать вкладку ребёнка (063-Р59)
// телефон без клавиатуры («Открой на компьютере», 059-В7) сохранения не читает и не пишет: сеанс откроет роутер, если окно станет компьютерным
try {
  if (!phoneNow()) await useSession().init({ look: isParentRoute(globalThis.location.hash) });
} catch (e) {
  crash.report('vue', e);
}

const app = createApp(App);
app.config.errorHandler = (err) => crash.report('vue', err);
app.use(router);
if (!crash.crashed()) app.mount('#app');
