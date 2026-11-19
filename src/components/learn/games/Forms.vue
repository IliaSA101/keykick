<script setup lang="ts">
/**
 * Арена игр 5–8 (Э8.13–27; 067 Т18): «Отбор», «Табло», «Заявка», «Пары» — футбольные задачи видов ответа «Школы». Поля — общие
 * (`components/paper/AnswerField`: выбор, поля, список, соединялка, окошки выражения), своих полей здесь нет; арена — картинка игры
 * во всю ширину левой части окна, на ней строка задания (пилюля с портретом, 057-Р19) и нижняя полоса состояния (067-Р141):
 * справа тихая кнопка «Ответить · Enter» (для мыши), на промахе — красная полоса с причиной и «Enter — дальше».
 * Только показ и ввод: раунд, ответ и промахи считает движок (`engine/learn/forms`), наружу — `act` (ввод, «Ответить», линия «Пар»).
 */
import { computed } from 'vue';
import { artUrl, type ArtKey } from '../../../art/assets';
import { fingerName, kitLook, playerCard } from '../../../app/learn/formsMiss';
import { kitColors } from '../../../engine/album/kit';
import { FORMS_WHO, formAsk } from '../../../app/learn/view';
import type { FormsAction, FormsState } from '../../../engine/learn/forms';
import type { AnswerInput, SelectAnswer, TaskAnswer } from '../../../engine/school/answers';
import { fill } from '../../../app/home/texts';
import { ru } from '../../../i18n/ru';
import { TYPING_SIZE, TYPING_TIPS } from '../../keyboard/typingHands';
import ShirtView from '../../club/ShirtView.vue';
import AnswerField from '../../paper/AnswerField.vue';
import SelectField from '../../paper/SelectField.vue';

const props = defineProps<{ s: FormsState; strip?: string; idle?: boolean }>();
const emit = defineEmits<{ act: [action: FormsAction] }>();

const t = ru.learn;
const BACK: Record<FormsState['game'], ArtKey> = { squad: 'baseFieldGoals', board: 'learnArenaScoreboard', roster: 'learnArenaSheetBoard', pairs: 'learnArenaPairsBoard' };
const task = computed(() => props.s.tasks[Math.min(props.s.round, props.s.tasks.length - 1)]!);
const who = computed(() => FORMS_WHO[props.s.game]);
const answer = computed<TaskAnswer>(() => {
  const a = task.value.answer;
  if (a.kind === 'match' && task.value.refs === 'finger') return { ...a, left: a.left.map((id) => fingerName(id)) };
  return a;
});

/** «Пары»: новая линия — действие `link` (проверяется сразу); снятие линии игра не знает. Остальные виды — ввод. */
function onInput(v: AnswerInput): void {
  const cur = props.s.input;
  if (v.kind === 'match' && cur.kind === 'match') {
    const left = v.value.findIndex((r, i) => r !== null && cur.value[i] !== r);
    const right = v.value[left];
    if (left >= 0 && right !== null && right !== undefined) emit('act', { type: 'link', left, right });
    return;
  }
  emit('act', { type: 'set', input: v });
}

// ---------- «Пары»: руки по краям внизу арены, на кончиках пальцев задания — точки цвета метки пальца (Э8.25) ----------
const HAND = 130; // ширина руки на арене, px
const SIDES = [{ side: 'left', art: 'handsTypingL', fingers: ['lp', 'lr', 'lm', 'li'] }, { side: 'right', art: 'handsTypingR', fingers: ['rp', 'rr', 'rm', 'ri'] }] as const;
const hands = computed(() => {
  const ids = task.value.refs === 'finger' && task.value.answer.kind === 'match' ? task.value.answer.left : [];
  return SIDES.map((h) => ({
    side: h.side,
    src: artUrl(h.art),
    dots: h.fingers.flatMap((f, i) => (ids.includes(f) ? [{ f, left: (TYPING_TIPS[h.side][i]![0] * HAND) / TYPING_SIZE, top: (TYPING_TIPS[h.side][i]![1] * HAND) / TYPING_SIZE }] : [])),
  }));
});

// ---------- «Отбор»: карточки игроков (фигура Коллекции, имя, номер) и формы Альбома (как в Раздевалке) ----------
const PLAYER_ART: readonly ArtKey[] = ['albumPlayer01', 'albumPlayer02', 'albumPlayer03', 'albumPlayer04', 'albumPlayer05', 'albumPlayer06', 'albumPlayer07', 'albumPlayer08'];
/** Что на карточке варианта `i`: игрок или форма; пусто — поле нарисует текст варианта само. */
function card(i: number): { kit: ReturnType<typeof kitColors>; look: string; fig: ArtKey | null; name: string; num: number } {
  const a = task.value.answer;
  const id = a.kind === 'pictures' ? (a.pictures[i] ?? '') : '';
  const name = a.kind === 'choice' || a.kind === 'multi' ? (a.options[i] ?? '') : '';
  const p = playerCard(name);
  return { kit: kitColors(id), look: kitLook(id), fig: p === null ? null : (PLAYER_ART[p.file - 1] ?? null), name, num: p?.num ?? 0 };
}

