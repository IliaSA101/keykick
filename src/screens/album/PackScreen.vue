<script setup lang="ts">
/**
 * Пак после матча (067 Т12, ТЗ-5.1–5.3, 10.11; кадры Э2К.05–10, 43; моушн М1): синее окно над размытым итогом. Слой A (закрытый пак и ролик) — `PackRoll.vue`. Состояния: закрыт (Открыть) →
 * ролик М1 (пак дрожит и рвётся, карточка вылезает, переворот, лучи, вспышка — 1880 мс; потом окно, форма летит в ячейку) → форма: новая (1 из 3) · «2 из 3» · собрана (Надеть / Позже) · первая с фольгой.
 * Пак — по порядку `packAt`, шансов нет (067-Р9). «Дальше» двигает `album.shown` один раз (`closePack`), перезагрузка посреди — пак снова.
 * Esc на закрытом паке — Дом, пак не потерян; на открытом — пак показан, Дом; на «Форма собрана» Esc — «Позже»: пак показан, форма не надета
 * (её надевают в Раздевалке), цепочка идёт дальше (решение — `packExit`). Паки копятся (Esc, «Дом» на итоге): после «Дальше» показываем
 * следующий, пока он есть, потом — следующее звено цепочки (`app/result/chain`). «Меньше движения» — токен `--motion-k` (сдвиги гаснут).
 */
