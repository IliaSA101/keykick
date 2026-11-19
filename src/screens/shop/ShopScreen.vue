<script setup lang="ts">
/**
 * Лавка двора (067 Т12, ТЗ-3.6–3.10; кадры Э2К.01–04): над размытым двором ребёнка (067-Р13: основа Дома из печи, не живая сцена) —
 * слева «мечта», справа сетка вещей Двора. «Купить» открывает подтверждение; списание — `engine/shop/buy` через `buyPatch`
 * (двойной Enter — одна покупка). Esc или «Дом · Esc» — домой. Вторая вкладка (`readonly`) — только просмотр: кнопки погашены.
 */
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { dreamText, fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { buyPatch, coin, shopView, type ShopItem } from '../../app/shop/input';
import HomeBackdrop from '../../components/home/HomeBackdrop.vue';
import { useStageWidth } from '../../components/home/useStageWidth';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import ScreenHead from '../../components/league/ScreenHead.vue';
import { isNarrowStage } from '../../components/shell/stageScale';
import { clubDef, type Club } from '../../engine/club/section';
import { homeView } from '../../engine/home';
import type { Wallet } from '../../engine/rewards/section';
import { shopDef, type Shop } from '../../engine/shop/section';
import { ru } from '../../i18n/ru';
import ShopConfirm from './ShopConfirm.vue';
import ShopGrid from './ShopGrid.vue';
import ShopThumb from './ShopThumb.vue';

const t = ru.shop;
const W = useStageWidth();
const router = useRouter();
const { session, input, data } = useHomeInput();
const club = computed<Club>(() => data<Club>('club', clubDef.empty()));
const view = computed(() => (input.value ? shopView(input.value) : null));
const home = computed(() => (input.value ? homeView(input.value) : null));
const head = computed(() => (home.value ? dreamText(home.value) : null));
/** 1024: колонка мечты уже (226), вещи ниже (52 и 96) — `.w1024` макета Э2К. */
const narrow = computed(() => isNarrowStage(W.value));
const editable = computed(() => session.status.value === 'ok');
/** Стенд кадров: вещь, чьё подтверждение открыто на кадре (Э2К.03); в игре — null. */
const stand = inject<(() => { ask?: string }) | null>('kk-shop-stand', null)?.() ?? null;
const asking = ref<ShopItem | null>(null);
watch(view, (v) => {
  if (v && stand?.ask !== undefined && asking.value === null) asking.value = v.items.find((x) => x.id === stand.ask && x.state === 'can') ?? null;
}, { immediate: true });

function ask(id: string): void {
  if (!editable.value) return;
  asking.value = view.value?.items.find((x) => x.id === id && x.state === 'can') ?? null;
}
/** «Купить» в окне: одна запись wallet + shop; не вышло (рано, мало монет, уже куплено) — окно просто закрывается. */
function confirm(): void {
  const item = asking.value;
  asking.value = null;
  if (!item || !input.value) return;
  const r = buyPatch({ wallet: data<Wallet>('wallet', { coins: 0, rest: 0, paid: [] }), shop: data<Shop>(shopDef.name, shopDef.empty()) }, item.id, input.value.cur);
  if (r.patch) session.save(r.patch);
}
function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented) return; // окно покупки уже закрыло себя этим Esc
  if (e.key === 'Escape' && asking.value === null) void router.push('/home');
  // Enter на экране — главная кнопка: купить мечту, если хватает (в кнопке в фокусе Enter жмёт её сам)
  else if (e.key === 'Enter' && !e.repeat && asking.value === null && !(e.target instanceof HTMLButtonElement) && view.value?.dream?.state === 'can') {
    e.preventDefault();
    ask(view.value.dream.id);
  }
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onUnmounted(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <main class="shop">
    <HomeBackdrop
      v-if="input"
      mode="scene"
      :input="input"
      :kit="club.kit"
    />
    <ScreenHead
      v-if="home && head && input"
      :title="t.title"
      :city="`«${club.name}»`"
      :stars="`${home.stars.n}/${home.stars.of}`"
      :fans="home.fans.n"
      :coins="home.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[`${ru.frame.menu.home} · ${ru.kit.esc}`]"
      @chip="router.push('/home')"
    />
    <div
      v-if="view && input"
      class="layout"
      :class="{ narrow }"
    >
      <KitPanel
        soft
        class="dreamp"
      >
        <span class="lab">{{ t.dreamLabel }}</span>
        <template v-if="view.dream">
          <ShopThumb
            :id="view.dream.id"
            :height="narrow ? 96 : 116"
            tall
            :off="view.dream.state === 'later'"
          />
          <h2>{{ view.dream.name }}</h2>
          <p class="muted">
            {{ t.where[view.dream.id] }}
          </p>
          <div class="bar">
            <u :style="{ width: `${view.dream.state === 'later' ? 0 : Math.min(100, Math.round((input.coins / view.dream.price) * 100))}%` }" />
          </div>
          <p class="num">
            {{ view.dream.state === 'can' ? fill(t.dreamCan, { price: coin(view.dream.price) }) : view.dream.state === 'later' ? fill(t.dreamPrice, { price: coin(view.dream.price) }) : fill(t.dreamSaved, { coins: coin(input.coins), price: view.dream.price }) }}
          </p>
          <KeyButton
            v-if="view.dream.state === 'can'"
            primary
            md
            v-bind="asking ? {} : { sub: ru.kit.enter }"
            :state="editable ? undefined : 'off'"
            @click="ask(view.dream.id)"
          >
            {{ t.buy }} {{ coin(view.dream.price) }}
          </KeyButton>
          <p
            v-else
            class="muted"
          >
            {{ view.dream.state === 'later' ? fill(t.from, { n: view.dream.from }) : fill(t.dreamSaving, { n: coin(view.dream.left) }) }}
          </p>
          <p class="tiny">
            {{ t.dreamHint }}
          </p>
        </template>
        <template v-else>
          <ShopThumb
            id="yard-whole"
            :height="narrow ? 96 : 116"
            tall
          />
          <h2>{{ t.allTitle }}</h2>
          <p class="muted">
            {{ t.allText }}
          </p>
        </template>
      </KitPanel>
      <KitPanel
        soft
        class="gridp"
      >
        <ShopGrid
          :items="view.items"
          :dream="view.dream?.id ?? null"
          :locked="!editable"
          :height="narrow ? 52 : 70"
          :focus="asking?.id"
          @buy="ask"
        />
      </KitPanel>
    </div>
    <ShopConfirm
      v-if="asking && input"
      :item="asking"
      :coins="input.coins"
      @buy="confirm"
      @close="asking = null"
    />
  </main>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css: .ce-shop, .ce-dreamp, .ce-shopg) */
.shop { position: absolute; inset: 0; overflow: hidden; }
.layout { position: absolute; left: 16px; right: 16px; top: 96px; bottom: 28px; z-index: 4; display: flex; gap: 12px; }
.dreamp { flex: 0 0 250px; display: flex; flex-direction: column; gap: 3px; box-sizing: border-box; position: relative; }
.layout.narrow .dreamp { flex-basis: 226px; }
.gridp { flex: 1; padding: 10px; box-sizing: border-box; position: relative; }
.lab { display: block; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #9fe3b8; }
/* заголовок вещи — общий `.card h2` (26 px, как в макете: у `.ce-h` 20 px перекрыты тем же правилом) */
.muted { margin: 0; font-size: 13px; color: var(--text-muted); }
.tiny { margin: 0; font-size: 11px; color: var(--text-muted); }
.num { margin: 2px 0; font-size: 13px; font-weight: 800; }
.bar { height: 8px; margin: 5px 0 2px; border-radius: 5px; background: #22265b; overflow: hidden; }
.bar u { display: block; height: 100%; background: #7fdca2; }
</style>
