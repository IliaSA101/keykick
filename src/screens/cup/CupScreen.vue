<script setup lang="ts">
/**
 * Экран Кубка `/cup` (068 Т5, кадры Э5.01–.08): каркас — доска, строка экрана, вкладки «Группа C» и «Сетка» (Tab, ← →, адрес `?tab=`),
 * вкладка «Группа» — таблица, «Следующий матч», остальные группы, дорожка. Вкладку «Сетка» рисует часть 3 (`#bracket`).
 * Вид считает `app/cup/groupView` из `cupView` модели; Esc — на Дом (модель навигации), Enter — «На матч» как на Доме (матч Кубка — Т6).
 * Стенд кадров (`kk-cup-stand`): вкладка, команда под мышью и праздничная доска приходят из фикстуры.
 */
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storyArtUrl } from '../../app/art/storyArt';
import { bracketScreen, hoverPop, motionRound, wonKoCount } from '../../app/cup/bracketView';
import { groupScreen } from '../../app/cup/groupView';
import { playableRound } from '../../app/cup/run';
import { dreamText, fill } from '../../app/home/texts';
import { useGoMatch } from '../../app/home/useGoMatch';
import { useHomeInput } from '../../app/home/useHomeInput';
import { useNav } from '../../app/nav/useNav';
import { cupDef, cupView, seedOf, type Cup, type KoRound } from '../../engine/cup';
import { homeView } from '../../engine/home';
import BracketTab from '../../components/cup/BracketTab.vue';
import CupTrack from '../../components/cup/CupTrack.vue';
import GroupTable from '../../components/cup/GroupTable.vue';
import NextMatch from '../../components/cup/NextMatch.vue';
import OtherGroups from '../../components/cup/OtherGroups.vue';
import { cupGeo } from '../../components/cup/cupGeo';
import '../../components/cup/cup.css';
import '../../components/cup/bracket.css';
import KeyCap from '../../components/kit/KeyCap.vue';
import KitChip from '../../components/kit/KitChip.vue';
import ScreenHead from '../../components/league/ScreenHead.vue';
import { useStageWidth } from '../../components/home/useStageWidth';
import { isNarrowStage } from '../../components/shell/stageScale';
import { ru } from '../../i18n/ru';

type Tab = 'group' | 'bracket';
const t = ru.cup.screen;
const route = useRoute();
const router = useRouter();
const nav = useNav();
const stand = inject<(() => { tab?: Tab; hover?: string; festive?: boolean } | null) | null>('kk-cup-stand', null)?.() ?? null;
const standHome = inject<(() => { over?: { extras?: { events?: { locker?: unknown } } } } | null) | null>('kk-home-stand', null)?.() ?? null;
const { session, player, data, input, today } = useHomeInput();
const { canPlay } = useGoMatch(session);
/** «На матч» и «Сыграть финал снова»: матч Кубка раунда `next.round` (068 Т6); раунда нет (ждёт, закрыт) — холостое. */
function go(): void {
  const r = view.value ? playableRound(view.value.next, true) : null;
  if (canPlay.value && r !== null) void router.push({ path: '/match', query: { cup: r } });
}

const W = useStageWidth();
const narrow = computed(() => isNarrowStage(W.value));
const geo = computed(() => cupGeo(W.value));

/** Вкладка: адрес `?tab=bracket` (F5 и «назад» не теряют её); стенд кадра ставит свою. */
const tab = ref<Tab>(stand?.tab ?? (route.query.tab === 'bracket' ? 'bracket' : 'group'));
function setTab(next: Tab): void {
  if (tab.value === next) return;
  tab.value = next;
  void router.replace({ path: '/cup', query: next === 'bracket' ? { tab: 'bracket' } : {} });
}

