<script setup lang="ts">
/**
 * Слой A пака (067 Т12, моушн М1; вынесен из `PackScreen.vue`): закрытый пак с кнопкой «Открыть» и ролик разрыва — карточка из разрыва, открытый пак, вспышка,
 * лучи под окнами. Своего состояния нет: фазу, «ролик идёт» и «гаснет» ведёт экран; «Открыть» — событие `open`. Времена — токены движения (`--motion-*`).
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { fill } from '../../app/home/texts';
import type { PackPhase } from '../../app/album/input';
import ShirtView from '../../components/club/ShirtView.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import type { ClubKit } from '../../engine/club/section';
import { ru } from '../../i18n/ru';

const props = defineProps<{ kit: ClubKit; part: 'shirt' | 'shorts' | 'socks'; lesson: number; phase: PackPhase; rolled: boolean; leaving: boolean }>();
const emit = defineEmits<{ open: [] }>();
const t = ru.album.pack;
/** Слой виден, пока пак закрыт или окно закрытого пака ещё гаснет поверх открытого. */
const visible = computed(() => props.phase !== 'shown' || props.leaving);
</script>

<template>
  <div
    v-if="rolled"
    class="mo-rays-w"
  >
    <div class="mo-rays" />
  </div>
  <div
    v-if="visible"
    class="sa"
    :class="{ out: phase === 'shown' }"
  >
    <div
      class="card panel kb-modal win closed"
      :class="{ tear: rolled }"
    >
      <span class="lab">{{ fill(t.closedLabel, { n: lesson }) }}</span>
      <div class="lit">
        <img
          class="pack0"
          :src="artUrl('albumPackClosed')"
          alt=""
        >
      </div>
      <div class="btns">
        <KeyButton
          primary
          :sub="ru.kit.enter"
          @click="emit('open')"
        >
          {{ t.open }}
        </KeyButton>
      </div>
      <p class="tiny c">
        {{ t.closedTiny }}
      </p>
    </div>
    <template v-if="rolled">
      <div class="clip">
        <div class="rcard">
          <div class="rflip">
            <div
              class="rface back"
              :style="{ backgroundImage: `url(${artUrl('albumCardBack')})` }"
            />
            <div
              class="rface front"
              :style="{ backgroundImage: `url(${artUrl('albumCardFace')})` }"
            >
              <ShirtView
                :kit="kit"
                :part="part"
                crop
              />
            </div>
          </div>
        </div>
      </div>
      <img
        class="open-pack"
        :src="artUrl('albumPackOpen')"
        alt=""
      >
      <div class="flash" />
    </template>
  </div>
</template>

<style scoped>
.lab { display: block; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #9fe3b8; text-align: center; }
.lit { display: grid; place-items: center; width: 100%; padding: 6px 60px; background: radial-gradient(ellipse at 50% 50%, #ffffff55, #ffffff1a 38%, transparent 66%); }
.pack0 { height: 296px; width: auto; margin: 2px 0; filter: drop-shadow(0 14px 18px #000a); transform-origin: 50% 90%; }
.tear .pack0 { animation: shake 420ms var(--motion-ease-in-out) both, fade var(--motion-fast) linear 420ms both; }
.tear .lab, .tear .btns, .tear .tiny { animation: fade var(--motion-fast) var(--motion-ease-out) 420ms both; }
/* ролик М1 (motion.css: mo-rw-*; числа — m1-pack.html): слой A — закрытое окно, карточка, открытый пак, вспышка; слой лучей — под окнами */
.sa { position: absolute; inset: 0; z-index: 11; isolation: isolate; pointer-events: none; }
.sa > .win { pointer-events: auto; }
.sa.out { animation: fade var(--motion-base) var(--motion-ease-out) both; }
.mo-rays-w { position: absolute; left: 50%; top: -297px; width: 1280px; height: 1280px; margin-left: -640px; z-index: 10; pointer-events: none; animation: fadein var(--motion-base) var(--motion-ease-out) 490ms both; }
.mo-rays { width: 100%; height: 100%; border-radius: 50%; background: repeating-conic-gradient(rgb(255 246 224 / 0.22) 0 10deg, transparent 10deg 30deg); mask: radial-gradient(circle, #000 55%, transparent 100%); animation: spin 2510ms linear 490ms both, fade var(--motion-base) var(--motion-ease-out) 2400ms both; }
.clip { position: absolute; left: 50%; margin-left: -118px; top: 100px; width: 236px; height: 284px; z-index: 12; clip-path: inset(-40px -60px 0 -60px); }
.rcard { position: absolute; left: 40px; top: -13px; width: 156px; height: 208px; perspective: 900px; --dy: 297px; --o0: var(--motion-k); animation: rise var(--motion-slow) var(--motion-ease-back) 490ms both; }
.rflip { position: absolute; inset: 0; transform-style: preserve-3d; animation: flip var(--motion-slow) var(--motion-ease-in-out) 1080ms both; }
.rface { position: absolute; inset: 0; background-repeat: no-repeat; background-size: 100% 100%; filter: drop-shadow(0 14px 18px rgb(0 0 0 / 0.45)); }
.rface.back { animation: face-back var(--motion-slow) linear 1080ms both; }
.rface.front { display: grid; place-items: center; animation: face-front var(--motion-slow) linear 1080ms both; }
.rface.front > :deep(.shirt) { width: 100px; height: auto; max-height: 130px; object-fit: contain; filter: none; }
.open-pack { position: absolute; left: 50%; margin-left: -89px; top: 307px; width: 178px; z-index: 13; --dy: -124.5px; --s0: 1.39; filter: drop-shadow(0 12px 16px #000a); animation: rise var(--motion-base) var(--motion-ease-out) 420ms both; }
.flash { position: absolute; left: 50%; margin-left: -160px; top: 247px; width: 320px; height: 320px; z-index: 14; background: radial-gradient(circle, rgb(255 255 255 / 0.9), rgb(255 255 255 / 0) 62%); animation: flash var(--motion-base) var(--motion-ease-out) 420ms both; }
@keyframes shake { 0%, 100% { transform: none; } 20% { transform: rotate(calc(-4deg * var(--motion-k))); } 40% { transform: rotate(calc(4deg * var(--motion-k))); } 60% { transform: rotate(calc(-3deg * var(--motion-k))); } 80% { transform: rotate(calc(2deg * var(--motion-k))); } }
@keyframes fade { to { opacity: 0; } }
@keyframes spin { to { transform: rotate(calc(90deg * var(--motion-k))); } }
@keyframes rise { from { opacity: var(--o0, 0); transform: translate(0, calc(var(--dy, 0px) * var(--motion-k))) scale(calc(1 + (var(--s0, 1) - 1) * var(--motion-k))); } to { opacity: 1; transform: none; } }
@keyframes flip { from { transform: rotateY(calc(180deg * var(--motion-k))); } to { transform: none; } }
/* стороны карточки сменяются за fast вокруг середины переворота: 34,6 % и 65,4 % от slow */
@keyframes face-back { 0%, 34.6% { opacity: 1; } 65.4%, 100% { opacity: 0; } }
@keyframes face-front { 0%, 34.6% { opacity: 0; } 65.4%, 100% { opacity: 1; } }
@keyframes flash { 0%, 100% { opacity: 0; } 40% { opacity: 1; } }
.win { position: absolute; left: 50%; top: 98px; z-index: 11; width: 700px; margin-left: -350px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 22px; }
.tiny { margin: 0; font-size: 11px; color: var(--text-muted); }
.c { text-align: center; }
@keyframes fadein { from { opacity: 0; } }
</style>