import { computed, inject, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { artUrl } from '../../art/assets';
import { closePack, packExit, packView, type PackPhase, type PackView } from '../../app/album/input';
import { dreamText, fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { chainNext, chainSave, endChain, escChain, schoolOpenOf } from '../../app/result/chain';
import PackRoll from './PackRoll.vue';
import ShirtView from '../../components/club/ShirtView.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import { ENTER_DELAY, enterAllowed } from '../../components/panel/focusCycle';
import ScreenHead from '../../components/league/ScreenHead.vue';
import ResultBackdrop from '../../components/shell/ResultBackdrop.vue';
import { albumDef, type Album } from '../../engine/album/section';
import { clubDef, type Club } from '../../engine/club/section';
import { dayDef, type Day } from '../../engine/day/section';
import { homeView } from '../../engine/home';
import { schoolDef, type School } from '../../engine/school/section';
import { ru } from '../../i18n/ru';

const t = ru.album.pack;
const router = useRouter();
const { session, input, data, player, today, trainers } = useHomeInput();
const club = computed<Club>(() => data<Club>('club', clubDef.empty()));
const home = computed(() => (input.value ? homeView(input.value) : null));
const head = computed(() => (home.value ? dreamText(home.value) : null));
/** Пак держим снимком при открытии экрана: запись `shown` не должна на глазах подменять пак следующим. */
const view = shallowRef<PackView | null | undefined>(undefined);
const phase = ref<PackPhase>('closed');
/** Стенд кадров: открытый пак (Э2К.06–10, 43); в игре пак всегда начинается закрытым. */
const stand = inject<(() => { phase?: 'shown' }) | null>('kk-pack-stand', null)?.() ?? null;
const editable = computed(() => session.status.value === 'ok');
/** Ролик М1 (принятый `m1-pack.html`): времена — токены движения (base 280, slow 520, stagger 70): дрожь 1,5 base, карточка +stagger, переворот, окно, ячейка. */
const T = { tear: 420, rise: 490, flip: 1080, hand: 1880, land: 2400, base: 280 };
const root = ref<HTMLElement | null>(null);
const bigEl = ref<HTMLElement | null>(null);
/** Ролик идёт (ребёнок нажал «Открыть»); на стенде открытого пака его нет — сразу конечное состояние. */
const rolled = ref(false);
/** Окно закрытого пака ещё гаснет поверх открытого (base после HAND). */
const leaving = ref(false);
/** Полёт формы в ячейку: сдвиг и масштаб копии (px сцены), считаются, когда окно показано; null — до расчёта или без ячейки. */
const fly = ref<{ tx: number; ty: number; fit: number } | null>(null);
const landing = ref(false);
let opened = globalThis.performance.now();
let left = false;
let shownAt = opened;
let tear: ReturnType<typeof globalThis.setTimeout> | undefined;
let fade: ReturnType<typeof globalThis.setTimeout> | undefined;

const albumNow = (): Album => data<Album>(albumDef.name, albumDef.empty());
watch(
  () => player.value,
  (p) => {
    if (p === null || view.value !== undefined) return;
    view.value = packView(albumNow());
    if (view.value === null) proceed(albumNow());
    else if (stand?.phase === 'shown') phase.value = 'shown';
  },
  { immediate: true },
);

const lesson = computed(() => Math.max(1, (input.value?.cur ?? 1) - 1));
const shirtBack = computed(() => ({ name: club.value.backName, number: club.value.backNumber }));
const title = computed(() => (view.value ? t.title[view.value.kind] : ''));
const count = computed(() => (view.value ? fill(t.countLeft, { n: view.value.n, left: view.value.left.map((p) => t.partName[p]).join(', ') }) : ''));
const PARTS = ['shirt', 'shorts', 'socks'] as const;

async function leave(path: string): Promise<void> {
  if (left) return;
  left = true;
  await router.replace(path);
}
function open(): void {
  if (phase.value !== 'closed') return;
  phase.value = 'opening';
  rolled.value = true;
  tear = globalThis.setTimeout(() => {
    phase.value = 'shown';
    shownAt = globalThis.performance.now();
    leaving.value = true;
    fade = globalThis.setTimeout(() => (leaving.value = false), T.base);
    void startLanding();
  }, T.hand);
}
/** Форма летит в ячейку «своей части» (М1): масштаб сцены — из `zoom` сцены, сдвиг — от центра большой формы к центру ячейки. */
async function startLanding(): Promise<void> {
  await nextTick();
  const slot = root.value?.querySelector<HTMLElement>('.slot.now .tiny-kit');
  const big = bigEl.value;
  if (slot && big) {
    const z = Number.parseFloat(globalThis.getComputedStyle(root.value?.closest('.stage') ?? big).zoom) || 1;
    const a = big.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    fly.value = { tx: (b.left + b.width / 2 - a.left - a.width / 2) / z, ty: (b.top + b.height / 2 - a.top - a.height / 2) / z, fit: b.height / a.height };
  }
  landing.value = true;
}
/** Дальше после показанного пака: ещё есть непоказанный — он (на месте, закрытым); иначе следующее звено цепочки, иначе Карта или Дом. */
function proceed(album: Album): void {
  const more = packView(album);
  if (more !== null) {
    view.value = more;
    phase.value = 'closed';
    rolled.value = false;
    landing.value = false;
    fly.value = null;
    opened = globalThis.performance.now();
    return;
  }
  const day = data<Day>(dayDef.name, dayDef.empty());
  const next = chainNext(chainSave(album, day, data<School>(schoolDef.name, schoolDef.empty()), today(), trainers()), schoolOpenOf(input.value), 'pack', globalThis.Date.now());
  void leave(next === null ? endChain() : next.path);
}
/** Enter, «Дальше», «Надеть» (`enter`) и Esc, «Позже» (`esc`): что делать — решает `packExit` (отметить показанным, надеть, цепочка или Дом). */
function exit(how: 'enter' | 'esc'): void {
  if (left) return;
  const v = view.value;
  const x = packExit(phase.value, v?.kind ?? null, how, editable.value);
  if (x === null) return;
  if (x.go === 'home') {
    if (x.mark && v) session.save({ album: closePack(albumNow(), v, x.wear) });
    void leave(escChain());
    return;
  }
  if (!v) return;
  const album = closePack(albumNow(), v, x.wear);
  session.save({ album });
  proceed(album);
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    exit('esc');
  } else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement) && enterAllowed({ repeat: e.repeat, openedAt: phase.value === 'shown' ? shownAt : opened, now: e.timeStamp, delay: ENTER_DELAY })) {
    e.preventDefault();
    if (phase.value === 'closed') open();
    else exit('enter');
  }
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onUnmounted(() => {
  globalThis.removeEventListener('keydown', onKey);
  globalThis.clearTimeout(tear);
  globalThis.clearTimeout(fade);
});
</script>

