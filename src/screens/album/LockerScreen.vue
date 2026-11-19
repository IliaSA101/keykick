<script setup lang="ts">
/**
 * Раздевалка (067 Т13, ТЗ-5.2, 5.5, 5.7; Э2К.11–21, 42): слева форма на вешалке («На тебе»), справа стенд альбома: форма клуба, 13 форм
 * альбома, полученные призовые. «Надеть» — только у собранной и полученной (`lockerWear`), запись через сеанс (статус не `ok` — закрыто,
 * сбой записи — причина на экране, `saveFail`); повтор на уже надетой ничего не пишет. «Рассмотреть» — окно крупно, «Игроки» — карточки рангов.
 * «Имя и номер ›» — окно клуба (`useClubEdit`), бутсы — по купленному (`bootPairs`). Esc — Дом (окно закрывает себя само). Вторая вкладка (`readonly`) — только просмотр.
 */
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BOOT_ART, lookOf } from '../../app/album/locker';
import { useClubEdit } from '../../app/club/edit';
import { dreamText, fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { saveFail } from '../../app/school/gate';
import { artUrl } from '../../art/assets';
import { useStageWidth } from '../../components/home/useStageWidth';
import ClubEditWindow from '../../components/club/ClubEditWindow.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitChip from '../../components/kit/KitChip.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import ScreenHead from '../../components/league/ScreenHead.vue';
import { bootPairs, lockerView, lockerWear, milestoneDeco, type Hanger } from '../../engine/album/locker';
import { albumDef, type Album } from '../../engine/album/section';
import { clubDef, type Club } from '../../engine/club/section';
import { COACHES, DEFAULT_COACH } from '../../engine/club/start';
import { shopDef, type Shop } from '../../engine/shop/section';
import { emptyForm, type FormState } from '../../engine/form/rank';
import { homeView } from '../../engine/home';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import KitView from './KitView.vue';
import LockerCard from './LockerCard.vue';
import LockerHanger from './LockerHanger.vue';
import PlayersView from './PlayersView.vue';

const t = ru.album.locker;
const router = useRouter();
// ширина сцены в базовых px (1138 на 1920, 1024 на узком окне): от неё — ось шкафчика и левый край стенда (Э2К.11/.12)
const width = useStageWidth();
const axis = computed(() => Math.round(451 * 0.597 - (width.value > 1024 ? 4.2 : 0)));
const standLeft = computed(() => (width.value > 1024 ? 432 : 358));
const { session, input, data } = useHomeInput();
const club = computed<Club>(() => data<Club>('club', clubDef.empty()));
const album = computed<Album>(() => data<Album>(albumDef.name, albumDef.empty()));
const shop = computed<Shop>(() => data<Shop>(shopDef.name, shopDef.empty()));
const boots = computed(() => bootPairs(shop.value.bought));
const wornBoots = computed(() => artUrl(BOOT_ART[(boots.value.find((b) => b.worn) ?? boots.value[0]!).id]));
const coach = computed(() => (COACHES.some((c) => c.id === club.value.coach) ? club.value.coach : DEFAULT_COACH));
const edit = useClubEdit(session, club, coach);
const form = computed<FormState>(() => data<FormState>('form', emptyForm()));
const view = computed(() => lockerView(album.value));
const home = computed(() => (input.value ? homeView(input.value) : null));
const head = computed(() => (home.value ? dreamText(home.value) : null));
const editable = computed(() => session.status.value === 'ok');
const back = computed(() => ({ name: club.value.backName, number: club.value.backNumber }));
const worn = computed(() => lookOf(album.value.worn, club.value.kit));
// отделка надетой: у «Звёздных» своя (кант, блик, звёзды), у прочих — кант вехи по звёздам ребёнка (ТЗ-4.3)
const deco = computed(() => (Object.keys(worn.value.deco).length > 0 ? worn.value.deco : milestoneDeco(home.value?.stars.n ?? 0)));
// сдвиг сцены и край правой стойки в базовых px макета: на 1920 — (4,2; 154,5), на 1024 — (0; 150)
const wide = computed(() => width.value > 1024);
// стенд кадров (только разработка): окно, открытое на кадре; в игре поставщика нет, окно открывает ребёнок
const stand = inject<(() => { view?: 'kit' | 'players'; start?: string }) | null>('kk-locker-stand', null)?.() ?? null;
const mode = ref<'stand' | 'view' | 'players' | 'edit'>(stand?.view === 'kit' ? 'view' : stand?.view === 'players' ? 'players' : 'stand');
const viewId = ref(stand?.start ?? '');
/** Карточка в фокусе (кнопки — только у неё): на открытии никакой — на кадрах Э2К.11, 18 кнопок нет (067-Р139); дальше — куда ребёнок щёлкнул или дошёл Tab. */
const picked = ref<string | null>(null);
/** Причина, по которой «Надеть» не записалось (закрыто или сбой записи); пусто — всё хорошо. */
const fail = ref('');

/** «Надеть»: форма уже на тебе — записи нет (двойной Enter); несобранная — отказ; иначе одна запись раздела `album`. */
function wear(id: string | null): void {
  if (!editable.value) return;
  const r = lockerWear(album.value, id);
  if (!r.ok || !r.changed) return;
  fail.value = saveFail(session.save({ [albumDef.name]: r.album })) ?? '';
}
/** «Имя и номер ›»: окно «Твой клуб» над Раздевалкой (то же, что «Изменить» в Клубе); «Сохранить» пишет клуб и возвращает в Раздевалку, отказ записи окно не закрывает. */
function openEdit(): void {
  if (!editable.value) return;
  edit.open();
  mode.value = 'edit';
}
function saveClub(): void {
  if (edit.save()) mode.value = 'stand';
}
function show(id: string): void {
  viewId.value = id;
  mode.value = 'view';
}
const needText = (h: Hanger): string => plural(h.need, { one: fill(ru.home.peek.left.one, { n: h.need }), few: fill(ru.home.peek.left.few, { n: h.need }), many: fill(ru.home.peek.left.many, { n: h.need }), other: fill(ru.home.peek.left.many, { n: h.need }) });
const nameOf = (h: Hanger): string => lookOf(h.id, club.value.kit).name ?? '';
function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.key !== 'Escape') return; // окно («Рассмотреть», «Имя и номер ›») уже закрыло себя этим Esc
  if (mode.value === 'stand') void router.push('/home');
  else if (mode.value === 'players') mode.value = 'stand';
}
/** Ярлык шапки: в Раздевалке — «Дом», на странице игроков — назад в Раздевалку (Esc делает то же). */
function onChip(): void {
  if (mode.value === 'players') mode.value = 'stand';
  else void router.push('/home');
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onUnmounted(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <main class="locker">
    <img
      class="scene"
      :src="artUrl('albumLockerIn')"
      alt=""
      :class="{ blur: mode === 'players' }"
    >
    <div class="scrim" />
    <ScreenHead
      v-if="home && head && input"
      :title="mode === 'players' ? ru.album.playersView.title : ru.home.houses.locker"
      :city="`«${club.name}»`"
      :stars="`${home.stars.n}/${home.stars.of}`"
      :fans="home.fans.n"
      :coins="home.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[`${mode === 'players' ? ru.handsHelp.back : ru.frame.menu.home} · ${ru.kit.esc}`]"
      @chip="onChip"
    />
    <LockerHanger
      v-if="mode !== 'players'"
      :cx="axis"
      :ox="wide ? 4.2 : 0"
      :rod-end="wide ? 154.5 : 150"
      :kit="worn.kit"
      :deco="deco"
      :back="back"
      :name="worn.plate ?? worn.name ?? t.clubName"
      :boots="wornBoots"
    />
    <span
      v-if="mode !== 'players'"
      class="chipn"
      :style="{ left: `${axis - 52}px` }"
    >
      <KitChip
        sm
        :disabled="!editable"
        @click="openEdit"
      >{{ t.nameNumber }}</KitChip>
    </span>
    <KitPanel
      v-if="mode !== 'players'"
      soft
      class="stand"
      :style="{ left: `${standLeft}px` }"
    >
      <header>
        <h2>{{ t.standHead }}</h2>
        <span>{{ fill(t.albumCount, { n: view.parts, all: view.total, full: view.full, of: view.kits.length }) }}</span>
        <em v-if="view.foilFrom">{{ fill(t.foilNote, { from: view.foilFrom, to: view.kits.length }) }}</em>
        <KeyButton
          md
          @click="mode = 'players'"
        >
          {{ ru.parent.players.title }}
        </KeyButton>
      </header>
      <p
        v-if="fail"
        class="fail"
        role="alert"
      >
        {{ fail }}
      </p>
      <p
        v-else-if="!editable"
        class="muted"
      >
        {{ t.readonly }}
      </p>
      <!-- «N из 3» в `foot` — общая строка (у звёзд результата та же): `ru.result.starsOf`, второй копии в альбоме нет -->
      <ul class="grid g7">
        <LockerCard
          v-for="h in view.kits"
          :key="h.id"
          :kit="lookOf(h.id, club.kit).kit"
          :label="nameOf(h)"
          :title="nameOf(h)"
          :have="h.have"
          :foil="h.foil"
          :foot="h.state === 'locked' ? fill(ru.result.starsOf, { n: h.have.filter(Boolean).length }) : t.done"
          :more="h.state === 'locked' ? (h.have.some(Boolean) ? needText(h) : t.locked) : ''"
          :state="h.state"
          :focus="picked === h.id"
          :can-view="h.state !== 'locked'"
          :editable="editable"
          @pick="picked = h.id"
          @wear="wear(h.id)"
          @view="show(h.id)"
        />
        <LockerCard
          :kit="club.kit"
          :label="t.clubName"
          :title="t.clubName"
          :have="[true, true, true]"
          :foot="t.clubSub"
          :state="view.clubWorn ? 'worn' : 'wearable'"
          :focus="picked === 'club'"
          :can-view="false"
          :editable="editable"
          @pick="picked = 'club'"
          @wear="wear(null)"
        />
      </ul>
      <p class="sub">
        {{ t.prizeHead }}<span>{{ t.prizeSub }}</span>
      </p>
      <ul class="grid g6">
        <LockerCard
          v-for="h in view.prizes"
          :key="h.id"
          :kit="lookOf(h.id, club.kit).kit"
          :label="nameOf(h)"
          :title="nameOf(h)"
          prize
          :why="lookOf(h.id, club.kit).why"
          :have="h.have"
          :foot="h.state === 'locked' ? t.prizeNone : t.prizeHave"
          :state="h.state"
          :focus="picked === h.id"
          :can-view="false"
          :editable="editable"
          @pick="picked = h.id"
          @wear="wear(h.id)"
        />
      </ul>
      <div class="boots">
        <span class="lab">{{ t.boots.head }}</span>
        <span
          v-for="b in boots"
          :key="b.id"
          class="bt"
          :class="{ on: b.worn }"
        >
          <img
            :src="artUrl(BOOT_ART[b.id])"
            alt=""
          >
          <i>{{ b.worn ? t.boots.on : t.boots[b.id] }}</i>
        </span>
      </div>
    </KitPanel>
    <KitView
      v-if="mode === 'view'"
      :ids="view.viewable"
      :start="viewId"
      :worn="album.worn"
      :club="club.kit"
      :boots="wornBoots"
      :back="back"
      :editable="editable"
      @wear="wear"
      @close="mode = 'stand'"
    />
    <ClubEditWindow
      v-if="mode === 'edit'"
      v-model:draft="edit.draft"
      @save="saveClub"
      @cancel="mode = 'stand'"
    />
    <PlayersView
      v-if="mode === 'players'"
      :form="form"
      :cur="input?.cur ?? 1"
    />
  </main>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css, collection-e-locker.css): сцена по левому верху, стенд справа от шкафчика; шкафчик сцены — слева */
.locker { position: absolute; inset: 0; overflow: hidden; color: var(--text); }
.scene { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: left top; }
.scene.blur { filter: blur(9px) brightness(0.52) saturate(0.85); transform: scale(1.06); }
.scrim { position: absolute; inset: 0 0 auto; height: 170px; background: linear-gradient(#000d 0, #000b 55%, #0000); pointer-events: none; }
.stand { position: absolute; right: 16px; top: 96px; bottom: 28px; z-index: 4; padding: 9px 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
.stand header { display: flex; align-items: baseline; gap: 10px; }
.stand h2 { margin: 0; font-size: 16px; }
.stand header > span, .stand header > em { font-size: 11px; font-style: normal; color: var(--text-muted); }
.stand header > :last-child { margin-left: auto; align-self: center; }
.muted { margin: 0; color: var(--text-muted); font-size: 12px; }
.fail { margin: 0; color: #ffb4a8; font-weight: 700; }
.sub { margin: 0; display: flex; align-items: baseline; gap: 10px; font-size: 16px; font-weight: 800; }
.sub span { font-size: 11px; font-weight: 400; color: var(--text-muted); }
.grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
/* высоты рядов — по кадру Э2К.11 (альбом 412, призовые 241 из 1920); внизу строка бутсов (62 из 1920) */
.g7 { grid-template-columns: repeat(7, 1fr); flex: 412 1 0; min-height: 0; grid-auto-rows: 1fr; gap: 7px; }
.g6 { grid-template-columns: repeat(6, 1fr); flex: 241 1 0; min-height: 0; }
.chipn { position: absolute; top: 182px; z-index: 5; }
/* строка бутсов — Э2К.11 (.ce-boots): подпись зелёная, надетая пара подсвечена зелёным; кеды и пары Лавки — картинками пары */
.boots { flex: none; display: flex; align-items: center; gap: 12px; padding: 5px 10px; border-radius: 10px; background: #1a1c45; }
.lab { font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #9fe3b8; }
.bt { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); }
.bt img { height: 28px; width: auto; }
.bt i { font-style: normal; color: #d6d8e2; }
.bt.on, .bt.on i { color: #7fdca2; font-weight: 800; }
.bt.on img { filter: drop-shadow(0 0 6px #7fdca2); }
</style>