// ---------- «Заявка»: все строки заявки на листе; сделанные остаются заполненными, будущие ждут ----------
const rows = computed(() => (props.s.game === 'roster' ? props.s.tasks.map((x) => x.answer).filter((a): a is SelectAnswer => a.kind === 'select') : []));
const NONE: AnswerInput = { kind: 'select', value: [null, null] };
function rowInput(r: number, a: SelectAnswer): AnswerInput {
  return r < props.s.round ? { kind: 'select', value: [...a.correct] } : r === props.s.round ? props.s.input : NONE;
}
</script>

<template>
  <div
    class="forms"
    :class="s.game"
  >
    <div
      v-if="s.game === 'squad'"
      class="back turf"
      :style="{ backgroundImage: `linear-gradient(rgb(10 40 20 / 0.3), rgb(10 40 20 / 0.3)), url(${artUrl(BACK[s.game])})` }"
    />
    <img
      v-else
      class="back"
      :class="{ top: s.game === 'roster' }"
      :src="artUrl(BACK[s.game])"
      alt=""
    >
    <div class="ask">
      <img
        class="por"
        :src="artUrl(who === 'ref' ? 'baseRefereeHead' : 'coachFace')"
        alt=""
      >
      <div>
        <b>{{ who === 'ref' ? t.who.ref : t.who.coach }}</b><span>«{{ formAsk(task) }}»</span>
      </div>
    </div>
    <template v-if="s.game === 'pairs'">
      <div
        v-for="h in hands"
        :key="h.side"
        class="hand"
        :class="h.side"
        :style="{ width: `${HAND}px` }"
      >
        <img
          :src="h.src"
          alt=""
        >
        <i
          v-for="d in h.dots"
          :key="d.f"
          class="dot"
          :style="{ left: `${d.left}px`, top: `${d.top}px`, background: `var(--finger-${d.f})` }"
        />
      </div>
    </template>
    <div
      v-if="s.game === 'roster'"
      class="rows"
      data-paper
    >
      <div class="th">
        <span
          v-for="c in t.sheetCols"
          :key="c"
        >{{ c }}</span>
      </div>
      <div
        v-for="(a, r) in rows"
        :key="r"
        class="row"
        :class="{ up: r >= 2 }"
      >
        <SelectField
          :answer="a"
          :model-value="rowInput(r, a)"
          :locked="r !== s.round"
          :reveal="r < s.round"
          @update:model-value="onInput"
        />
      </div>
    </div>
    <i
      v-if="s.game === 'roster'"
      class="stamp"
    >{{ t.stamp }}</i>
    <div
      v-else
      class="work"
      data-paper
    >
      <div
        v-if="s.game === 'board'"
        class="scr"
      >
        <AnswerField
          :key="s.round"
          :answer="answer"
          :model-value="s.input"
          @update:model-value="onInput"
        />
      </div>
      <AnswerField
        v-else
        :key="s.round"
        :answer="answer"
        :model-value="s.input"
        digits
        @update:model-value="onInput"
      >
        <template #card="{ index }">
          <span
            v-if="card(index).kit !== null"
            class="kit"
          >
            <span class="shirt">
              <ShirtView
                :kit="card(index).kit!"
                crop
              />
            </span>
            <span class="cap">{{ card(index).look }}</span>
          </span>
          <span
            v-else-if="card(index).fig !== null"
            class="who"
          >
            <img
              class="fig"
              :src="artUrl(card(index).fig!)"
              alt=""
            >
            <b>{{ card(index).name }}</b><i>{{ fill(t.card, { num: String(card(index).num) }) }}</i>
          </span>
          <span v-else>{{ card(index).name }}</span>
        </template>
      </AnswerField>
    </div>
    <div
      v-if="!idle"
      class="band"
      :class="{ miss: !!strip }"
    >
      <span
        v-if="strip"
        class="say"
      >✗ {{ strip }}</span>
      <button
        v-if="s.game !== 'pairs' || !!strip"
        type="button"
        class="go"
        :disabled="s.game === 'pairs'"
        @click="emit('act', { type: 'submit' })"
      >
        <template v-if="strip">
          {{ t.missNext }}
        </template>
        <template v-else>
          {{ ru.paper.go }} <kbd>{{ ru.kit.enter }}</kbd>
        </template>
      </button>
    </div>
  </div>
</template>