<template>
  <main
    v-if="view"
    ref="root"
    class="pack"
    :class="{ rolled, landing }"
  >
    <ResultBackdrop>
      <ScreenHead
        v-if="home && head"
        :title="t.head"
        :city="`«${club.name}»`"
        :stars="`${home.stars.n}/${home.stars.of}`"
        :fans="home.fans.n"
        :coins="home.coins"
        :dream-text="head.text"
        :dream-pct="head.pct"
      />
    </ResultBackdrop>
    <!-- B: окно с формой (лежит под A, пока A гаснет) -->
    <div
      v-if="phase === 'shown'"
      class="pwrap"
    >
      <img
        class="corner"
        :class="{ conf: view.kind === 'foil' }"
        :src="artUrl(view.kind === 'foil' ? 'albumPackFoil' : 'albumPackOpen')"
        alt=""
      >
      <div
        class="card panel kb-modal win pk2"
        :class="{ foilwin: view.foil }"
      >
        <h2 class="wt">
          {{ title }}
        </h2>
        <div class="st">
          <!-- высоты — единицы макета Э2К (e2k-pack.mjs): собрана — 232 / 112 / 116 / 232, одна часть — футболка 196, шорты и гетры 168 -->
          <div
            ref="bigEl"
            class="kh big"
            :style="{ '--h': `${view.kind === 'full' ? 232 : view.part === 'shirt' ? 196 : 168}px` }"
          >
            <ShirtView
              :kit="view.kit.kit"
              :part="view.kind === 'full' ? 'shirt' : view.part"
              :label="view.kit.name"
              crop
            />
            <!-- копия формы летит в ячейку (М1): сжимается и гаснет на месте -->
            <ShirtView
              v-if="fly"
              class="fly"
              :style="{ '--tx': `${fly.tx}px`, '--ty': `${fly.ty}px`, '--fit': fly.fit }"
              :kit="view.kit.kit"
              :part="view.kind === 'full' ? 'shirt' : view.part"
              crop
            />
          </div>
          <span
            v-if="view.kind === 'full'"
            class="kitcol"
          >
            <span
              class="kh"
              style="--h: 112px"
            ><ShirtView
              :kit="view.kit.kit"
              part="shorts"
              crop
            /></span>
            <span
              class="kh"
              style="--h: 116px"
            ><ShirtView
              :kit="view.kit.kit"
              part="socks"
              crop
            /></span>
          </span>
          <!-- спина: у собранной и у первой формы с фольгой (Н9 макета: номер металлом виден сразу) -->
          <div
            v-if="view.kind === 'full' || view.kind === 'foil'"
            class="kh"
            :style="{ '--h': `${view.kind === 'full' ? 232 : 196}px` }"
          >
            <ShirtView
              :kit="view.kit.kit"
              :back="shirtBack"
              crop
            />
          </div>
        </div>
        <h2 class="ht">
          {{ view.kind === 'full' ? fill(t.fullHead, { kit: view.kit.name }) : fill(t.partHead, { part: t.partName[view.part].replace(/^./, (c) => c.toUpperCase()), kit: view.kit.name }) }}
        </h2>
        <div
          v-if="view.kind !== 'full'"
          class="slots"
        >
          <span
            v-for="(p, i) in PARTS"
            :key="p"
            class="slot"
            :class="{ on: view.have[i], now: p === view.part }"
          >
            <span class="tiny-kit"><ShirtView
              :kit="view.kit.kit"
              :part="p"
              crop
            /></span>
            <small>{{ t.partName[p] }}</small>
          </span>
        </div>
        <p
          v-if="view.kind !== 'full'"
          class="num"
        >
          {{ count }}
        </p>
        <p
          v-if="view.kind === 'part'"
          class="hint"
        >
          {{ fill(t.hint, { kit: view.kit.name }) }}
        </p>
        <div class="btns">
          <template v-if="view.kind === 'full'">
            <KeyButton
              primary
              :sub="ru.kit.enter"
              :state="editable ? undefined : 'off'"
              @click="exit('enter')"
            >
              {{ t.wear }}
            </KeyButton>
            <KeyButton
              quiet
              :sub="ru.kit.esc"
              :state="editable ? undefined : 'off'"
              @click="exit('esc')"
            >
              {{ t.later }}
            </KeyButton>
          </template>
          <KeyButton
            v-else
            primary
            :sub="ru.kit.enter"
            @click="exit('enter')"
          >
            {{ ru.result.next }}
          </KeyButton>
        </div>
        <p class="tiny c">
          {{ view.kind === 'full' ? t.fullTiny : fill(t.totals, { n: view.total.parts, of: view.total.of, full: view.total.full, forms: view.total.forms }) }}
        </p>
      </div>
    </div>
    <!-- A: закрытый пак и ролик разрыва (слой A М1) — PackRoll; на показе формы гаснет (base) -->
    <PackRoll
      :kit="view.kit.kit"
      :part="view.kind === 'full' ? 'shirt' : view.part"
      :lesson="lesson"
      :phase="phase"
      :rolled="rolled"
      :leaving="leaving"
      @open="open"
    />
  </main>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css, collection-e-pack.css) и пробы М1 (motion.css: mo-rw-*); окно — 700 px по центру */
