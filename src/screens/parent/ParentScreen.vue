<script setup lang="ts">
/**
 * Страница родителя `#/parent` (063 Т11, кадры Э6.47–50, 54): вкладки игроков, прогресс, «Файл сохранения» (выгрузка, загрузка с выбором
 * при совпадении игрока) и «Защита от очистки» (063-Р8) — свои компоненты `ParentFile`, `ParentProtect`; здесь — вкладки, прогресс, версии. На страницу ведёт только набранный адрес (С3). Всё о сохранении — через `session.transfer`.
 * Страница только смотрит (063-Р59): игрока не берёт и замка не держит (`main.ts` → `init({ look })`), числа и выгрузка — с диска,
 * запись файла — `transfer.apply` со своими замками: вкладка ребёнка пишет свободно, а если играет — загрузке скажут «играет в другой вкладке».
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { yardLessons } from '../../app/packs/usePack';
import { channelOf, useSession } from '../../app/save/session';
import { oldVersionUrl } from '../../components/shell/footer';
import news from '../../content/news.json';
import { shortVersion } from '../../engine/club/start';
import { lastFile, progressFacts } from '../../engine/parent/progress';
import { deviceRow, stuckRows, type DeviceState, type StuckPlayer } from '../../engine/parent/repair';
import { APP_VERSION, type Envelope } from '../../engine/save/envelope';
import { canDelete } from '../../engine/save/bin';
import { remind } from '../../engine/save/remind';
import { isObj } from '../../engine/save/snapshot';
import { parentNews } from '../../engine/versions/news';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import ParentBin from './ParentBin.vue';
import ParentFile from './ParentFile.vue';
import ParentRemind from './ParentRemind.vue';
import ParentStuck from './ParentStuck.vue';
import ParentProtect from './ParentProtect.vue';
import { useParentStand } from './stand';
import './parent.css';

const session = useSession();
const transfer = session.transfer;
const p = ru.parent;
const today = (): string => new Date().toLocaleDateString('sv-SE');

const players = ref<Envelope[]>([]);
const order = ref<string[]>([]);
const names = ref<Record<string, string>>({});
const needRemind = ref(false);
const deletable = ref(false);
const exported = ref<unknown>(null);
const cur = ref('');
/** Игроки, которых не открыть, и состояние устройства (063-Р65): страница не пишет «нет игроков», когда игрок есть, а клуб не открывается. */
const stuck = ref<StuckPlayer[]>([]);
const state = ref<DeviceState>('ok');
const deviceNote = ref('');
/** Диск прочитан первый раз: блок «Игроки» трогает хранилище при показе (`settle`), до `session.init()` ему там делать нечего. */
const ready = ref(false);
const file = ref<InstanceType<typeof ParentFile> | null>(null);
/** Счётчик перечитываний диска: блок корзины следит за ним (после «Загрузить» файл корзина меняется не из блока, 063-Р66). */
const rev = ref(0);
// стенд кадров (только в разработке): вкладка кадра берётся, как только игрок появился в списке (после «Вернуть» — позже первого чтения)
const stand = useParentStand();
let standTab = stand().tab;

/** Игроки и «последний файл» — с диска (плитки и «Сейчас на компьютере» из одного источника, 063-Р59). */
function refresh(): void {
  rev.value += 1;
  const here = transfer.here();
  players.value = here.players;
  stuck.value = here.stuck;
  state.value = here.state;
  exported.value = here.device?.parent.exported ?? null;
  deletable.value = here.device !== null && canDelete(here.device);
  needRemind.value = here.device !== null && remind(here.device, here.players, today());
  if (!players.value.some((e) => e.pid === cur.value)) cur.value = session.tabPid.value ?? players.value[0]?.pid ?? '';
  if (standTab !== undefined && players.value.some((e) => e.pid === standTab)) {
    cur.value = standTab;
    standTab = undefined;
  }
}
/** «Играет в этой вкладке» — только если вкладка и правда держит игрока (063-Р59: на странице родителя она смотрит; остаток `sessionStorage` метки не даёт). */
const holds = (pid: string): boolean => session.player.value.kind !== 'none' && session.player.value.pid === pid;
const troubleRows = computed(() => stuckRows(stuck.value));
const deviceRows = computed(() => {
  const row = deviceRow(state.value);
  return row ? [row] : [];
});
const player = computed(() => players.value.find((e) => e.pid === cur.value));
const facts = computed(() => (player.value ? progressFacts(player.value, order.value) : null));
const tiles = computed(() => {
  const f = facts.value;
  if (!f) return [];
  const list: [string, number | null][] = [[ru.start.lost.coins, f.coins], [p.facts.stars, f.stars], [p.facts.matches, f.matches], [p.facts.days, f.days], [p.facts.passed, f.passed]];
  return list.filter((t): t is [string, number] => t[1] !== null);
});
const remindDays = computed(() => {
  const l = lastFile(exported.value, today());
  return l.kind === 'ago' ? l.days : null;
});
const clubName = computed(() => {
  const club = player.value?.sections.club?.data;
  return isObj(club) && typeof club.name === 'string' ? club.name : '';
});
const lessonName = computed(() => {
  const cur = player.value?.sections[`course:${player.value.course}`]?.data;
  return isObj(cur) && typeof cur.current === 'string' ? (names.value[cur.current] ?? '') : '';
});
const last = computed(() => {
  const l = lastFile(exported.value, today());
  if (l.kind === 'never') return p.file.never;
  return l.kind === 'today' ? ru.map.today : `${l.days} ${plural(l.days, p.file.ago)}`;
});

