<script setup lang="ts">
/**
 * Карточка итога матча Кубка (068 Т6, кадры Э5.26–.28): слева — заголовок, числа, «что выросло», метки; справа — таблица группы и «что дальше»;
 * внизу — кнопки. Только показ готовой `CupCard` (`app/cup/resultCard`): ничего не считает, экранов не знает.
 */
import { storyArtUrl } from '../../app/art/storyArt';
import type { CupCard } from '../../app/cup/resultCard';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';
import ResultGrew from '../result/ResultGrew.vue';
import ResultStats from '../result/ResultStats.vue';

defineProps<{ card: CupCard }>();
defineEmits<{ primary: []; home: [] }>();
const r = ru.cup.result;
</script>

<template>
  <section
    class="card panel cupres"
    :class="[card.kind, { short: card.replay }]"
  >
    <div class="l">
      <h2>{{ card.title }}</h2>
      <p
        v-if="card.lead"
        class="lead"
      >
        {{ card.lead }}
      </p>
      <template v-if="card.stats">
        <div class="stats">
          <ResultStats :stats="card.stats" />
        </div>
        <ResultGrew
          :fans="card.purse.fans"
          :coins="card.purse.coins"
          :grew="card.grew"
        />
      </template>
      <p
        v-else
        class="rew"
      >
        <b>{{ card.purse.correct }} → {{ card.purse.coins }}</b><span>{{ card.purse.fans }}</span>
      </p>
      <p
        v-if="card.pack"
        class="tag"
      >
        {{ card.pack }}
      </p>
      <p
        v-if="card.done"
        class="tag"
      >
        {{ card.done }}
      </p>
    </div>
    <div class="r">
      <div
        v-if="card.series"
        class="sres"
      >
        <p>{{ card.series.head }}</p>
        <span
          v-for="row in card.series.rows"
          :key="row.name"
        ><img
          :src="storyArtUrl(row.emblem)"
          alt=""
          width="20"
          height="24"
        ><b>{{ row.name }}</b><i
          v-for="(m, i) in row.shots"
          :key="i"
          class="mk"
          :class="m"
        >{{ m === 'goal' ? '✓' : '✕' }}</i></span>
      </div>
      <table
        v-if="card.table"
        class="tab"
      >
        <thead>
          <tr>
            <th /><th>{{ card.table.head }}</th><th>{{ r.colP }}</th><th>{{ r.colGoals }}</th><th>{{ ru.cup.screen.colPts }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in card.table.rows"
            :key="row.name"
            :class="{ our: row.our }"
          >
            <td>{{ row.place }}</td>
            <td class="nm">
              <img
                :src="storyArtUrl(row.emblem)"
                alt=""
                width="20"
                height="24"
              >{{ row.name }}
            </td>
            <td>{{ row.p }}<i v-if="row.rep"> ↻</i></td>
            <td>{{ row.goals }}</td>
            <td><b>{{ row.pts }}</b></td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="card.note"
        class="note"
      >
        {{ card.note }}
      </p>
    </div>
    <div class="btns">
      <KeyButton
        primary
        :sub="ru.result.enter"
        @click="$emit('primary')"
      >
        {{ card.primary.label }}
      </KeyButton>
      <span style="flex: 1" />
      <KeyButton
        quiet
        @click="$emit('home')"
      >
        {{ card.quiet }}
      </KeyButton>
    </div>
  </section>
</template>

<style scoped>
.cupres { position: absolute; left: 50%; margin-left: -370px; width: 740px; top: 330px; height: 302px; box-sizing: border-box; padding: 14px 20px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr auto; gap: 8px 20px; }
.cupres.short { height: 244px; }
h2 { margin: 0 0 4px; font-size: 24px; }
.lead { margin: 0 0 8px; color: var(--text-muted); font-size: 15px; }
.rew { display: flex; flex-direction: column; gap: 2px; margin: 0 0 8px; font-size: 16px; }
.stats { display: flex; gap: 26px; margin: 0 0 8px; }
.sres { display: flex; flex-direction: column; gap: 6px; margin: 0 0 6px; }
.sres p { margin: 0; font-size: 18px; font-weight: 800; color: var(--text-muted); }
.sres span { display: flex; align-items: center; gap: 8px; font-size: 19px; }
.sres b { flex: 1; min-width: 0; }
.mk { display: inline-grid; place-items: center; box-sizing: border-box; width: 26px; height: 26px; border-radius: 50%; font-size: 16px; font-style: normal; font-weight: 900; line-height: 1; color: #fff; }
.mk.goal { background: #2e9e4c; }
.mk.miss { background: #e07b39; }
.tag { margin: 0 0 6px; padding: 2px 10px; border-radius: 10px; background: rgb(60 184 90 / 0.22); font-size: 14px; width: fit-content; }
.tab { width: 100%; border-collapse: collapse; font-size: 14px; }
.tab th { text-align: left; color: var(--text-muted); font-weight: 500; padding: 2px 4px; }
.tab td { padding: 2px 4px; }
.tab tr.our { background: rgb(255 255 255 / 0.16); }
.nm { display: flex; gap: 6px; align-items: center; }
.tab i { font-style: normal; }
.note { margin: 8px 0 0; font-size: 14px; color: var(--text-muted); }
.btns { grid-column: 1 / 3; display: flex; gap: 10px; align-items: center; }
</style>
