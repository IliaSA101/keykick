<script setup lang="ts">
/**
 * Карточка итога матча (065 Т10а, ЭБ.25/27/30; кадры Э1.22–Э1.24): победа, поражение или «Застрял». Только показ готовой модели
 * `cardOf` (`app/result/card.ts`): ничего не считает и экранов не знает — кнопки сообщают наружу, куда идти. Общая с Кубком.
 * Единицы — базовые px сцены (как у карточек матча); золото — цвет звёзд и «главного», синюю плашку им не обводим (ТАБУ).
 */
import type { ResultCardModel } from '../../app/result/card';
import { ru } from '../../i18n/ru';
import CoachLine from '../day/CoachLine.vue';
import KeyButton from '../kit/KeyButton.vue';
import FansIcon from './FansIcon.vue';
import ResultGrew from './ResultGrew.vue';
import ResultStats from './ResultStats.vue';

defineProps<{ card: ResultCardModel; coach?: { text: string; name: string } | undefined }>();
defineEmits<{ primary: []; home: []; minute: [] }>();
const t = ru.result;
const coins = [0, 1, 2];
</script>

<template>
  <section
    class="rc panel"
    :class="[card.kind, { loss: card.kind === 'loss', coached: coach !== undefined && !card.stuck }]"
  >
    <div class="head">
      <h2>{{ card.title }}</h2>
      <p
        v-if="card.side"
        class="side"
      >
        {{ card.side }}
      </p>
      <div
        v-else-if="card.stars !== null"
        class="stars"
        :class="{ chip: card.kind !== 'loss' }"
        role="img"
        :aria-label="t.starsOf.replace('{n}', String(card.stars))"
      >
        <span
          v-for="i in 3"
          :key="i"
          :class="{ on: i <= card.stars }"
        >★</span>
      </div>
    </div>

    <template v-if="card.stuck">
      <div class="what">
        <h3>{{ card.stuck.title }}</h3>
        <p class="lead">
          {{ card.stuck.lead }}
        </p>
      </div>
      <div class="btns stuck">
        <KeyButton
          primary
          :sub="t.enter"
          @click="$emit('primary')"
        >
          {{ card.primary.label }}
        </KeyButton>
        <div
          v-if="card.help"
          class="help"
        >
          <button
            type="button"
            class="cream"
            @click="$emit('primary')"
          >
            {{ card.help.label }}
          </button>
          <small>{{ card.help.note }}</small>
        </div>
        <KeyButton
          v-if="card.minute"
          @click="$emit('minute')"
        >
          {{ card.minute }}
        </KeyButton>
        <KeyButton
          quiet
          @click="$emit('home')"
        >
          {{ card.home }}
        </KeyButton>
      </div>
      <p class="keys">
        {{ card.stuck.keys }}
      </p>
    </template>

    <template v-else>
      <div class="mid">
        <ResultStats
          v-if="card.stats"
          :stats="card.stats"
        />
        <div
          v-if="card.record"
          class="rec"
        >
          <span
            v-if="card.record.badge"
            class="badge"
          >{{ card.record.badge }}</span>
          <span class="line">{{ card.record.line }}</span>
          <span
            v-if="card.goal"
            class="line"
          >{{ card.goal }}</span>
        </div>
        <div
          v-else-if="card.goal"
          class="rec"
        >
          <span class="line">{{ card.goal }}</span>
        </div>
      </div>

      <CoachLine
        v-if="coach"
        :text="coach.text"
        :name="coach.name"
      />
      <div
        v-if="card.purse"
        class="purse"
        :class="card.purse.mode"
      >
        <template v-if="card.purse.mode === 'win'">
          <span>{{ card.purse.correct }} <i class="arrow">→</i> {{ card.purse.coins }}</span>
          <span class="coins"><i
            v-for="i in coins"
            :key="i"
          /></span>
          <span class="fans"><FansIcon />{{ card.purse.fans }}</span>
        </template>
        <ResultGrew
          v-else
          :fans="card.purse.fans"
          :coins="card.purse.coins"
          :grew="card.purse.grew"
        />
      </div>

      <p
        v-if="card.note"
        class="note"
      >
        <b v-if="card.note.lead">{{ card.note.lead }}</b> {{ card.note.text }}
      </p>

      <div class="btns">
        <KeyButton
          primary
          :sub="t.enter"
          @click="$emit('primary')"
        >
          {{ card.primary.label }}
        </KeyButton>
        <KeyButton
          v-if="card.minute"
          @click="$emit('minute')"
        >
          {{ card.minute }}
        </KeyButton>
        <KeyButton
          quiet
          @click="$emit('home')"
        >
          {{ card.home }}
        </KeyButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* как в кадре Э1.22 (kit.css .kb-result): верх 330, высота 302, пять рядов с равными промежутками */