onMounted(async () => {
  await session.init();
  refresh();
  ready.value = true;
  if (stand().scroll === 'players') void nextTick(() => globalThis.document.getElementById('pa-players')?.scrollIntoView({ block: 'start' }));
  const lessons = await yardLessons();
  order.value = lessons.order;
  names.value = lessons.names;
});

const version = shortVersion(APP_VERSION) ?? APP_VERSION;
const next = channelOf(import.meta.env.BASE_URL) === 'next';
const history = parentNews(news, APP_VERSION);
const oldUrl = oldVersionUrl(import.meta.env.BASE_URL);
</script>

<template>
  <main class="pa">
    <div class="pa-page">
      <h1>{{ p.title }}</h1>
      <p class="pa-lead">
        {{ p.lead }}
      </p>

      <ParentRemind
        v-if="needRemind"
        :days="remindDays"
        @changed="refresh"
      />
      <ParentStuck
        :rows="deviceRows"
        @load="file?.pick()"
        @changed="refresh"
        @say="(text) => (deviceNote = text)"
      />
      <p
        v-if="deviceNote"
        class="pa-note"
        role="status"
      >
        {{ deviceNote }}
      </p>
      <p
        v-if="players.length === 0 && stuck.length === 0 && deviceRows.length === 0"
        class="pa-note"
      >
        {{ p.noPlayers }}
      </p>
      <div
        v-if="players.length > 0"
        class="pa-tabs"
        role="tablist"
        :aria-label="p.tabsLabel"
      >
        <button
          v-for="e in players"
          :key="e.pid"
          class="pa-tab"
          :class="{ on: e.pid === cur }"
          role="tab"
          :aria-selected="e.pid === cur"
          @click="cur = e.pid"
        >
          <b>{{ e.name }}</b>
          <small v-if="holds(e.pid)">{{ p.here }}</small>
        </button>
      </div>

      <div class="pa-cols">
        <div>
          <h3
            v-if="player"
            class="pa-colh"
          >
            {{ ru.frame.footer.player }} {{ player.name }}
          </h3>
          <section
            v-if="player && facts"
            class="pa-blk"
          >
            <h2>
              {{ p.progressOf }} {{ player.name }}<template v-if="clubName">
                · {{ p.clubOf }} «{{ clubName }}»
              </template>
            </h2>
            <p
              v-if="facts.lessonNo !== null"
              class="pa-lesson"
            >
              {{ ru.start.lost.lesson }} {{ facts.lessonNo }}<template v-if="facts.lessonsAll !== null">
                {{ ' ' }}{{ ru.match.status.of }} {{ facts.lessonsAll }}
              </template><template v-if="lessonName">
                {{ ': ' }}<b>{{ lessonName }}</b>
              </template>
            </p>
            <dl class="pa-facts">
              <div
                v-for="[label, n] in tiles"
                :key="label"
              >
                <dt>{{ label }}</dt>
                <dd>{{ n }}<small v-if="label === p.facts.stars && facts.lessonsAll !== null"> {{ ru.match.status.of }} {{ facts.lessonsAll * 3 }}</small></dd>
              </div>
            </dl>
          </section>
        </div>

        <div>
          <h3 class="pa-colh">
            {{ p.computerHead }}
          </h3>
          <ParentFile
            ref="file"
            :last="last"
            :order="order"
            @changed="refresh"
          />
          <ParentBin
            v-if="ready"
            :pid="player?.pid ?? ''"
            :name="player?.name ?? ''"
            :deletable="deletable && player !== undefined"
            :stuck="troubleRows"
            :rev="rev"
            @changed="refresh"
            @load="file?.pick()"
            @act="deviceNote = ''"
          />
          <ParentProtect />
        </div>
      </div>

      <section class="pa-blk">
        <h2>{{ p.versions.title }}</h2>
        <p>
          {{ p.versions.now }} <b>{{ version }}</b><template v-if="next">
            · {{ p.versions.next }}
          </template>
        </p>
        <p>
          <a
            :href="oldUrl"
            class="pa-link"
          >{{ ru.frame.footer.oldVersion }}</a>
        </p>
        <h3>{{ p.versions.parentNews }}</h3>
        <ul class="pa-news">
          <li
            v-for="n in history"
            :key="n.version"
          >
            <b>{{ n.version }}</b> — {{ [...n.parent].join(' ') }}
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
