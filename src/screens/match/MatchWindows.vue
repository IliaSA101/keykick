<script setup lang="ts">
/**
 * Окна матча (065 Т9г, 065-Р78): вступление, перерыв, пауза, выход, справка «Как держать руки».
 * Только показ: состояние матча и кнопки приходят от экрана, наружу уходят действия (`act`, `start`, `second` …).
 * Своё состояние — шаг справки; открытие справки сбрасывает его на первый шаг.
 */
import { computed, ref, watch } from 'vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitToggle from '../../components/kit/KitToggle.vue';
import KitModal from '../../components/panel/KitModal.vue';
import { soundOn, toggleSound } from '../../components/shell/sound';
import type { RunningMatch } from '../../engine/match';
import { ru } from '../../i18n/ru';
import type { Overlay, UiAction } from '../../app/match/run';
import { attacksText } from './view';
import { nextAfter, type AfterGame, type BreakPlan } from '../../app/break/cards';
import { gameName, mmss } from '../../app/learn/view';
import { GAMES } from '../../engine/learn/queue';
import LearnCard from '../../components/break/LearnCard.vue';

const props = defineProps<{
  state: RunningMatch;
  overlay: Overlay;
  started: boolean;
  /** Урок вступления: название, новые клавиши, совет тренера. */
  info: { name: string; keys: string; tip: string };
  /** Карточки перерыва (Э4.15–19) и слова над ними; пусто — сразу «Второй тайм». */
  plan: BreakPlan;
  /** Итог только что сыгранной игры (Э4.17): вместо карточек. */
  after: AfterGame | null;
}>();
const emit = defineEmits<{ act: [UiAction]; start: []; second: []; learn: [id: string]; 'close-all': []; home: []; leave: [] }>();

const t = ru.match;
const perHalf = (p: 'half1' | 'half2'): number => props.state.plan.filter((a) => a.phase === p).length;
const rules = computed(() => {
  const r = props.state.rules;
  return [t.rules.goal, `${r.goalMax + 1}–${r.concedeMin - 1} ${t.rules.save}`, `${r.concedeMin} ${t.rules.concede}`];
});
const helpStep = ref(0);
const steps = ru.handsHelp.steps;
const step = computed(() => steps[helpStep.value] ?? steps[0]);
watch(() => props.overlay, (o) => void (o === 'help' && (helpStep.value = 0)));
const placeName = ru.frame.menu.map;
/** «Ещё игра» после игры: первая карточка очереди, кроме сыгранной. */
const nextId = computed(() => (props.after ? nextAfter(props.plan.cards, props.after.id) : null));
/** Время «золота» игры для строки «до золота» (мм:сс). */
const goldTime = (id: string): string => mmss((GAMES.find((g) => g.id === id)?.t ?? 0) * 1000);
</script>