.pack { position: absolute; inset: 0; overflow: hidden; color: var(--text); }
.win { position: absolute; left: 50%; top: 98px; z-index: 11; width: 700px; margin-left: -350px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 22px; }
.pwrap { position: absolute; left: 50%; top: 98px; z-index: 11; width: 700px; margin-left: -350px; display: grid; place-items: center; }
.pwrap > .win { position: relative; left: auto; top: auto; margin-left: 0; width: 100%; z-index: 2; }
.pk2 { overflow: visible; gap: 3px; padding: 10px 22px 12px; }
/* форма в «своей» ячейке: пуста, пока копия летит; на прилёте проявляется, ячейка вспыхивает (кольцо покоя возвращается само) */
.pack.rolled:not(.landing) .slot.now .tiny-kit { opacity: 0; }
.pack.landing .slot.now { animation: pulse var(--motion-base) var(--motion-ease-out) var(--motion-slow) backwards; }
.pack.landing .slot.now .tiny-kit { animation: fadein var(--motion-fast) var(--motion-ease-out) var(--motion-slow) both; }
.kh { position: relative; }
/* фольга (Э2К.10, 049-Р21): серебристый кант в 1,5 px (как `.cl-kit.foil` макета) и медленный перелив металла — блик пробегает по яркости формы; без движения — кант и ровный свет */
.foilwin .kh > :deep(.shirt:not(.fly)) { filter: drop-shadow(1.5px 0 0 #e4e9f4) drop-shadow(-1.5px 0 0 #e4e9f4) drop-shadow(0 1.5px 0 #e4e9f4) drop-shadow(0 -1.5px 0 #e4e9f4) drop-shadow(0 0 6px #ffffff8c); animation: foil 2400ms ease-in-out infinite; }
@keyframes foil { 0%, 100% { filter: drop-shadow(1.5px 0 0 #e4e9f4) drop-shadow(-1.5px 0 0 #e4e9f4) drop-shadow(0 1.5px 0 #e4e9f4) drop-shadow(0 -1.5px 0 #e4e9f4) drop-shadow(0 0 6px #ffffff8c) brightness(1); } 50% { filter: drop-shadow(1.5px 0 0 #e4e9f4) drop-shadow(-1.5px 0 0 #e4e9f4) drop-shadow(0 1.5px 0 #e4e9f4) drop-shadow(0 -1.5px 0 #e4e9f4) drop-shadow(0 0 6px #ffffff8c) brightness(calc(1 + 0.16 * var(--motion-k))) saturate(calc(1 + 0.25 * var(--motion-k))); } }
.fly { position: absolute; left: 0; top: 0; z-index: 30; pointer-events: none; animation: fly var(--motion-slow) var(--motion-ease-out) both; }
.tiny { margin: 0; font-size: 11px; color: var(--text-muted); }
.c { text-align: center; }
.wt { margin: 0; font-size: 26px; line-height: 1.1; font-weight: 900; text-align: center; color: #fff; }
.ht { margin: 3px 0 1px; font-size: 26px; line-height: 1.15; text-align: center; }
.st { display: flex; align-items: flex-end; justify-content: center; gap: 18px; width: 100%; box-sizing: border-box; padding: 4px 30px 8px; background: radial-gradient(ellipse at 50% 48%, #ffffff40, transparent 60%); }
.foilwin .st { background: radial-gradient(ellipse at 50% 50%, #8a8d9eb0, #2c3073 42%, transparent 72%); }
.kh { display: block; height: var(--h); }
.kh > :deep(.shirt) { height: 100%; width: auto; }
.kitcol { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mid { display: block; width: 112px; }
.slots { display: flex; gap: 12px; }
.slot { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 5px 10px; border-radius: 10px; background: #1a1c45; border: 1.5px solid #2b2f72; }
.slot.on { border-color: #5fae7d; }
.slot.now { box-shadow: 0 0 0 3px #fff; }
.slot small { font-size: 11px; color: var(--text-muted); }
.tiny-kit { display: block; height: 36px; }
.tiny-kit > :deep(.shirt) { height: 100%; width: auto; }
.slot:not(.on) .tiny-kit { opacity: 0.2; filter: brightness(0) invert(1); } /* несобранная часть — белый силуэт (049-Р14), как в макете */
.num { margin: 2px 0; font-size: 13px; font-weight: 800; }
.hint { margin: 0; font-size: 14px; font-weight: 800; color: #9fe3b8; }
.pk2 > .btns { margin-top: 18px; }
.corner { position: absolute; left: -150px; bottom: 6px; z-index: 1; width: 138px; height: 166px; transform: rotate(-4deg); filter: drop-shadow(0 8px 14px #0008); }
.corner.conf { left: auto; right: -216px; bottom: -22px; width: 190px; height: 105px; transform: scaleX(-1); filter: drop-shadow(0 6px 10px #0008); }
@keyframes fadein { from { opacity: 0; } }
@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgb(255 246 224 / 0); } 40% { box-shadow: 0 0 0 calc(4px + 10px * var(--motion-k)) rgb(255 246 224 / 0.55); } }
/* копия формы: до ячейки сжимается и гаснет; «меньше движения» — не видна, форма проявляется в ячейке */
@keyframes fly { 0% { opacity: var(--motion-k); transform: none; } 80% { opacity: var(--motion-k); } 100% { opacity: 0; transform: translate(calc(var(--tx) * var(--motion-k)), calc(var(--ty) * var(--motion-k))) scale(calc(1 + (var(--fit) - 1) * var(--motion-k))); } }
</style>
