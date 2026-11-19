<script setup lang="ts">
/**
 * «Права на компьютер» (067 Т18, Э4.20, 48; ТЗ-7.6): окно поверх перерыва после игры, давшей новое умение. Удостоверение из восьми
 * умений, полученные — со ступенью, остальные — «ещё нет ступени» или «нужно к «Школе», тур N». Закрывается само через `ms`, Enter/Esc/«Дальше» — сразу.
 * Свой слой и свой keydown (как окно игры: Enter не должен дойти до «Второго тайма» под ним). Только показ: данные — пропсами.
 */
import { onBeforeUnmount, onMounted } from 'vue';
import { medalTier, rightRows, rightsGot } from '../../app/break/cards';
import type { RightsCard } from '../../engine/learn/steps';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';
import KitTag from '../kit/KitTag.vue';
import TierMedal from '../learn/TierMedal.vue';
import { gameIcon } from './gameIcon';

const props = defineProps<{ card: RightsCard; /** Игра, давшая умение только что («новое»). */ fresh: string; owner: string }>();
const emit = defineEmits<{ close: [] }>();

const t = ru.learn.brk.rights;
const rows = rightRows(props.card, props.fresh);
const got = rightsGot(props.card);
let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== ' ') return;
  e.preventDefault();
  e.stopPropagation();
  if (!e.repeat) emit('close');
}
onMounted(() => {
  globalThis.addEventListener('keydown', onKey, true);
  timer = globalThis.setTimeout(() => emit('close'), props.card.showMs);
});
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey, true);
  globalThis.clearTimeout(timer);
});
</script>

<template>
  <div class="layer">
    <div class="dim" />
    <section
      class="card panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t.title"
    >
      <h2>{{ t.title }}</h2>
      <p class="lead">
        {{ t.lead }}
      </p>
      <div class="doc">
        <div class="dhead">
          <b>{{ t.doc }}</b><span>{{ owner }}</span>
        </div>
        <div class="grid">
          <div
            v-for="r in rows"
            :key="r.id"
            class="right"
            :class="r.step > 0 ? 'got' : 'lock'"
          >
            <img
              class="ico"
              :src="gameIcon(r.id)"
              alt=""
            >
            <div>
              <b>{{ r.skill }}</b>
              <span
                v-if="r.step > 0"
                class="lvl"
              >
                <TierMedal :tier="medalTier(r.step)" /> {{ ru.school.medal[r.step] }}
                <KitTag
                  v-if="r.fresh"
                  kind="solid"
                >{{ ru.home.markNew }}</KitTag>
              </span>
              <span
                v-else
                class="lvl"
              >{{ r.tour === null ? ru.learn.brk.noTier : t.locked.replace('{n}', String(r.tour)) }}</span>
            </div>
          </div>
        </div>
        <p class="dfoot">
          {{ t.got.replace("{n}", String(got.n)).replace("{of}", String(got.of)) }}
        </p>
      </div>
      <div class="btns">
        <span class="timer"><i :style="{ animationDuration: `${card.showMs}ms` }" />{{ t.timer.replace('{n}', String(Math.round(card.showMs / 1000))) }}</span>
        <KeyButton
          primary
          :sub="ru.kit.enter"
          @click="emit('close')"
        >
          {{ ru.result.next }}
        </KeyButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.layer { position: absolute; inset: 0; }
.dim { position: absolute; inset: 0; background: rgb(8 12 30 / 0.55); }
.card { position: absolute; left: 50%; margin-left: -370px; top: 96px; width: 740px; height: 472px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; text-align: left; }
.card h2 { margin: 0; font-size: 34px; }
.lead { margin: 0; font-size: 16px; color: var(--text-muted); }
.doc { border-radius: 10px; overflow: hidden; background: var(--paper-note); color: var(--paper-text); }
.dhead { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; background: var(--brand-green); color: #fff; }
.dhead b { font-size: 18px; letter-spacing: 0.04em; }
.dhead span { font-size: 14px; font-weight: 600; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; padding: 12px 14px 4px; }
.right { display: flex; align-items: center; gap: 10px; }
.right.lock { opacity: 0.6; }
.ico { width: 38px; height: 38px; flex: none; border-radius: 8px; object-fit: cover; }
.right.lock .ico { outline: 2px dashed var(--paper-node); outline-offset: 1px; }
.right b { display: block; font-size: 16px; }
.right .lvl { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--paper-muted); } /* свой класс: голый `span` ложился и на корень метки «новое» */
.dfoot { margin: 0; padding: 4px 14px 10px; font-size: 15px; }
.btns { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
.timer { display: flex; align-items: center; gap: 10px; font-size: 15px; color: var(--text-muted); }
.timer i { display: block; width: 100px; height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--zone-middle) 100%, transparent 0) left / 0 100% no-repeat rgb(255 255 255 / 0.2); animation: fill linear forwards; }
@keyframes fill { to { background-size: 100% 100%; } }
</style>
