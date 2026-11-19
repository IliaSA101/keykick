<script setup lang="ts">
/**
 * Пять игр на интерес в ряд (067 Т19, кадры Э4.01–07, 41): название, рекорд и когда, главная кнопка «Играть · Enter» у первой открытой,
 * «завтра» и «после матча» вместо кнопки, силуэт и условие у закрытых. Рисунки — кропы наборов (036-Р36). Ничего не считает: вид приходит готовый.
 */
import { artUrl, type ArtKey } from '../../art/assets';
import { fill } from '../../app/home/texts';
import { funName, lockText, unitOf, whenText } from '../../app/base/run';
import type { BaseView, FunId, FunView } from '../../engine/base/open';
import { ru } from '../../i18n/ru';
import cfg from '../../content/base.json';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitTag from '../../components/kit/KitTag.vue';
import { mmss } from '../../app/learn/view';

const props = defineProps<{ view: BaseView; today: string; primary: FunId | null; /** Номер урока: ступень газона на карточке Мини-футбола. */ cur: number }>();
defineEmits<{ play: [id: FunId] }>();

const t = ru.base;
const ART: Partial<Record<FunId, ArtKey>> = { keepy: 'baseSashaKnee', free: 'baseSashaKick', memo: 'iconShirt' };
const fieldKey = (): ArtKey => (props.cur <= 6 ? 'baseFieldWorn' : 'baseFieldGoals');
const name = (id: FunId): string => t.fun[id].name;
const unit = (f: FunView, n: number): string => (f.id === 'free' ? fill(t.freeTail, { shots: cfg.free.shots, time: mmss((f.record?.t ?? 0) * 1000) }) : unitOf(f.id, n));
const wait = (f: FunView): string => (f.wait === 'tomorrow' ? t.wait.tomorrow : ru.home.afterMatch);
</script>

<template>
  <div class="funs">
    <div
      v-for="f in view.fun"
      :key="f.id"
      class="fun"
      :class="{ lock: f.wait === 'later' }"
      :data-fun="f.id"
    >
      <span
        v-if="f.wait === 'later' || ART[f.id] || f.id === 'mini'"
        class="art"
        :class="{ lock: f.wait === 'later' }"
        aria-hidden="true"
      >
        <i
          v-if="f.id === 'mini'"
          class="field"
          :style="{ backgroundImage: `url('${artUrl(fieldKey())}')` }"
        />
        <img
          v-else-if="ART[f.id]"
          :src="artUrl(ART[f.id]!)"
          alt=""
        >
      </span>
      <template v-if="f.wait === 'later'">
        <b class="nm">{{ funName(f.id, true) }}</b>
        <span class="lt">{{ lockText(f.id) }}</span>
      </template>
      <template v-else>
        <KitTag
          v-if="f.newMark"
          kind="solid"
          class="mark solid"
        >
          {{ ru.home.markNew }}
        </KitTag>
        <KitTag
          v-else-if="f.played"
          kind="nt"
          class="mark"
        >
          {{ t.playedToday }}
        </KitTag>
        <b class="nm">{{ name(f.id) }}</b>
        <template v-if="f.record">
          <span class="rec"><b>{{ f.record.n }}</b> {{ unit(f, f.record.n) }}</span>
          <span class="when">{{ whenText(f.record.day, today) }}</span>
        </template>
        <template v-else>
          <span class="rec none">{{ t.recordNone }}</span>
          <span class="when">{{ t.firstPlay }}</span>
        </template>
        <div class="act">
          <KeyButton
            v-if="f.open"
            :primary="primary === f.id"
            md
            :sub="primary === f.id ? ru.kit.enter : ''"
            @click="$emit('play', f.id)"
          >
            {{ ru.learn.start.play }}
          </KeyButton>
          <span
            v-else
            class="soon"
          >{{ wait(f) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* числа — базовые px сцены (кадры Э4, `docs/mockups/games/base.css`) */
.funs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.fun { position: relative; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px; padding: 6px 12px 8px; min-height: 124px; border-radius: 14px; background: linear-gradient(160deg, rgb(58 63 134 / 0.85), rgb(31 33 82 / 0.85)); box-shadow: inset 0 0 0 1.5px var(--border); }
.fun.lock { align-items: flex-start; padding: 4.5px 10.5px 6.5px; background: rgb(21 20 58 / 0.85); border: 1.5px dashed var(--border); box-shadow: none; color: var(--text-muted); }
.nm { min-height: 34px; font-size: 14px; line-height: 1.2; }
.lt { display: block; padding-top: 10px; min-height: 27px; font-size: 12px; color: var(--text-muted); }
.rec { font-size: 12px; color: var(--text-muted); }
.rec b { font-size: 22px; color: var(--text); }
.rec.none { display: flex; align-items: flex-end; min-height: 27px; font-size: 13px; }
.when { white-space: nowrap; font-size: 11px; color: var(--text-muted); margin-right: 72px; }
.act { margin-top: auto; padding-top: 4px; margin-right: 72px; }
/* «завтра» и «после матча» — плоская плашка во всю колонку кнопки (кадры Э4.05, 07), не кнопка: нажимать нечего */
.soon { display: block; padding: 5px 16px; border-radius: 12px; font-size: 15px; font-weight: 800; line-height: 1.5; color: var(--text-muted); box-shadow: inset 0 0 0 1.5px var(--border); }
.act > * { box-sizing: border-box; width: 100%; min-width: 0; }
/* метка на кромке: плотная строка (≈15 ед.) — не налезает ни на заголовок карточки в две строки, ни на плашку «0 монет» выше (067 Т22) */
.mark { position: absolute; right: 12px; top: -14px; font-size: 12px; line-height: 1.1; }
.mark.solid { padding: 1px 6px; }
.art { position: absolute; right: 8px; bottom: 6px; width: 62px; height: 68px; display: flex; align-items: flex-end; justify-content: center; pointer-events: none; }
.art img { display: block; height: 68px; width: auto; max-width: 62px; object-fit: contain; filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.45)); }
.art .field { display: block; width: 60px; height: 60px; margin-bottom: 4px; border-radius: 10px; background: no-repeat -33.6px -17.2px / 164.6px 91.9px; box-shadow: 0 3px 5px rgb(0 0 0 / 0.45); }
/* закрытая игра — тот же рисунок белым силуэтом на 35 % */
.art.lock { filter: brightness(0) invert(1); opacity: 0.35; }
.art.lock img, .art.lock .field { filter: none; box-shadow: none; }
</style>