const club = computed(() => data<{ name: string; city: string }>('club', { name: '', city: '' }));
const cup = computed(() => data<Cup>(cupDef.name, cupDef.empty()));
const view = computed(() => {
  const i = input.value;
  const p = player.value;
  if (!i || !p) return null;
  return cupView(cup.value, { cur: i.cur, day: today(), dayN: i.day, pause5: i.pause5, seed: seedOf(p.pid) });
});
const clubName = computed(() => club.value.name || ru.home.defaultClub);
const group = computed(() => (view.value && input.value ? groupScreen(view.value, { cur: input.value.cur, dayN: input.value.day }, clubName.value) : null));
const bracket = computed(() => (view.value && input.value ? bracketScreen(view.value, cup.value, { cur: input.value.cur, dayN: input.value.day }, clubName.value, geo.value, narrow.value) : null));
/** Команда под мышью (подсказка Э5.22); стенд кадра ставит свою. */
const hover = ref(stand?.hover ?? '');
const pop = computed(() => (view.value && bracket.value && hover.value ? hoverPop(view.value, hover.value, bracket.value, geo.value) : null));
/** Праздничная доска — титул на вкладке «Сетка» (038-Р31); стенд кадра ставит свою. */
const festive = computed(() => stand?.festive ?? (tab.value === 'bracket' && view.value?.title === 'gold'));
/** М3: раунд, выигранный с прошлого показа экрана в этой сессии (память — по игроку); «меньше движения» — сразу конечный кадр. */
const seenWon = new Map<string, number>();
const motion = ref<KoRound | null>(null);
const head = computed(() => (input.value ? homeView(input.value) : null));
const dream = computed(() => (head.value ? dreamText(head.value) : null));
/** Метка Раздевалки — событие Дома (стенд кадра Э5.08 подставляет своё). */
const locker = computed(() => (standHome?.over?.extras?.events ?? input.value?.extras.events)?.locker !== undefined);
const letter = computed(() => view.value?.groups[view.value.ours]?.letter ?? '');

function key(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (!e.repeat) nav.send({ t: 'esc' }); // удержанная клавиша не гонит Дом → дальше
  } else if (e.key === 'ArrowLeft') setTab('group');
  else if (e.key === 'ArrowRight') setTab('bracket');
  else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    setTab(tab.value === 'group' ? 'bracket' : 'group');
  } else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement) && (tab.value === 'group' ? group.value?.next?.action : bracket.value?.step?.action && !bracket.value.step.quiet)) go();
}
onMounted(() => {
  globalThis.addEventListener('keydown', key);
  const pid = player.value?.pid;
  if (pid === undefined || stand !== null) return;
  const now = wonKoCount(cup.value);
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  motion.value = reduced ? null : motionRound(seenWon.get(pid) ?? null, now);
  seenWon.set(pid, now);
});
onUnmounted(() => globalThis.removeEventListener('keydown', key));

const wall = computed(() => {
  const g = geo.value;
  return { left: '0', top: `${g.boardTop}px`, width: `${g.W}px`, height: `${g.bh}px`, backgroundImage: `url('${storyArtUrl('cupBoard')}')`, backgroundSize: `${g.iw.toFixed(1)}px ${g.ih.toFixed(1)}px`, backgroundPosition: `${g.ox.toFixed(1)}px ${g.oy.toFixed(1)}px` };
});
const field = computed(() => ({ left: `${geo.value.x.toFixed(1)}px`, top: `${geo.value.y.toFixed(1)}px`, width: `${geo.value.w.toFixed(1)}px`, height: `${geo.value.h.toFixed(1)}px` }));
const leftW = computed(() => Math.round(geo.value.w * (narrow.value ? 0.466 : 0.42)));
</script>

