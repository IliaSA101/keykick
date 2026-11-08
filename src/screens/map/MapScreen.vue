<script setup lang="ts">
// Карта Двора (спека 019, design §1, §5): где ребёнок на пути из 32 уроков. Шапка (клуб, звёзды, монеты, входы), поле с
// точками, карточкой урока или места, до первого доигранного матча — пузырь тренера; в углу версия, «Что нового»
// и «Старая версия». Клавиатура без мыши (ТЗ-0.16): стрелки по точкам, Tab по группам (шапка — последняя, в DOM она
// после поля, на экране — сверху), Enter — карточка и «Играть», Esc — закрыть карточку или окно; решает `app/map/keys`.
// Окна (лист лиги, «Что нового», правка клуба) лежат поверх, остальное под ними `inert`; при закрытии фокус
// возвращается на кнопку, откуда открыли, или на точку/место. Запись в сохранение — только «Готово» правки клуба и
// отметка «Что нового увидено»; «Играть» уводит на матч урока.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clubRef, coachData, markNewsSeenNow } from '../../app/club/club';
import { courseLessons } from '../../app/course/load';
import { clubNeedsFix, EDIT_QUERY, overlayFromQuery, type Overlay } from '../../app/map/chrome';
import { matchTo, PATH_PATH } from '../../app/map/go';
import { keyAction } from '../../app/map/keys';
import { coins, cpmOf, focusFromQuery, greeting, mapModel } from '../../app/map/state';
import { oldVersionUrl } from '../../app/versions/build';
import { APP_VERSION } from '../../app/version';
import { pending, replay, type NewsCard as NewsCardData } from '../../app/whatsNew';
import ClubEdit from '../../components/club/ClubEdit.vue';
import CoachBubble from '../../components/coach/CoachBubble.vue';
import LeagueSheet from '../../components/map/LeagueSheet.vue';
import LessonCard from '../../components/map/LessonCard.vue';
import { placeInfo } from '../../components/map/labels';
import MapHeader from '../../components/map/MapHeader.vue';
import NewsCard from '../../components/map/NewsCard.vue';
import PlaceCard from '../../components/map/PlaceCard.vue';
import YardMap from '../../components/map/YardMap.vue';
import { coachOf } from '../../engine/coach/coach';
import { HEADER_FOCUS } from '../../engine/map/focus';
import { isPlayablePoint } from '../../engine/map/model';
import { ru } from '../../i18n/ru';

const route = useRoute();
const router = useRouter();

const ctx = computed(() => mapModel.value);
const names = Object.fromEntries(courseLessons.map((l) => [l.id, l.name]));

const root = ref<HTMLElement | null>(null);
// Фокус по умолчанию — текущий урок; `?focus=` в dev-сборке ставит другой (быстрые проверки и кадры).
const active = ref(ctx.value ? focusFromQuery(route.query.focus, ctx.value.model, import.meta.env.DEV) : '');
const cardOpen = ref(true);
const going = ref(false);

const coach = computed(() => coachOf(coachData, clubRef.value.coach));
const clubName = computed(() => clubRef.value.name.trim() || ru.clubForm.pickName);

const point = computed(() => {
  const p = ctx.value?.model.points.find((x) => x.id === active.value);
  return p && isPlayablePoint(p) ? p : null;
});

/** Флажок, здание или ворота в фокусе — их карточка. */
const place = computed(() => {
  const c = ctx.value;
  return c && !point.value ? placeInfo(c.model, active.value, { cup: c.input.league.cup, nextLeague: c.input.nextLeague?.name ?? '' }) : null;
});

const card = computed(() => (cardOpen.value ? point.value : null));
const shownPlace = computed(() => (cardOpen.value ? place.value : null));

// Окна поверх карты. Адрес `?sheet|news=1` (dev) открывает их для кадров, `?edit=1` (все сборки) — правку клуба (меню «Клуб»); иначе «Что нового» встаёт само,
// если игрок не видел новостей (новичку отметка равна версии — карточки нет).
const asked = overlayFromQuery(route.query, import.meta.env.DEV);
const hasEditQuery = (): boolean => route.query.edit !== undefined;
const news = ref<NewsCardData | null>(asked === 'news' ? replay() : asked === null ? pending(clubRef.value.newsSeen) : null);
const overlay = ref<Overlay | null>(news.value ? 'news' : asked === 'sheet' || asked === 'edit' ? asked : null);
const canReplay = replay() !== null;
const fix = computed(() => clubNeedsFix(clubRef.value));
const oldUrl = oldVersionUrl(import.meta.env.BASE_URL);
let opener: HTMLElement | null = null;
// После закрытия окна двойной щелчок не должен попасть в «Играть» под ним (как на главной v1).
const SETTLE_MS = 400;
const settling = ref(false);

