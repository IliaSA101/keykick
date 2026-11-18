<script setup lang="ts">
/**
 * Стенд кадра (065 К-Г, только в разработке): `#/dev/frame/<id реестра>` — сеанс в памяти из фикстуры
 * `tests/fixtures/accepted/<id>.json`, экран кадра открыт в этом состоянии. Хранилище браузера не трогаем.
 * Экрана ещё нет (маршрут — заглушка или нет вовсе) — показываем строку с id и маршрутом, не падаем.
 * Пометка «нет экрана» стоит только на заглушке: у настоящего экрана кадр чистый — его снимает `tools/accepted/shoot.mjs`.
 */
import { provide, shallowRef, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { setSession, useSession } from '../../app/save/session';
import FooterLine from '../../components/shell/FooterLine.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import UpdateWindow from '../system/UpdateWindow.vue';
import { PARENT_STAND, type ParentStand } from '../parent/stand';
import { frameSession, type FrameFixture } from './frameSession';

const files = import.meta.glob<FrameFixture>('../../../tests/fixtures/accepted/*.json', { import: 'default' });

const id = String(useRoute().params.id ?? '');
const router = useRouter();
const note = shallowRef('');
const view = shallowRef<Component | null>(null);
const props = shallowRef<Record<string, unknown>>({});
// оболочка (шапка и строка низа) — как у App.vue: только экранам без `meta.bare`
const shell = shallowRef('');
const playerName = shallowRef('');
// часы кадра для Дома: «сегодня» берётся из фикстуры, а не из браузера (065 К-Г)
const clock = shallowRef({ now: Date.now(), day: new Date().toLocaleDateString('sv-SE') });
provide('kk-home-clock', () => clock.value);
// состояние кадра Дома: семя рассадки, поставщики следующих волн (Кубок, лавка, База…) и окна кадра — из фикстуры; в игре их нет (065-Р64)
const homeStand = shallowRef<Record<string, unknown>>({});
provide('kk-home-stand', () => homeStand.value);
// страница родителя: файл, выбранный на кадре «Загрузить файл» (063 Т11), вкладка и шаг блока «Игроки» (Т12), окно поверх экрана (обновление) — из фикстуры
const parentStand = shallowRef<ParentStand>({});
provide(PARENT_STAND, () => parentStand.value);
const win = shallowRef<FrameFixture['window']>();

/** Кадры, где макет не рисует баннер «Новая ступень» (проверка длины имён, наведение на стенд): ступень на них та же, что на соседних (065-Р80). */
const NO_BANNER = /^home\.(long|long-city|news)$/;

/** Макет хранил подпись Кубка с разметкой (`<span class="nb">`); поставщик отдаёт чистый текст. */
const plain = (x: unknown): unknown => JSON.parse(JSON.stringify(x ?? {}).replace(/<[^>]+>/g, ''));

async function open(): Promise<void> {
  const load = files[`../../../tests/fixtures/accepted/${id}.json`];
  if (!load) {
    note.value = `no fixture: ${id}`;
    return;
  }
  const fx = await load();
  clock.value = fx.clock;
  const h = (fx.home ?? {}) as Record<string, unknown>;
  homeStand.value = { seed: fx.seed, over: { bought: h.bought, round: h.round, end: h.end, region: h.region, extras: plain(h.extras) }, peek: id === 'home.peek', coach: id === 'home.coach', noBanner: NO_BANNER.test(id), travel: fx.travel === true };
  setSession(await frameSession(fx));
  win.value = fx.window;
  parentStand.value = { ...fx.stand };
  if (fx.file) {
    const [first] = fx.file.players;
    if (first) {
      const made = await frameSession({ ...fx, exportedAgo: 0, player: first, sections: first.sections, players: fx.file.players });
      const out = made.transfer.exportText(fx.file.made, 'https://example.org/keykick/next/');
      if (out.ok) parentStand.value = { ...parentStand.value, fileText: out.text };
    }
  }
  const rec = router.resolve(fx.route).matched[0];
  const loader = rec?.components?.default;
  if (!rec?.name || !loader) {
    note.value = `${id} · ${fx.route} · no screen yet`;
    return;
  }
  const comp = typeof loader === 'function' && !('__vccOpts' in loader) && !('setup' in loader) ? ((await (loader as () => Promise<{ default: Component }>)()).default) : (loader as Component);
  if ((comp as { __name?: string }).__name === 'ScreenStub') note.value = `${id} · ${fx.route} · stub screen`;
  view.value = comp;
  const cur = useSession().player.value;
  playerName.value = cur.kind === 'ok' ? cur.env.name : '';
  shell.value = rec.meta.bare === true ? '' : String(rec.name);
  props.value = (typeof rec.props === 'object' && rec.props !== null ? (rec.props as { default?: Record<string, unknown> }).default : undefined) ?? {};
  // экран матча (настоящий) получает состояние кадра из фикстуры; заглушкам оно не нужно (065 Т9г)
  if (fx.route === '/match' && fx.match && note.value === '') props.value = { ...props.value, frame: fx.match };
  // экран итога (065 Т10а): готовый вид итога из фикстуры, без записи и без клавиш
  if (fx.route === '/result' && fx.result && note.value === '') props.value = { ...props.value, frame: fx.result };
}
void open();
</script>

<template>
  <div
    class="frame-stand"
    :data-frame="id"
  >
    <ShellHeader
      v-if="shell"
      :page="shell"
    />
    <!-- окно поверх экрана: экран размыт и без подписей, как в кадрах Э6.63/.97 (`overSys` макета) -->
    <component
      :is="view"
      v-if="view"
      v-bind="props"
      :style="win ? 'filter: blur(3px)' : undefined"
    />
    <UpdateWindow
      v-if="win"
      :lines="win.lines ?? []"
    />
    <FooterLine
      v-if="shell && playerName !== ''"
      :name="playerName"
    />
    <p
      v-if="note"
      class="frame-stand__note"
    >
      {{ note }}
    </p>
  </div>
</template>

<style scoped>
.frame-stand {
  position: absolute;
  inset: 0;
}
.frame-stand__note {
  position: absolute;
  left: 8px;
  bottom: 8px;
  margin: 0;
  font: 12px/1.2 monospace;
  color: var(--color-text, #fff);
  opacity: 0.7;
}
</style>
