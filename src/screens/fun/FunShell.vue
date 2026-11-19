<script setup lang="ts">
/**
 * Адрес игры на Базе `/base/<игра>` (067 Т19, К-Д, Б-З4; полноэкранные игры на интерес — 067-Р16). Охрана (`gameGate`): открытая игра на интерес — её экран,
 * учебная — База с окном игры (`/base?play=`), всё остальное (закрыта, лимит дня, нет матча дня, неизвестная) — Базу. Экраны — `keepy/Keepy` (Чеканка), `memo/Memo` (Мемори), `keeper/Keeper` (Вратарь), `mini/Mini` (Мини-футбол); у остальных игр
 * пока заглушка «скоро» с выходом «На Базу · Esc» (Т20).
 */
import { computed, inject, onMounted, onUnmounted, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { baseCtxOf, baseScreen, gameGate, type Gate } from '../../app/base/run';
import { useHomeInput } from '../../app/home/useHomeInput';
import { breakCtx } from '../../app/learn/entry';
import { lessonsOf } from '../../app/match/run';
import KeyButton from '../../components/kit/KeyButton.vue';
import { ru } from '../../i18n/ru';
import Free from '../free/Free.vue';
import Keeper from '../keeper/Keeper.vue';
import Keepy from '../keepy/Keepy.vue';
import Memo from '../memo/Memo.vue';
import Mini from '../mini/Mini.vue';

const t = ru.base;
const router = useRouter();
// игра — из адреса; на стенде кадров маршрут другой (`/dev/frame/…`), игру передаёт стенд свойством
const props = defineProps<{ game?: string }>();
const id = props.game ?? String(useRoute().params.game ?? '');
const { session, pack, input, today } = useHomeInput();
// Штрафной до Кубка закрыт (067-Р18): стенд кадров ставит «Кубок сыгран» (`fx.base.cup`, 067-Р185), в игре — всегда `false`
const cupPlayed = inject<() => { cup?: boolean }>('kk-base-stand', () => ({}))().cup === true;

const gate = computed(() => {
  const p = pack.pack.value;
  const i = input.value;
  if (!p || !i) return null;
  const sections = session.player.value.kind === 'ok' ? session.player.value.env.sections : undefined;
  const lesson = Math.min(i.cur, 32);
  const keys = lessonsOf(p, 'yard', 32).find((l) => l.n === lesson)?.keys ?? '';
  const learn = breakCtx(sections, { lesson: i.cur, keys, entries: [], now: 0, day: today() });
  return { gate: gameGate(id, baseScreen(sections, baseCtxOf(i, today(), cupPlayed), learn), learn), keys, lesson };
});
/** Охрана решает один раз, когда вход собран: не открытая игра — на Базу, учебная — на Базу с окном. Дальше решение не меняется: итог игры тратит попытку дня — игра «закрывается», но экран итога остаётся. */
const decided = shallowRef<{ gate: Gate; keys: string; lesson: number } | null>(null);
watch(gate, (g) => {
  if (g === null || decided.value !== null) return;
  decided.value = g;
  if (g.gate.kind !== 'fun') void router.replace(g.gate.kind === 'learn' ? { path: '/base', query: { play: g.gate.id } } : '/base');
}, { immediate: true });

const toBase = (): void => void router.push('/base');
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && id !== 'keepy' && id !== 'memo' && id !== 'keeper' && id !== 'mini' && id !== 'free') toBase(); // у Чеканки, Мемори, Вратаря, Мини-футбола и Штрафного Esc ловит их экран
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onUnmounted(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <Keepy
    v-if="decided?.gate.kind === 'fun' && decided.gate.id === 'keepy'"
    :keys="decided.keys"
  />
  <Memo
    v-else-if="decided?.gate.kind === 'fun' && decided.gate.id === 'memo'"
    :keys="decided.keys"
  />
  <Keeper
    v-else-if="decided?.gate.kind === 'fun' && decided.gate.id === 'keeper'"
    :keys="decided.keys"
    :lesson="decided.lesson"
  />
  <Free
    v-else-if="decided?.gate.kind === 'fun' && decided.gate.id === 'free'"
    :keys="decided.keys"
    :lesson="decided.lesson"
  />
  <Mini
    v-else-if="decided?.gate.kind === 'fun' && decided.gate.id === 'mini'"
    :keys="decided.keys"
    :lesson="decided.lesson"
  />
  <main
    v-else-if="decided?.gate.kind === 'fun'"
    class="shell"
  >
    <h1>{{ ru.home.houses.base }} · {{ t.fun[decided.gate.id].name }}</h1>
    <p>{{ t.soon }}</p>
    <KeyButton
      quiet
      md
      :sub="ru.kit.esc"
      @click="toBase"
    >
      {{ ru.learn.end.base }}
    </KeyButton>
  </main>
</template>

<style scoped>
.shell { position: absolute; inset: 96px 16px 28px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
h1 { margin: 0; font-size: 22px; }
p { margin: 0; font-size: 16px; color: var(--text-muted); }
</style>
