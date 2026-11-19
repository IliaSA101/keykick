<script setup lang="ts">
/**
 * Итог тура (Э3.20–Э3.22): медаль по первым попыткам, полоса номеров, часть эмблемы за первую медаль вида, «Реванш», «Пересдать тур» (у повтора нет), «Дальше».
 * После «Реванша» — «разобрано» или «ещё раз» (`last`); у повтора заголовок — «Повтор · вспомни пройденное»; сбой записи — `fail`.
 * Монет нет (Ш-З2). Медаль на синем — как есть (награда в синем окне, Р107); доля эмблемы — щит на светлой плашке. Только показ: запись сделал `finishRun`.
 */
import cfg from '../../content/school.json';
import { fill } from '../../app/home/texts';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import CrestShield from '../../components/school/CrestShield.vue';
import MedalMark from '../../components/school/MedalMark.vue';
import type { TourView } from '../../engine/school/finish';
import { partOf } from '../../engine/school/medal';
import { KINDS } from '../../engine/school/order';
import { ru } from '../../i18n/ru';

const props = defineProps<{ emblem: number; view: TourView; n: number; kind: string; marks: readonly boolean[]; canFix: boolean; canRetake: boolean; repeat: boolean; last: 'ok' | 'bad' | null; fail: string }>();
const emit = defineEmits<{ next: []; retake: []; fix: [] }>();
const t = ru.school.result;
const asMedal = (m: number): 1 | 2 | 3 => (m === 2 ? 2 : m === 3 ? 3 : 1);
const row = (cfg.medals as Record<string, readonly number[]>)[String(Math.min(props.view.size, 5))] ?? [0, 0, 0];
/** Доли щита: какие виды собраны (маска раздела после тура). */
const crestOn = KINDS.map((_, i) => (props.emblem & (1 << i)) !== 0);
const title = ru.school.medal[props.view.medal] ?? '';
</script>

<template>
  <KitModal
    :title="repeat ? ru.school.repeat.row : fill(t.title, { n: String(n) })"
    :lead="repeat ? '' : (ru.school.kinds[kind] ?? '')"
    :width="560"
    :top="72"
    :enter-delay="300"
    @close="emit('next')"
  >
    <div class="top">
      <MedalMark
        v-if="view.medal > 0"
        :medal="asMedal(view.medal)"
        :size="120"
        full
      />
      <div>
        <b>{{ view.medal > 0 ? fill(t.medalLine, { medal: title.charAt(0).toUpperCase() + title.slice(1), first: String(view.first), size: String(view.size) }) : t.none }}</b>
        <small>{{ fill(t.thresholds, { b: String(row[0]), s: String(row[1]), g: row[2] ? String(row[2]) : '—' }) }}</small>
        <small v-if="view.knower > 0">{{ fill(t.knower, { n: String(view.knower) }) }}</small>
      </div>
    </div>
    <div class="nums lg mini">
      <span
        v-for="(ok, i) in marks"
        :key="i"
        :class="ok ? 'ok' : 'bad'"
      >{{ i + 1 }}</span>
    </div>
    <div
      v-if="view.newPart"
      class="gain"
    >
      <CrestShield
        :on="crestOn"
        :height="80"
        :fresh="partOf(view.newPart)"
      />
      <span>
        {{ fill(t.part, { kind: ru.school.kinds[view.newPart] ?? '' }) }}<br>
        <small>{{ fill(ru.home.emblem, { n: String(view.emblemN) }) }}</small>
      </span>
    </div>
    <p
      v-if="last"
      class="part"
      role="status"
    >
      {{ last === 'ok' ? ru.school.tour.retry : ru.school.tour.again }}
    </p>
    <p
      v-if="fail"
      class="fail"
      role="alert"
    >
      {{ fail }}
    </p>
    <div class="foot">
      <div
        v-if="view.missed.length > 0"
        class="fix"
      >
        <span>{{ fill(t.missed, { n: String((view.missed[0] ?? 0) + 1) }) }}<small>{{ t.revanche }}</small></span>
        <KeyButton
          v-if="canFix"
          md
          @click="emit('fix')"
        >
          {{ t.revancheBtn }}
        </KeyButton>
      </div>
      <div class="btns">
        <KeyButton
          primary
          :sub="ru.kit.enter"
          @click="emit('next')"
        >
          {{ ru.result.next }}
        </KeyButton>
        <KeyButton
          v-if="canRetake"
          quiet
          :sub="t.retakeSub"
          @click="emit('retake')"
        >
          {{ t.retake }}
        </KeyButton>
      </div>
    </div>
  </KitModal>
</template>

<style scoped>
/* итог тура: медаль на синем как есть (награда в синем окне — Р107), доля эмблемы на своей светлой плашке; размеры — s-result-1920 */
.top { display: flex; gap: 16px; align-items: center; justify-content: center; text-align: left; }
.top b { display: block; font-size: 22px; }
.top small { display: block; color: var(--text-muted); font-size: 14px; font-weight: 700; }
.nums { display: flex; justify-content: center; margin: 6px 0; }
.nums.lg.mini span.ok { border-bottom-color: var(--paper-correct); }
.nums.lg.mini span.bad { border-bottom-color: var(--paper-wrong); }
.gain { display: flex; align-items: center; gap: 12px; margin-top: 6px; padding: 6px 14px; border-radius: 12px; background: rgb(255 255 255 / 0.08); font-size: 15px; font-weight: 700; text-align: left; }
.gain small { font-size: 14px; font-weight: 400; color: var(--text-muted); }
.part { margin: 4px 0; font-weight: 700; }
.fail { margin: 6px 0; padding: 8px 12px; border-radius: 8px; background: #fdeaea; color: var(--paper-wrong); font-weight: 700; }
.foot { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.fix { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 15px; font-weight: 700; text-align: left; }
.fix small { display: block; margin-top: 2px; font-size: 13px; font-weight: 600; color: var(--text-muted); }
.btns { display: flex; gap: 12px; }
.btns .key-btn { flex: none; min-height: 44px; }
.btns .key-btn.quiet { flex: 1; }
</style>