const elOf = (id: string): HTMLElement | null => root.value?.querySelector<HTMLElement>(`[data-focus="${id}"]`) ?? null;

function focusOn(id: string): void {
  active.value = id;
  cardOpen.value = true;
  elOf(id)?.focus({ preventScroll: true });
}

function play(id: string): void {
  if (going.value || settling.value) return;
  going.value = true;
  // Кнопка заперта до смены маршрута: двойной Enter или щелчок — один переход.
  void router.push(matchTo(id)).finally(() => {
    going.value = false;
  });
}

/**
 * Открыть лист или правку; `from` — кнопка, на которую вернётся фокус. Правка живёт и в адресе (`?edit=1`): по нему
 * пункт меню «Клуб» светится, пока окно открыто; закрытие убирает его (`replace`), и F5 окно заново не открывает.
 */
function openOverlay(what: 'sheet' | 'edit', from: HTMLElement | null): void {
  opener = from;
  overlay.value = what;
  if (what === 'edit' && !hasEditQuery()) void router.replace({ query: { ...route.query, ...EDIT_QUERY } });
}

// Адрес меняется под открытой картой (экран тот же): «Клуб» в меню открывает правку, «Карта» — закрывает.
watch(
  () => route.query.edit,
  (edit) => {
    if (edit !== undefined && overlay.value === null) openOverlay('edit', null);
    // Лист или «Что нового» открыты — они остаются, лишний `edit` из адреса убираем (правку откроет следующий клик).
    else if (edit !== undefined && overlay.value !== 'edit') {
      const rest = { ...route.query };
      delete rest.edit;
      void router.replace({ query: rest });
    } else if (edit === undefined && overlay.value === 'edit') closeOverlay();
  },
);

function openNews(e: Event): void {
  opener = e.currentTarget as HTMLElement;
  news.value = replay();
  overlay.value = news.value ? 'news' : null;
}

/** Закрыть окно: фокус — туда, откуда открыли (если кнопка ещё на месте), иначе на выбранную точку или место. */
function closeOverlay(): void {
  if (overlay.value === null) return;
  const wasNews = overlay.value === 'news';
  overlay.value = null;
  // `edit` из адреса уходит при любом закрытии: иначе «Клуб» в меню на том же адресе ничего бы не открыл.
  if (hasEditQuery()) {
    const rest = { ...route.query };
    delete rest.edit;
    void router.replace({ query: rest });
  }
  news.value = null;
  // Отметка «Что нового увидено» — только по закрытию окна: перезагрузка с открытым окном покажет его снова.
  if (wasNews) markNewsSeenNow();
  settling.value = true;
  globalThis.setTimeout(() => (settling.value = false), SETTLE_MS);
  void nextTick(() => {
    const back = opener?.isConnected ? opener : elOf(active.value);
    opener = null;
    back?.focus({ preventScroll: true });
  });
}

function toPath(): void {
  if (going.value) return;
  going.value = true;
  void router.push(PATH_PATH).finally(() => {
    going.value = false;
  });
}

/** Лист лиги → «Путь клуба»: окно закрывается, переход один. */
function sheetToPath(): void {
  closeOverlay();
  toPath();
}

/** Зажатый Enter на «Что нового» не должен открывать карточку заново, пока ребёнок её закрывает. */
const noRepeat = (e: KeyboardEvent): void => {
  if (e.repeat) e.preventDefault();
};