<template>
  <main
    v-if="view && group && head && dream"
    class="cupscreen"
    :class="{ narrow }"
  >
    <div
      class="ch-wall"
      :class="{ fest: festive }"
      :style="festive ? { ...wall, backgroundImage: `url('${storyArtUrl('cupBoardFest')}')` } : wall"
    >
      <svg
        v-if="festive"
        class="ch-festmask"
        :width="geo.W"
        :height="geo.bh"
        :viewBox="`0 0 ${geo.W} ${geo.bh}`"
        aria-hidden="true"
      >
        <defs>
          <filter
            id="ch-feather"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <mask
            id="ch-fmask"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            :width="geo.W"
            :height="geo.bh"
          >
            <rect
              :x="geo.fx.toFixed(1)"
              :y="(geo.fy - geo.boardTop).toFixed(1)"
              :width="geo.fw.toFixed(1)"
              :height="geo.fh.toFixed(1)"
              rx="6"
              fill="#fff"
              filter="url(#ch-feather)"
            />
          </mask>
        </defs>
        <image
          :href="storyArtUrl('cupBoard')"
          :x="geo.ox.toFixed(1)"
          :y="geo.oy.toFixed(1)"
          :width="geo.iw.toFixed(1)"
          :height="geo.ih.toFixed(1)"
          preserveAspectRatio="none"
          mask="url(#ch-fmask)"
        />
      </svg>
    </div>
    <svg
      width="0"
      height="0"
      style="position: absolute"
      aria-hidden="true"
    >
      <filter
        id="ch-chalk"
        x="-5%"
        y="-5%"
        width="110%"
        height="110%"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.07"
          numOctaves="2"
          seed="7"
          result="n"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n"
          scale="2.2"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
    <ScreenHead
      :title="ru.home.cup.name"
      :city="club.city || ru.map.defaultCity"
      :stars="`${head.stars.n}/${head.stars.of}`"
      :fans="head.fans.n"
      :coins="head.coins"
      :dream-text="dream.text"
      :dream-pct="dream.pct"
      :chips="[ru.home.leagueSheet]"
      @chip="router.push({ path: '/map', query: { win: 'sheet' } })"
    />
    <div
      class="ch-field"
      :style="field"
    >
      <div class="ch-bar">
        <div class="ch-tabs">
          <KitChip
            :on="tab === 'group'"
            @click="setTab('group')"
          >
            {{ fill(t.tabGroup, { letter }) }}
          </KitChip>
          <KitChip
            :on="tab === 'bracket'"
            @click="setTab('bracket')"
          >
            {{ t.tabBracket }}
          </KitChip>
          <span class="ch-keys"><KeyCap>Tab</KeyCap><KeyCap arrow="left" /><KeyCap arrow="right" /></span>
        </div>
        <p
          v-if="tab === 'group'"
          class="ch-leg"
        >
          <span><i class="ch-sw win" />{{ t.legendGroup.win }}</span>
          <span><i class="ch-sw draw" />{{ t.legendGroup.draw }}</span>
          <span><i class="ch-sw warn" />{{ t.legendGroup.replay }}</span>
        </p>
        <p
          v-else
          class="ch-leg"
        >
          <span><i class="ch-sw our" />{{ t.legendBracket.ours }}</span>
          <span><i class="ch-sw warn" />{{ t.legendBracket.wait }}</span>
          <span><i class="ch-sw tent" />{{ t.legendBracket.tent }}</span>
        </p>
      </div>
      <template v-if="tab === 'group'">
        <section
          class="ch-left"
          :style="{ width: `${leftW}px` }"
        >
          <h2 class="ch-st">
            {{ group.status }}
          </h2>
          <p
            v-if="locker"
            class="ch-lk"
          >
            <span class="kb-tag ok ch-ltag">{{ t.lockerTag }}</span>
          </p>
          <p class="ch-ru">
            {{ group.rules }}
          </p>
          <GroupTable
            :rows="group.rows"
            :after="group.after"
          />
        </section>
        <section
          class="ch-right"
          :style="{ left: `${leftW + 14}px`, width: `${(geo.w - leftW - 14).toFixed(1)}px` }"
        >
          <NextMatch
            v-if="group.next"
            :next="group.next"
            @play="go"
          />
          <OtherGroups
            :groups="group.others"
            :narrow="narrow"
          />
        </section>
        <CupTrack
          :nodes="group.track"
          :geo="geo"
          :narrow="narrow"
        />
      </template>
      <BracketTab
        v-else-if="bracket"
        :bs="bracket"
        :narrow="narrow"
        :hover="hover"
        :motion="motion"
        :field-h="geo.h"
        @play="go"
        @hover="hover = $event"
      />
    </div>
    <div
      v-if="pop && tab === 'bracket'"
      class="panel soft pop tail ch-pop ch-popd"
      :style="{ left: `${pop.left.toFixed(1)}px`, top: `${pop.top.toFixed(1)}px`, width: `${pop.w}px`, '--tail-x': `${pop.tail}px` }"
    >
      <b class="nm"><span class="ch-pp"><img
        class="ch-emi"
        :src="storyArtUrl(pop.emblem)"
        alt=""
        width="40"
        height="48"
      ><span><b>{{ pop.name }}</b><small>{{ pop.place }}</small></span></span></b>
      <p class="where">
        {{ pop.where }}
      </p>
      <p
        v-if="pop.maybe"
        class="arch"
      >
        {{ pop.maybe }}
      </p>
    </div>
  </main>
  <main
    v-else
    class="cupscreen"
  />
</template>

<style scoped>
.cupscreen {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
</style>
