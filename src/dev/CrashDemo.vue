<script setup lang="ts">
/*
 * Витрина экрана сбоя (спека 014-Т5, только dev-сборка):
 *   #/dev/crash?kind=error|newer|migrate|full&again=0|1 — сам экран (кнопки холостые);
 *   #/dev/crash?throw=render|promise|window|router|chunk — настоящий сбой, как в игре: экран покажет перехватчик;
 *   #/dev/crash?throw=boot — бросок при оценке модуля (`dev/boot.ts`): ссылку открывать полной загрузкой страницы (F5 / новая вкладка).
 * Подписей интерфейса здесь нет: тексты берёт сам CrashScreen.
 */
import { useRoute, useRouter } from 'vue-router';
import CrashScreen from '../components/crash/CrashScreen.vue';

const route = useRoute();
const router = useRouter();
const q = (key: string): string | null => (typeof route.query[key] === 'string' ? (route.query[key]) : null);

const KINDS = ['error', 'newer', 'migrate', 'full'] as const;
type Kind = (typeof KINDS)[number];
const found = KINDS.find((k) => k === q('kind'));
const kind: Kind = found ?? 'error';
const again = q('again') === '1';
const bomb = q('throw');

if (bomb === 'render') throw new Error('dev crash: render');
if (bomb === 'promise') void Promise.reject(new Error('dev crash: promise'));
if (bomb === 'window') globalThis.setTimeout(() => {
  throw new Error('dev crash: window');
});
if (bomb === 'router') {
  router.addRoute({ path: '/dev/broken', component: () => Promise.reject(new Error('dev crash: router')) });
  void router.push('/dev/broken');
}
if (bomb === 'chunk') {
  globalThis.dispatchEvent(Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: new Error('dev crash: chunk') }));
}
</script>

<template>
  <CrashScreen
    v-if="bomb === null"
    :kind="kind"
    :again="again"
    :save="() => true"
  />
</template>