.rc { position: absolute; left: 50%; margin-left: -370px; width: 740px; top: 330px; height: 302px; box-sizing: border-box; padding: 12px 18px; display: flex; flex-direction: column; justify-content: space-between; font-weight: 700; color: var(--text); background: linear-gradient(160deg, rgb(58 63 134), rgb(31 33 82)); }
.rc.coached { top: 290px; height: 342px; } /* строка тренера поднимает карточку на 40 px (kit result, coach) */
.head { display: flex; justify-content: space-between; align-items: center; }
h2 { margin: 0; font-size: 40px; line-height: 1.2; font-weight: 800; }
.stuck h2 { font-size: 36px; }
.side { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-muted); }
.stars { display: inline-flex; align-items: center; font-size: 40px; letter-spacing: 4px; line-height: 1; color: rgb(255 255 255 / 0.28); }
.stars.chip { padding: 6px 16px; border-radius: 14px; background: var(--award-plate); box-shadow: inset 0 0 0 1.5px var(--award-plate-edge); color: rgb(118 110 96 / 0.4); }
.stars span.on { color: #c98a00; }
.loss .stars span.on { color: var(--accent); }
.mid { display: grid; grid-template-columns: repeat(2, 170px) 1fr; align-items: start; padding-right: 40px; }
.rec { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.mid:has(dl) .rec { grid-column: 3; }
.badge { padding: 3px 12px; border-radius: 14px; background: var(--award-plate); box-shadow: inset 0 0 0 1.5px var(--award-plate-edge); color: #3a2a00; font-size: 17px; font-weight: 900; }
.line { font-size: 14px; color: var(--text-muted); }
.purse { display: flex; align-items: center; gap: 12px; font-size: 24px; font-weight: 700; white-space: nowrap; }
.arrow { font-style: normal; font-weight: 700; color: var(--text); }
.coins { display: inline-flex; gap: 4px; padding: 3px 9px; border-radius: 14px; background: var(--award-plate); box-shadow: inset 0 0 0 1.5px var(--award-plate-edge); }
.coins i { display: block; width: 20px; height: 20px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff1b0, var(--accent) 55%, #b58516); box-shadow: 0 0 0 1.5px #8a6410; }
.fans { display: inline-flex; align-items: center; gap: 6px; margin-left: 51px; font-size: 22px; }
.fans svg { width: 22px; height: 22px; fill: var(--text-muted); }
.purse.loss { font-size: 22px; gap: 20px; }
.note { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-muted); }
.note b { color: var(--zone-middle); font-weight: 700; }
.btns { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
.btns.stuck { justify-content: flex-start; align-items: flex-start; }
.btns.stuck > :last-child { margin-left: auto; }
.what { margin: 0; }
h3 { margin: 0; font-size: 22px; font-weight: 800; }
.lead { margin: 4px 0 0; font-size: 17px; font-weight: 700; color: var(--text-muted); }
.help { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.help small { font-size: 13px; color: var(--text-muted); }
.cream { height: 36px; padding: 0 18px; border-radius: 10px; border: 0; background: #efe9d8; color: #20361f; font: inherit; font-size: 17px; font-weight: 900; cursor: pointer; box-shadow: 0 3px 0 #b9b49f; }
.keys { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-muted); }
</style>