<template>
  <section
    v-if="!started && overlay === 'none'"
    class="card panel intro"
  >
    <div class="top">
      <p class="lesson">
        {{ t.intro.lesson }}: {{ info.name }}
      </p>
      <p
        v-if="info.keys"
        class="keys"
      >
        {{ t.intro.newKeys }}: <span class="letters"><b
          v-for="k in [...info.keys]"
          :key="k"
        >{{ k.toUpperCase() }}</b></span>
      </p>
    </div>
    <div class="flow">
      <span>{{ t.intro.flowWarm }}</span><i>→</i><span>{{ t.intro.flowHalf1 }}: {{ attacksText(perHalf('half1')) }}</span><i>→</i><span>{{ t.intro.flowBreak }}</span><i>→</i><span>{{ t.intro.flowHalf2 }}: {{ attacksText(perHalf('half2')) }}</span>
    </div>
    <ul class="rules">
      <li
        v-for="(r, i) in rules"
        :key="i"
      >
        <i
          class="dot"
          :class="['goal', 'save', 'conceded'][i]"
        />{{ r }}
      </li>
    </ul>
    <p
      v-if="info.tip"
      class="note"
    >
      <b>{{ t.intro.coach }}:</b> {{ info.tip }}
    </p>
    <div class="btns">
      <KeyButton
        primary
        :sub="t.intro.startKey"
        @click="emit('start')"
      >
        {{ t.intro.start }}
      </KeyButton>
      <KeyButton
        quiet
        @click="emit('act', 'help')"
      >
        {{ t.intro.hands }}
      </KeyButton>
      <span style="flex: 1" />
      <KeyButton
        quiet
        @click="emit('home')"
      >
        {{ t.intro.home }}
      </KeyButton>
    </div>
  </section>

  <section
    v-if="state.phase === 'break' && overlay === 'none'"
    class="card panel brk"
    :class="{ lite: plan.lead === null && !after }"
  >
    <div class="top">
      <h2>{{ t.break.title }}</h2>
      <span class="muted">{{ t.break.score }} <b class="big">{{ state.half1.me }} : {{ state.half1.opp }}</b></span>
    </div>
    <template v-if="after">
      <LearnCard
        :end="after.end"
        :name="gameName(after.id)"
        :gold-time="goldTime(after.id)"
      />
      <p class="note">
        {{ ru.learn.end.leadBreak }}
      </p>
    </template>
    <template v-else-if="plan.lead !== null">
      <p class="muted">
        {{ ru.learn.brk.lead[plan.lead] }}
      </p>
      <div class="games">
        <LearnCard
          v-for="c in plan.cards"
          :key="c.id"
          :card="c"
          @pick="emit('learn', c.id)"
        />
      </div>
      <p class="pick">
        <kbd>Tab</kbd> {{ ru.learn.brk.pick }}
      </p>
    </template>
    <p
      v-else
      class="muted"
    >
      {{ t.break.note }}
    </p>
    <div class="btns">
      <KeyButton
        primary
        :sub="t.break.secondKey"
        @click="emit('second')"
      >
        {{ t.break.second }}
      </KeyButton>
      <span
        v-if="after"
        style="flex: 1"
      />
      <KeyButton
        v-if="after && nextId"
        quiet
        @click="emit('learn', nextId)"
      >
        {{ ru.learn.end.next.replace('{name}', gameName(nextId)) }}
      </KeyButton>
      <span
        v-else-if="plan.lead !== null"
        class="skip"
      >{{ ru.learn.start.skipNote }}</span>
    </div>
  </section>

  <KitModal
    v-if="overlay === 'pause'"
    :title="t.pause.title"
    :lead="t.pause.lead"
    :note="t.pause.note"
    @close="emit('act', 'esc')"
  >
    <template #buttons>
      <KeyButton
        primary
        :sub="t.pause.resumeKey"
        @click="emit('act', 'resume')"
      >
        {{ t.pause.resume }}
      </KeyButton>
      <KeyButton
        quiet
        @click="emit('act', 'quit')"
      >
        {{ t.pause.quit }}
      </KeyButton>
    </template>
    <template #after>
      <KitToggle
        :on="soundOn"
        @toggle="toggleSound"
      />
      <div style="margin-top: 2px">
        <KeyButton
          quiet
          @click="emit('act', 'help')"
        >
          {{ t.helpChip }}
        </KeyButton>
      </div>
    </template>
  </KitModal>

  <KitModal
    v-if="overlay === 'quit'"
    :title="t.quit.titlePlace.replace('{place}', placeName)"
    :lead="t.quit.lead"
    :width="520"
    :top="150"
    @close="emit('act', 'esc')"
  >
    <template #buttons>
      <KeyButton
        primary
        sub="Enter"
        @click="emit('close-all')"
      >
        {{ t.quit.keep }}
      </KeyButton>
      <KeyButton
        quiet
        @click="emit('leave')"
      >
        {{ t.quit.leave }}
      </KeyButton>
    </template>
  </KitModal>

  <KitModal
    v-if="overlay === 'help'"
    :title="ru.handsHelp.title"
    :lead="`${ru.handsHelp.step} ${helpStep + 1} ${ru.handsHelp.of} ${steps.length}`"
    left
    :width="660"
    :top="90"
    @close="emit('act', 'esc')"
  >
    <div class="bars">
      <i
        v-for="i in steps.length"
        :key="i"
        :class="{ on: i <= helpStep + 1 }"
      />
    </div>
    <p class="stitle">
      {{ step.title }}
    </p>
    <p class="stext">
      {{ step.text }}
    </p>
    <template #buttons>
      <KeyButton
        quiet
        :disabled="helpStep === 0"
        @click="helpStep--"
      >
        {{ ru.handsHelp.back }}
      </KeyButton>
      <span class="muted">{{ ru.handsHelp.keys }}</span>
      <KeyButton
        v-if="helpStep < steps.length - 1"
        primary
        sub="→"
        @click="helpStep++"
      >
        {{ ru.handsHelp.next }}
      </KeyButton>
      <KeyButton
        v-else
        primary
        @click="emit('act', 'esc')"
      >
        {{ ru.handsHelp.done }}
      </KeyButton>
    </template>
  </KitModal>
</template>

<style scoped>
.card { position: absolute; left: 50%; margin-left: -370px; width: 740px; display: flex; flex-direction: column; justify-content: space-between; }
.intro { top: 226px; height: 233px; /* тень не ложится на клавиатуру ниже (в кадре Э1.01 клавиши поверх тени): обрезаем её под каймой */ clip-path: inset(-40px -40px -3px -40px); }
.brk { top: 248px; height: 338px; gap: 8px; }
.brk.lite { top: 330px; height: 200px; gap: 10px; }
.games { display: flex; gap: 12px; padding-top: 6px; }
.pick { margin: 0; font-size: 14px; font-weight: 600; color: var(--text-muted); }
.pick kbd { padding: 1px 6px; border-radius: 5px; background: rgb(255 255 255 / 0.15); font: inherit; font-weight: 800; }
.skip { margin-left: auto; font-size: 15px; font-weight: 600; color: var(--text-muted); }
.top { display: flex; justify-content: space-between; align-items: center; }
.lesson { font-size: 21px; font-weight: 800; }
.keys, .muted { font-size: 15px; font-weight: 700; color: var(--text-muted); }
.big { font-size: 24px; color: #fff; margin-left: 6px; }
.note { font-size: 15px; }
.letters { display: inline-flex; gap: 5px; vertical-align: middle; }
.letters b { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; background: var(--zone-middle); color: var(--on-zone); font-size: 18px; }
.flow { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; white-space: nowrap; }
.flow span { padding: 3px 9px; border-radius: 12px; background: rgb(255 255 255 / 0.1); }
.flow i { font-style: normal; color: var(--text-muted); }
.rules { display: flex; justify-content: space-between; gap: 10px; margin: 0; padding: 0; list-style: none; font-size: 16px; font-weight: 700; }
.rules li { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
.rules .dot { width: 13px; height: 13px; border-radius: 50%; flex: none; }
.dot.goal { background: var(--zone-middle); }
.dot.save { background: var(--zone-index); }
.dot.conceded { background: var(--error); }
.bars { display: flex; gap: 6px; }
.bars i { display: block; flex: 1; height: 6px; border-radius: 3px; background: rgb(255 255 255 / 0.2); }
.bars i.on { background: #fff; }
.stitle { font-size: 21px; font-weight: 800; }
.stext { font-size: 17px; line-height: 1.45; }
</style>
