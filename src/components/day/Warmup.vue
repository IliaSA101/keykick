<script setup lang="ts">
/**
 * Микроразминка (068 Т8, Э6.43–Э6.45, ТЗ-10.5): окно из двух шагов по 10 секунд — «вдаль, в окно» и «встряхни кисти»; кольцо считает секунды шага,
 * шаги идут сами; Esc и «Пропустить» — пропустить. Монет нет. Показывает хозяин (экран матча — после «На матч» или в перерыве, не посреди атаки, С4;
 * экран итога — после «пальцы устали»). Время — таймером окна; `step` и `left` в кадре стенда задаются свойствами и не тикают.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { artUrl } from '../../art/assets';
import { storyArtUrl } from '../../app/art/storyArt';
import { fill } from '../../app/home/texts';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';

const STEP_S = 10;

const props = defineProps<{ step?: 'far' | 'shake' | undefined; frozen?: boolean }>();
const emit = defineEmits<{ done: []; skip: [] }>();
const t = ru.day.warm;

const second = ref(0);
const far = computed(() => (props.step ?? (second.value < STEP_S ? 'far' : 'shake')) === 'far');
const left = computed(() => STEP_S - (second.value % STEP_S));
const R = 26;
const C = 2 * Math.PI * R;
let timer: ReturnType<typeof globalThis.setInterval> | undefined;

function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
  emit('skip');
}
onMounted(() => {
  globalThis.addEventListener('keydown', onKey, true);
  if (props.frozen === true) return;
  timer = globalThis.setInterval(() => {
    second.value += 1;
    if (second.value >= 2 * STEP_S) emit('done');
  }, 1000);
});
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey, true);
  globalThis.clearInterval(timer);
});
</script>

<template>
  <div class="wm-shade">
    <section
      class="wm panel"
      role="dialog"
      aria-modal="true"
      :aria-label="ru.day.act.warmup"
    >
      <h2>{{ ru.day.act.warmup }}</h2>
      <div class="row">
        <div
          class="pic"
          :class="{ window: far }"
        >
          <img
            v-if="!far"
            :src="artUrl('hands')"
            alt=""
          >
          <template v-else>
            <img
              class="view"
              :src="storyArtUrl('storyWarmFar')"
              alt=""
            >
            <span class="pen"><img
              :src="storyArtUrl('cupPennant')"
              alt=""
            ></span>
            <i class="sill" />
          </template>
          <span class="cap">{{ far ? t.capFar : t.capShake }}</span>
        </div>
        <span
          class="ring"
          :aria-label="fill(t.left, { n: left })"
        >
          <svg
            viewBox="0 0 64 64"
            width="64"
            height="64"
          >
            <circle
              cx="32"
              cy="32"
              :r="R"
              fill="none"
              stroke="rgb(255 255 255 / 0.2)"
              stroke-width="6"
            />
            <circle
              cx="32"
              cy="32"
              :r="R"
              fill="none"
              stroke="#6fd89c"
              stroke-width="6"
              stroke-linecap="round"
              :stroke-dasharray="C"
              :stroke-dashoffset="C * (1 - left / STEP_S)"
              transform="rotate(-90 32 32)"
            />
          </svg>
          <b>{{ left }}</b>
        </span>
      </div>
      <p class="step">
        <b>{{ far ? t.far : t.shake }}</b>
      </p>
      <p class="dots">
        <i :class="{ on: far }" /><i :class="{ on: !far }" />
      </p>
      <p class="next">
        {{ far ? t.nextFar : t.nextShake }}
      </p>
      <KeyButton
        quiet
        md
        :sub="ru.kit.esc"
        @click="emit('skip')"
      >
        {{ ru.kit.skip }}
      </KeyButton>
      <p class="note">
        {{ t.note }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.wm-shade { position: absolute; inset: 0; z-index: 40; background: rgb(8 10 30 / 0.55); display: flex; align-items: flex-start; justify-content: center; padding-top: 104px; }
.wm { width: 440px; box-sizing: border-box; padding: 18px 22px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
h2 { margin: 0; font-size: 28px; font-weight: 800; }
.row { display: flex; align-items: center; justify-content: center; gap: 22px; }
.pic { position: relative; flex: 0 0 300px; width: 300px; height: 220px; box-sizing: border-box; border-radius: 14px; background: #efe9d8; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.pic img { width: 86%; }
/* «вдаль» (Э6.43, макет `st-rh-pic.far`): окно — белая рама с переплётом и подоконником, в окне — вырезка дальнего края двора (`warm-far.webp`) и вымпел на мачте */
.pic.window { display: block; border: 8px solid #f4f1ea; border-radius: 8px; background: #f4f1ea; box-shadow: inset 0 0 0 2px #d9d2c2; }
.pic.window .view { position: absolute; left: 0; top: 0; width: 284px; max-width: none; height: 186px; } /* рама 8 px: внутри 284 × 204, подоконник 18 */
.pic.window::before, .pic.window::after { content: ''; position: absolute; z-index: 1; background: #f4f1ea; box-shadow: 0 0 0 1px #d9d2c2; }
.pic.window::before { left: calc(50% - 3px); top: 0; bottom: 18px; width: 6px; }
.pic.window::after { left: 0; right: 0; top: 46%; height: 6px; }
.sill { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; height: 18px; background: linear-gradient(#f3efe6, #d9d2c2); }
.pen { position: absolute; z-index: 1; left: 150px; top: 8px; }
.pen img { display: block; width: auto; height: 22px; filter: drop-shadow(0 0 5px rgb(255 250 240 / 0.7)) drop-shadow(0 3px 4px rgb(0 0 0 / 0.55)); }
.pic.window .cap { z-index: 3; left: 0; right: 0; bottom: 0; text-align: center; line-height: 18px; }
.cap { position: absolute; left: 10px; bottom: 8px; font-size: 14px; font-weight: 700; color: #4a4638; }
.ring { position: relative; flex: none; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
.ring svg { position: absolute; inset: 0; }
.ring b { position: relative; font-size: 22px; }
.step { margin: 4px 0 0; font-size: 20px; line-height: 1.3; }
.dots { margin: 2px 0 0; display: flex; gap: 8px; }
.dots i { width: 10px; height: 10px; border-radius: 50%; background: rgb(255 255 255 / 0.3); }
.dots i.on { background: #fff; }
.next { margin: 0; font-size: 15px; font-weight: 700; color: var(--text-muted); }
.note { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-muted); }
</style>
