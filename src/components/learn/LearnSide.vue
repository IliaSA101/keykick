<script setup lang="ts">
/** Колонка справа окна игры (Э8): старт — ступени, клавиши, ставка; игра — прогресс, промахи и время, ступени, клавиши, Esc; итог — промахи, время, ступени. */
import { computed } from 'vue';
import type { Ladder } from '../../app/learn/view';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import LearnCoin from './LearnCoin.vue';
import TierMedal from './TierMedal.vue';

const props = defineProps<{ mode: 'start' | 'play' | 'end'; game: string; ladder: Ladder; goldTime: string; time: string; misses: number; progress?: { at: number; total: number } | undefined; stake: number; best?: string }>();
const t = ru.learn;
const texts = t.games as unknown as Record<string, { unit?: string; does: readonly string[] }>;
const does = computed(() => texts[props.game]?.does ?? []);
const KEYS: Record<string, string[][]> = {
  arrows: [['←', '↑', '→', '↓']],
  tab: [['Shift+Tab'], ['Tab'], ['Enter']],
  squad: [[t.side.mouse], [ru.keyboard.space]],
  board: [['Tab'], ['Backspace']],
  roster: [['Tab'], ['↑', '↓']],
  pairs: [[t.side.mouse], ['Tab'], ['1–4']],
};
const keys = computed<string[][]>(() => KEYS[props.game] ?? [[t.side.mouse]]);
/** Ставка: текст до и после монеты (`{coin}` в `ru.learn.side.stake`). */
const stakeParts = computed(() => t.side.stake.replace('{n}', String(props.stake)).replace('{coins}', plural(props.stake, ru.result.purse.coins)).split('{coin}'));
const rule = (i: number): string => (t.tiers.rules[i] ?? '').replace('{time}', props.goldTime);
const tierOf = (i: number): 1 | 2 | 3 => (i === 0 ? 1 : i === 1 ? 2 : 3);
const shown = computed(() => (props.progress ? Math.min(props.progress.at + 1, props.progress.total) : 0));
</script>

<template>
  <div class="col">
    <template v-if="mode === 'play' && progress">
      <div class="prog">
        <b>{{ t.side.progress.replace('{done}', String(shown)).replace('{total}', String(progress.total)) }}</b>
        <span>{{ texts[game]?.unit ?? t.side.rounds }}</span>
      </div>
      <div class="pips">
        <i
          v-for="i in progress.total"
          :key="i"
          :class="{ done: i - 1 < progress.at, cur: i - 1 === progress.at }"
        />
      </div>
    </template>
    <div
      v-if="mode === 'start' && best"
      class="best"
    >
      {{ best }}
    </div>
    <div
      v-if="mode === 'start'"
      class="lab"
    >
      {{ t.side.steps }}
    </div>
    <div
      v-if="mode === 'end'"
      class="lab"
    >
      {{ t.side.result }}
    </div>
    <div
      v-if="mode !== 'start'"
      class="stats"
    >
      <div>
        <b :class="{ miss: misses > 0 }">{{ misses }}</b><small>{{ plural(misses, t.side.misses) }}</small>
      </div>
      <div>
        <b>{{ time }}</b><small>{{ t.side.time }}</small>
      </div>
    </div>
    <div
      v-if="mode === 'end'"
      class="lab"
    >
      {{ t.side.steps }}
    </div>
    <div class="ladder">
      <div
        v-for="(state, i) in ladder"
        :key="i"
        class="step"
        :class="state"
      >
        <TierMedal :tier="tierOf(i)" />
        <b>{{ ru.school.medal[i + 1] }}</b><span>{{ rule(i) }}</span><em v-if="state === 'lost'">✗</em>
      </div>
    </div>
    <template v-if="mode !== 'end'">
      <div class="lab">
        {{ t.side.keys }}
      </div>
      <div class="keys">
        <div
          v-for="(k, i) in keys"
          :key="i"
        >
          <kbd
            v-for="c in (keys.length > 1 ? [k.join(' ')] : k)"
            :key="c"
            :class="{ cap: c === ru.keyboard.space }"
          >{{ c }}</kbd><span>{{ does[i] }}</span>
        </div>
      </div>
    </template>
    <div
      v-if="mode === 'start'"
      class="stake"
    >
      {{ stakeParts[0] }}<LearnCoin :size="15" />{{ stakeParts[1] }}
    </div>
    <div
      v-if="mode === 'play'"
      class="esc"
    >
      <kbd>Esc</kbd>{{ t.side.escLine }}
    </div>
  </div>
</template>

<style scoped>
.col { display: flex; flex-direction: column; gap: 5px; min-height: 0; overflow: hidden; box-sizing: border-box; padding: 8px 12px; border-radius: 14px; background: rgb(255 255 255 / 0.07); box-shadow: inset 0 0 0 1.5px var(--border); }
.lab { font-size: 12px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text-muted); }
.best { font-size: 14px; font-weight: 800; }
.prog { display: flex; align-items: baseline; gap: 8px; }
.prog b { font-size: 26px; line-height: 1; }
.prog span { font-size: 15px; color: var(--text-muted); }
.pips { display: flex; gap: 5px; }
.pips i { flex: 1; height: 7px; border-radius: 4px; background: rgb(255 255 255 / 0.18); }
.pips i.done { background: var(--zone-middle); }
.pips i.cur { background: #fff; }
.stats { display: flex; justify-content: space-between; gap: 8px; }
.stats div { display: flex; align-items: baseline; gap: 6px; }
.stats b { font-size: 19px; line-height: 1.1; }
.stats b.miss { color: #ff8a8a; }
.stats small { font-size: 12px; color: var(--text-muted); }
.ladder { display: flex; flex-direction: column; gap: 5px; }
.step { display: grid; grid-template-columns: 26px auto 1fr auto; align-items: center; column-gap: 8px; padding: 2px 8px 2px 6px; border-radius: 10px; line-height: 1.15; }
.step b { font-size: 15px; }
.step span { font-size: 13px; text-align: right; white-space: nowrap; color: var(--text-muted); }
.step.now { background: rgb(255 255 255 / 0.16); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.7); }
.step.now span { color: var(--text); }
.step.got { background: rgb(111 216 156 / 0.2); box-shadow: inset 0 0 0 1.5px var(--zone-middle); }
.step.lost { opacity: 0.45; }
.step em { font-style: normal; font-size: 16px; font-weight: 800; }
.keys { display: flex; flex-direction: column; gap: 3px; font-size: 13px; color: var(--text-muted); }
.keys div { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.keys kbd { font-size: 13px; flex: none; color: var(--text); }
.keys kbd.cap { text-transform: capitalize; }
.stake { margin-top: auto; font-size: 13px; color: var(--text-muted); }
.esc { margin-top: auto; font-size: 13px; line-height: 1.3; color: var(--text-muted); }
</style>