<style scoped>
.forms { position: absolute; inset: 0; color: var(--paper-text); }
.back { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.back.top { height: auto; inset: -15.57px 0 auto 0; }
.back.turf { background-position: 50% 50%; background-size: 250% auto; }
.ask { position: absolute; left: 12px; top: 8px; z-index: 2; display: flex; align-items: center; gap: 10px; max-width: calc(100% - 24px); padding: 4px 14px 4px 5px; border-radius: 999px; background: rgb(14 16 40 / 0.82); color: #fff; }
.roster .ask { left: 50px; top: 43px; }
.ask b { display: block; font-size: 12px; letter-spacing: 0.4px; text-transform: uppercase; color: #8fe3a8; }
.ask span { display: block; font-size: 15px; font-weight: 600; line-height: 1.2; }
.por { flex: none; width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #cfd8e6; box-shadow: 0 0 0 2px rgb(255 255 255 / 0.75); }
.work { position: absolute; left: 0; right: 0; top: 64px; bottom: 46px; display: flex; align-items: center; justify-content: center; }
.work :deep(.field) { margin-top: 0; }
/* «Отбор»: карточки с отступом ≥ 40 px от краёв арены */
.squad .work { align-items: flex-end; padding-bottom: 30px; box-sizing: border-box; }
.work :deep(.pf-opts) { flex-wrap: nowrap; justify-content: center; gap: 8px; padding: 0 12px; }
.work :deep(.pf-opt) { position: relative; flex: 0 0 auto; width: 140px; min-width: 0; padding: 8px 6px 6px; justify-content: center; }
/* «Отбор»: 4–5 карточек делят ширину арены с отступом 40 px по краям (Э8.14; 067 Т22): 4 × 140 + зазоры не влезали, крайние обрезались */
.squad .work :deep(.pf-opts) { box-sizing: border-box; width: 100%; padding: 0 40px; }
.squad .work :deep(.pf-opt) { flex: 1 1 0; width: auto; max-width: 128px; }
/* кружок с номером клавиши — в углу карточки, наполовину за краем (Э8.13) */
.work :deep(.pf-opt .k) { position: absolute; left: -8px; top: -8px; background: #fff; }
.who, .kit { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 12px; line-height: 1.15; text-align: center; }
.who b { font-size: 17px; }
.who i { font-style: normal; font-weight: 700; font-size: 19px; }
.fig { display: block; height: 104px; width: auto; }
.shirt { display: block; width: 66px; }
.cap { white-space: normal; }
/* «Табло»: поля и цифры внутри экрана картинки, белые и зелёные, как светодиоды */
.board .work { top: calc(14% + 58px); bottom: 15%; left: 9.5%; right: 9.5%; }
/* строка задания «Табло» — пилюля по центру экрана, над полями (Э8.17) */
.board .ask { left: 9.5%; right: 9.5%; top: 14%; width: fit-content; max-width: 81%; margin: 0 auto; }
.board .work :deep(.expr) { font-size: 19px; flex-wrap: nowrap; align-items: center; }
.board .work :deep(.txt) { line-height: 1.2; }
.board .work :deep(.fld) { min-width: 56px; width: 70px; height: 42px; padding: 0 6px; border-color: #8fe3a8; background: #0b0e14; color: #fff; font-size: 27px; text-align: center; }
.board .work :deep(.row span), .board .work :deep(.txt) { color: #fff; }
/* «Пары»: руки внизу арены по краям; запястья уходят за низ, полоса состояния закрывает их */
.pairs { overflow: hidden; }
.hand { position: absolute; top: 222px; z-index: 1; }
.hand.left { left: 8px; }
.hand.right { right: 8px; }
.hand img { display: block; width: 100%; }
.dot { position: absolute; width: 13px; height: 13px; margin: -6px 0 0 -6px; border-radius: 50%; box-shadow: 0 0 0 2px #fff; }
/* «Заявка»: строки по линовке листа (шаг линий ≈ 15,6 px — строка в две линии) */
.rows { position: absolute; left: 62px; top: 95px; display: flex; flex-direction: column; color: #2a2840; }
.th, .row :deep(.expr) { display: grid; grid-template-columns: 92px 186px 54px; align-items: center; column-gap: 6px; margin: 0; }
.th { height: 16px; font-size: 11px; text-transform: uppercase; }
.row { position: relative; height: 31.2px; }
.row :deep(.expr) { height: 31.2px; font-size: 17px; gap: 0; }
.row :deep(.txt) { line-height: 1; }
.row :deep(.sel) { height: 26px; min-width: 40px; width: 100%; padding: 0 6px; font-size: 16px; }
.row :deep(.room) { display: none; }
.row :deep(.menu) { top: 30px; }
.row.up :deep(.menu) { top: auto; bottom: 30px; }
.stamp { position: absolute; left: 438px; top: 98px; padding: 4px 9px; border: 3px double #1f6e34; border-radius: 8px; font-style: normal; font-size: 12px; font-weight: 800; line-height: 1.2; text-align: center; text-transform: uppercase; color: #1f6e34; opacity: 0.65; transform: rotate(-9deg); }
/* нижняя полоса состояния арены */
.band { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; display: flex; align-items: center; gap: 12px; height: 46px; padding: 0 14px; }
.band.miss { background: #a32a2f; color: #fff; }
.say { flex: 1; font-size: 17px; font-weight: 800; }
.go { margin-left: auto; padding: 4px 10px; border: 1.5px solid rgb(255 255 255 / 0.4); border-radius: 8px; background: rgb(14 16 40 / 0.55); color: #fff; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.band.miss .go { border-color: transparent; background: transparent; font-size: 15px; }
.go:disabled { cursor: default; }
.go kbd { margin-left: 4px; padding: 1px 5px; border-radius: 4px; background: rgb(255 255 255 / 0.18); font: inherit; font-size: 12px; }
</style>
