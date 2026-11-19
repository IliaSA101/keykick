<script setup lang="ts">
/**
 * Карточка учебной игры в перерыве матча (067 Т18, Э4.15–19, 48): игра очереди — значок, имя, что учит, «к «Школе»», ступень, ставка
 * («новая», «побей рекорд» золотой игры) — или итог только что сыгранной игры («после игры»: медаль, монеты, что дальше).
 * Только показ: данные — пропсами, наружу — выбор (`pick`, кнопка карточки: Tab/Enter/щелчок). Золото — на монете и медали, рамка плашки белая.
 */
import { computed } from 'vue';
import { endLines, mmss, type EndModel } from '../../app/learn/view';
import { medalTier, type CardView } from '../../app/break/cards';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import KitTag from '../kit/KitTag.vue';
import LearnCoin from '../learn/LearnCoin.vue';
import TierMedal from '../learn/TierMedal.vue';
import { gameIcon } from './gameIcon';

const props = defineProps<{
  /** Игра очереди; нет — карточка «после игры» (тогда `end`). */
  card?: CardView | undefined;
  /** Итог только что сыгранной игры (Э4.17) и её имя. */
  end?: EndModel | undefined;
  name?: string | undefined;
  goldTime?: string | undefined;
}>();
const emit = defineEmits<{ pick: [] }>();

const t = ru.learn.brk;
const rec = computed(() => props.card?.kind === 'record');
const next = computed(() => t.next[Math.min(props.card?.step ?? 0, 2)] ?? '');
const lines = computed(() => (props.end ? endLines(props.end, props.name ?? '', props.goldTime ?? '') : null));
const coinsWord = computed(() => `+${props.end?.coins ?? 0} ${plural(props.end?.coins ?? 0, ru.result.purse.coins)}`);
</script>

<template>
  <div
    v-if="end && lines"
    class="res"
  >
    <TierMedal
      :tier="end.tier || 1"
      :size="52"
    />
    <div class="rtxt">
      <b>{{ lines.title }}</b>
      <span>{{ lines.sub }}.</span>
      <span class="note">{{ lines.note }}</span>
    </div>
    <b
      v-if="end.goldRepeat"
      class="plus"
    >{{ ru.learn.end.record }} {{ mmss(end.best) }}</b>
    <b
      v-else
      class="plus"
    >{{ coinsWord }} <LearnCoin /></b>
  </div>
  <button
    v-else-if="card"
    type="button"
    class="game"
    :class="{ rec }"
    @click="emit('pick')"
  >
    <KitTag
      v-if="rec"
      kind="ok"
      class="corner"
    >
      {{ t.record }}
    </KitTag>
    <KitTag
      v-if="card.isNew"
      kind="solid"
      class="fresh"
    >
      {{ ru.home.markNew }}
    </KitTag>
    <span class="head">
      <img
        class="ico"
        :src="gameIcon(card.id)"
        alt=""
      >
      <span class="gtxt">
        <b class="name">{{ card.name }}</b>
        <span class="sub">{{ card.skill }} · {{ t.perMin }}</span>
        <span
          v-if="card.school"
          class="school"
        >{{ card.school }}</span>
      </span>
    </span>
    <span class="foot">
      <span class="ft">
        <span class="tier">
          <TierMedal
            v-if="rec || card.step > 0"
            :tier="rec ? 3 : medalTier(card.step)"
          />
          <i
            v-else
            class="none"
          />
          <b v-if="rec">{{ t.goldRecord.replace('{time}', mmss(card.best ?? 0)) }}</b>
          <b v-else>{{ card.step > 0 ? ru.school.medal[card.step] : t.noTier }}</b>
        </span>
        <span class="note">{{ rec ? t.recordHow : next }}</span>
      </span>
      <span class="stake">
        <template v-if="rec">
          <b>{{ t.zero }}</b><span>{{ t.onlyRecord }}</span>
        </template>
        <template v-else>
          <b>+{{ card.stake }} <LearnCoin /></b><span>{{ ru.learn.end.perGame }}</span>
        </template>
      </span>
    </span>
  </button>
</template>

<style scoped>
.game { position: relative; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; flex: 1 1 0; min-width: 0; padding: 10px 12px 8px; border: 0; border-radius: 12px; font: inherit; color: var(--text); text-align: left; background: rgb(255 255 255 / 0.07); box-shadow: inset 0 0 0 1.5px var(--border); cursor: pointer; }
.game:hover { background: rgb(255 255 255 / 0.12); }
.game:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.corner { position: absolute; top: -9px; right: 12px; padding: 1px 8px; font-size: 13px; }
.fresh { position: absolute; top: -10px; left: 14px; padding: 1px 6px; font-size: 12px; }
.head { display: flex; align-items: flex-start; gap: 12px; }
.ico { width: 48px; height: 48px; flex: none; border-radius: 10px; object-fit: cover; box-shadow: 0 0 0 2px rgb(255 255 255 / 0.4); }
.gtxt { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.name { font-size: 19px; line-height: 1.15; }
.sub { font-size: 13px; font-weight: 600; color: var(--text-muted); }
.school { font-size: 13px; font-weight: 800; color: #8fe3a8; }
.foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; padding-top: 6px; border-top: 1px solid rgb(255 255 255 / 0.15); }
.ft { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tier { display: flex; align-items: center; gap: 7px; font-size: 15px; }
.none { display: inline-block; box-sizing: border-box; width: 26px; height: 26px; border: 2px solid rgb(255 255 255 / 0.7); border-radius: 50%; }
.note { font-size: 13px; font-weight: 600; color: var(--text-muted); }
.stake { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
.stake b { display: inline-flex; align-items: center; gap: 4px; font-size: 17px; font-weight: 800; white-space: nowrap; }
.stake span { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.res { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-radius: 12px; background: rgb(255 255 255 / 0.07); box-shadow: inset 0 0 0 1.5px var(--border); }
.rtxt { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.rtxt b { font-size: 19px; }
.rtxt span { font-size: 14px; color: var(--text-muted); }
.plus { display: inline-flex; align-items: center; gap: 6px; font-size: 21px; font-weight: 800; white-space: nowrap; }
</style>
