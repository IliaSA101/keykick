<script setup lang="ts">
/**
 * Игроки (067 Т13, ТЗ-5.11, 5.12; Э2К.25, 44): страница-слой поверх Раздевалки, не окно. Сверху лестница рангов (пять плашек), ниже 8 высоких
 * колонок в порядке клавиатуры Ф Ы В А | О Л Д Ж: крупная фигура, имя пальца, «с урока N», внизу плашка ранга, полоса и число (`playersView`).
 * Рамка — по рангу (юниор — светлая, запас — бронза, основа — серебро, сборная — золото на тёмно-зелёном фоне, звезда — перелив): золото
 * лежит на зелёном, не на синем (049-Р47, ТАБУ). Шапку и закрытие (Esc, ярлык «Назад») держит экран Раздевалки; слой только показывает: записи нет.
 */
import { computed } from 'vue';
import { fill } from '../../app/home/texts';
import { artUrl, type ArtKey } from '../../art/assets';
import { playersView, rankLadder } from '../../engine/album/players';
import type { FormState } from '../../engine/form/rank';
import { ru } from '../../i18n/ru';

const props = defineProps<{ form: FormState; cur: number }>();
const t = ru.album.playersView;
const names = ru.result.purse.rankNames;
const FRAMES = ['plain', 'bronze', 'silver', 'gold', 'shine'] as const;
const cards = computed(() => playersView(props.form, props.cur));
const ladder = rankLadder();
const fig = (n: number): string => artUrl(`albumPlayer0${n}` as ArtKey);
</script>

<template>
  <section
    class="players"
    :aria-label="t.title"
  >
    <div class="lad">
      <div
        v-for="l in ladder"
        :key="l.rank"
        class="ls"
        :class="FRAMES[l.rank]"
      >
        <em class="rank">{{ names[l.rank] }}</em>
        <span>{{ l.rank === 0 ? fill(t.ladderJunior, { n: l.to }) : fill(t.ladderFrom, { n: l.from }) }}</span>
      </div>
    </div>
    <div class="pad">
      <article
        v-for="c in cards"
        :key="c.finger"
        class="pc"
        :class="[FRAMES[c.rank], { off: !c.here }]"
      >
        <span class="key">{{ c.key }}</span>
        <img
          class="fig"
          :src="fig(c.fig)"
          alt=""
        >
        <b>{{ c.pos }}</b>
        <small>{{ c.here ? fill(ru.shop.from, { n: c.from }) : fill(t.comes, { n: c.from }) }}</small>
        <div
          v-if="c.here"
          class="bot"
        >
          <em class="rank">{{ names[c.rank] }}</em>
          <div class="bar">
            <u :style="{ width: `${Math.round(c.fill * 100)}%` }" />
          </div>
          <span class="now">{{ c.acc === null ? fill(t.set, { n: c.n, w: c.window }) : fill(t.now, { acc: String(c.acc).replace('.', ',') }) }}</span>
          <small>{{ c.next === null ? t.top : fill(t.next, { name: names[c.rank + 1] ?? '', n: c.next }) }}</small>
          <small
            v-if="c.kept"
            class="kept"
          >{{ t.kept }}</small>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css, collection-e-players.css): лестница на 104, колонки с 162 высотой 420 */
.players { position: absolute; inset: 0; z-index: 5; color: var(--text); }
.lad { position: absolute; left: 16px; right: 16px; top: 104px; display: flex; gap: 10px; z-index: 4; }
.ls { box-sizing: border-box; flex: 1 1 0; height: 46px; display: flex; align-items: center; justify-content: center; gap: 12px; border-radius: 13px; background: #1a1c45; border: 3px solid #d8dbe6; box-shadow: 0 8px 18px #0006; }
.ls > span { font-size: 15px; font-weight: 800; white-space: nowrap; }
.ls .rank { font-size: 14px; padding: 2px 14px; }
.pad { position: absolute; left: 16px; right: 16px; top: 162px; height: 420px; display: flex; gap: 6px; z-index: 4; }
.pc { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 6px; border-radius: 16px; background: #1a1c45; border: 3px solid #d8dbe6; text-align: center; box-shadow: 0 12px 26px #0007; }
.pc:nth-child(4) { margin-right: 20px; }
.pc.off { opacity: 0.55; }
.pc b { font-size: 13px; line-height: 1.15; margin-top: 4px; min-height: 30px; display: flex; align-items: flex-start; justify-content: center; text-wrap: balance; }
.pc small { font-size: 11px; color: var(--text-muted); }
.key { position: absolute; left: 6px; top: 6px; z-index: 2; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: #0d0e22; font-weight: 900; font-size: 15px; }
.fig { display: block; height: 196px; width: auto; max-width: 100%; margin-top: 2px; object-fit: contain; filter: drop-shadow(0 6px 6px #0008); }
.bot { margin-top: auto; align-self: stretch; display: flex; flex-direction: column; align-items: center; gap: 2px; height: 104px; }
.bot > * { flex-shrink: 0; }
.rank { font-style: normal; font-weight: 900; text-transform: uppercase; border-radius: 9px; background: #d8dbe6; color: #0d0e22; padding: 2px 12px; font-size: 14px; }
.bar { align-self: stretch; height: 8px; margin: 5px 4px 2px; border-radius: 5px; background: #22265b; overflow: hidden; }
.bar u { display: block; height: 100%; background: #7fdca2; }
.now { font-size: 13px; font-weight: 800; white-space: nowrap; }
.kept { color: #7fdca2; }
.bronze { border-color: #b8733a; }
.silver { border-color: transparent; background: linear-gradient(#1a1c45, #1a1c45) padding-box, linear-gradient(135deg, #8f96a3, #2d3176 38%, #a2a8b4 62%, #2a2d6e) border-box; }
.gold { border-color: #e2b23a; background: #14532f; }
.shine { border-color: transparent; background: linear-gradient(#1a1c45, #1a1c45) padding-box, linear-gradient(135deg, #ff8fc2, #6fe3a0, #ffffff, #ff8fc2) border-box; }
.bronze .rank { background: #b8733a; color: #fff; }
.silver .rank { background: linear-gradient(135deg, #7d8491, #2d3176 55%, #8d94a1); color: #fff; }
.gold .rank { background: #e2b23a; color: #2a1d00; }
.shine .rank { background: linear-gradient(135deg, #ff8fc2, #6fe3a0, #ffffff); color: #0d0e22; }
.gold .bar { background: #0a2b19; }
.gold small, .gold .kept { color: #d7f2e1; }
</style>