function onKey(e: KeyboardEvent): void {
  const c = ctx.value;
  if (!c || overlay.value !== null || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target instanceof HTMLElement ? e.target : null;
  const onBody = target === globalThis.document.body;
  if (!onBody && !(target && root.value?.contains(target))) return;
  // Фокус потерян (щелчок мимо): первая клавиша возвращает его на выбранный элемент.
  if (onBody && ['ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
    e.preventDefault();
    elOf(active.value)?.focus({ preventScroll: true });
    return;
  }
  const from = target?.closest<HTMLElement>('[data-focus]')?.dataset.focus ?? null;
  const act = keyAction(c.model, e.key, {
    from,
    active: active.value,
    shift: e.shiftKey,
    repeat: e.repeat,
    cardOpen: cardOpen.value,
    exists: (id) => elOf(id) !== null,
  });
  if (act.do === 'native') return;
  e.preventDefault();
  if (act.do === 'focus') focusOn(act.id);
  else if (act.do === 'open') cardOpen.value = true;
  else if (act.do === 'close') cardOpen.value = false;
  else if (act.do === 'play') play(act.id);
}

function onFocusIn(e: FocusEvent): void {
  const id = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-focus]')?.dataset.focus : undefined;
  if (id && id !== HEADER_FOCUS) {
    active.value = id;
    cardOpen.value = true;
  }
}

onMounted(() => {
  globalThis.addEventListener('keydown', onKey);
  // Окно, открытое при входе, берёт фокус себе.
  if (overlay.value === null) elOf(active.value)?.focus({ preventScroll: true });
});
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <main
    ref="root"
    class="map-screen"
    @focusin="onFocusIn"
  >
    <template v-if="ctx">
      <!-- В DOM шапка после поля и перед углом (Tab: точки, флажки, здания, шапка, угол), на экране — сверху. -->
      <div
        class="stage"
        :inert="overlay !== null"
      >
        <YardMap
          :model="ctx.model"
          :view="ctx.input.layout.view"
          :names="names"
          :league-name="ctx.input.league.name"
          :active="active"
          @select="focusOn"
        >
          <div class="dock">
            <CoachBubble
              v-if="greeting"
              :coach="coach"
              :text="coach.greet"
            />
            <LessonCard
              v-if="card"
              :point="card"
              :name="names[card.id] ?? ''"
              :cpm="cpmOf(card.id)"
              :busy="going || settling"
              @play="play(card.id)"
            />
            <PlaceCard
              v-else-if="shownPlace"
              :info="shownPlace"
            />
          </div>
        </YardMap>
      </div>

      <MapHeader
        class="top"
        :inert="overlay !== null"
        :name="clubName"
        :city="clubRef.city"
        :stars="ctx.model.stars"
        :coins="coins"
        :fix="fix"
        @open="openOverlay"
        @path="toPath"
      />

      <!-- Угол карты: номер версии (по нему сверяют присланный файл), «Что нового» снова и старая версия. -->
      <footer
        class="corner"
        :inert="overlay !== null"
      >
        {{ ru.news.plate }} {{ APP_VERSION }}
        <template v-if="canReplay">
          ·
          <button
            type="button"
            class="link"
            @click="openNews"
            @keydown.enter="noRepeat"
          >
            {{ ru.news.link }}
          </button>
        </template>
        ·
        <a
          :href="oldUrl"
          target="_blank"
          rel="noopener"
        >{{ ru.map.corner.old }}</a>
      </footer>

      <LeagueSheet
        v-if="overlay === 'sheet'"
        :model="ctx.model"
        :league-name="ctx.input.league.name"
        @close="closeOverlay"
        @path="sheetToPath"
      />
      <NewsCard
        v-else-if="overlay === 'news' && news"
        :card="news"
        @close="closeOverlay"
      />
      <ClubEdit
        v-else-if="overlay === 'edit'"
        @close="closeOverlay"
      />
    </template>
  </main>
</template>

<style scoped>
/*
 * 1024×640 без прокрутки страницы: высота экрана — окно минус верхняя панель (66 px) и поля содержимого (2×24 px).
 * Окно внутри увеличенного дерева делится на масштаб страницы. Высота панели меню — одна переменная.
 */
.map-screen {
  --chrome: 114px;

  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: calc(100vh / var(--ui-scale) - var(--chrome));
  min-height: 360px;
  color: var(--text);
}

/* Шапка в DOM после поля (порядок Tab, design §5.3), на экране — первой. */
.top {
  order: -1;
}

/* Угол: мелко, цель нажатия — не меньше 40 px по высоте у ссылок. */
.corner {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: 44px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.corner a,
.corner .link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-2);
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.corner a:focus-visible,
.corner .link:focus-visible {
  outline: 3px solid var(--text);
  outline-offset: 3px;
}

/* Поле — квадрат 16:9 по центру самой большой возможной области; остальное закрашено землёй карты. */
.stage {
  display: grid;
  flex: 1;
  place-items: center;
  min-height: 0;
  container-type: size;
  border-radius: 14px;
  background: var(--map-ground);
}

/* Низ поля между левой и правой колонками пути: сюда не ложатся ни точки, ни флажки. */
.dock {
  --face-size: max(56px, 14cqh);

  position: absolute;
  bottom: 3%;
  left: 24%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 40%;
}

.dock :deep(.speech) {
  padding: var(--space-2) var(--space-3);
}

.dock :deep(.text) {
  margin: 0;
  font-size: 0.95rem;
}

.dock :deep(.who) {
  margin: 0;
  font-size: 0.85rem;
}
</style>
