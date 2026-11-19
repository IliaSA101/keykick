<script setup lang="ts">
/**
 * Первый запуск `#/start` (063 Т6а, К10): «Новый клуб, новый сезон» (Э6.71–74) → «Твой клуб» (Э2К.36) → тренер (Э2К.34) → приветствие (Э2К.41) → Дом.
 * Ссылка «Клуб был, но пропал?» ведёт в окно «Клуб пропал?» (Э6.75–82). Охрана входа сама решает, когда показывать этот адрес
 * (`engine/players/entry.ts`); здесь — только шаги. Клуб создаёт мост сеанса: `create({name})`, затем раздел `club` (063-Р31).
 * Сцена под окнами — размытый Дом дня 1 без тренера (`components/home/HomeBackdrop`, 063-Р49).
 */
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { hasV1Keys } from '../../app/players/v1';
import { useSession } from '../../app/save/session';
import { browserLocal, createKeyValue } from '../../app/save/storage';
import { lessonOrder } from '../../app/packs/usePack';
import ClubEditWindow from '../../components/club/ClubEditWindow.vue';
import CoachPick from '../../components/club/CoachPick.vue';
import { factLine, fileLine } from '../../components/club/restoreLines';
import HomeBackdrop from '../../components/home/HomeBackdrop.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import CoachBubble from '../../components/panel/CoachBubble.vue';
import KitModal from '../../components/panel/KitModal.vue';
import { coachWidth } from '../../components/panel/coachWidth';
import { ENTER_DELAY } from '../../components/panel/focusCycle';
import TelegramLine from '../../components/panel/TelegramLine.vue';
import { badReason, clubFromDraft, defaultDraft, draftProblems, loadCheck, nextStep, playerNameOf, type RestoreFile, type RestoreRow, type Step } from '../../engine/club/start';
import { oldVersionUrl } from '../../components/shell/footer';
import type { ImportPlan } from '../../engine/save/import';
import { ru } from '../../i18n/ru';
import { SYSTEM_WINDOW, checkWindow, useNarrow } from './layout';
import StartButtons from './StartButtons.vue';

/** Затемнение окон «Новый клуб» и «Клуб пропал?» над Домом: 0,8, как на кадрах Э6.71–82 (системные окна, 050-Р53). */
const DIM = 'rgb(10 9 32 / 0.8)';
/** Стенд кадров (067 Т11): шаг, с которого экран открывается (Э2К.34 — тренер, Э2К.41 — приветствие); в игре пропа нет. */
const props = defineProps<{ frame?: { step: Step } }>();
const session = useSession();
const transfer = session.transfer;
let lastPlan: ImportPlan | undefined;
const router = useRouter();
const step = ref<Step>(props.frame?.step ?? 'new');
const draft = reactive(defaultDraft(Math.random));
const bubble = ref(true);
const oldUrl = oldVersionUrl(import.meta.env.BASE_URL);
/** Игрок первой версии (ключи `keykick.*` в хранилище): ему — «заново» и ссылка на «Старую версию», новичку — нет (063-Р49 п. 1). */
const fromV1 = hasV1Keys(createKeyValue(browserLocal()));
const narrow = useNarrow();
const check = computed(() => checkWindow(narrow.value));
const error = ref('');
const busy = ref(false);

// «Клуб пропал?»: ask → (файл) → check | bad → done
const phase = ref<'ask' | 'check' | 'bad' | 'again' | 'done'>('ask');
/** Причина отказа по `planImport`: `newer` — файл от более новой версии игры (063-Р49 п. 3). */
const why = ref<'bad' | 'newer'>('bad');
const fileName = ref('');
const found = ref<RestoreRow[]>([]);
const fileInfo = ref<RestoreFile>({ date: null, version: null });
/** «Файл от 08.11.2026 · версия игры 2.0»; части, которых в файле нет, пропускаются. */
const fileText = computed(() => fileLine(fileInfo.value));
const picker = ref<HTMLInputElement | null>(null);

const go = (to: Parameters<typeof nextStep>[1]): void => {
  step.value = nextStep(step.value, to);
  if (to === 'load') phase.value = 'ask';
};

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // тот же файл можно выбрать снова
  if (!file) return;
  fileName.value = file.name;
  const text = await file.text().catch(() => '');
  // курсовая сверка (реестр уроков) — позже, когда в курсе будет не одна лига; план — против устройства (оно обычно пусто)
  const plan = transfer.plan(text);
  lastPlan = plan;
  // порядок уроков — из пакета двора по сети: нет связи — в строке игрока просто нет «Урок N» (063-Р46)
  const order = plan.kind === 'ok' ? await lessonOrder() : [];
  const res = loadCheck(plan, order);
  found.value = res.phase === 'check' ? res.players : [];
  if (res.phase === 'check') fileInfo.value = res.file;
  why.value = badReason(plan);
  phase.value = res.phase;
}

/**
 * Запись файла клуба (`session.transfer.apply`: сеанс сам перечитывается после записи); совпавших игроков здесь не бывает (устройство пусто) —
 * если есть, берём из файла. Файл разобран и годен, поэтому любой отказ — не «файл повреждён», а «позови взрослого» (место, доступ, вкладка).
 */
async function restore(): Promise<void> {
  if (busy.value || !lastPlan || lastPlan.kind !== 'ok') return;
  busy.value = true;
  const picks = Object.fromEntries(lastPlan.clash.map((c) => [c.pid, 'file' as const]));
  const done = await transfer.apply(lastPlan, picks);
  phase.value = done.ok ? 'done' : 'again';
  busy.value = false;
}

async function finish(): Promise<void> {
  if (busy.value || draftProblems(draft).length > 0) return;
  busy.value = true;
  error.value = '';
  const made = await session.create({ name: playerNameOf(draft, ru.start.club.defaultPlayer) });
  if (!made.ok) {
    error.value = made.why === 'limit' ? ru.start.fail.limit : made.why === 'quota' ? ru.start.fail.quota : ru.start.fail.other;
    busy.value = false;
    step.value = 'new';
    return;
  }
  const saved = session.save({ club: clubFromDraft(draft) });
  if (!saved.ok) error.value = ru.start.fail.quota;
  await router.replace('/home');
}

function onEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape' && step.value === 'new') bubble.value = false; // «Esc» у реплики тренера (кадр Э6.71)
}
globalThis.addEventListener('keydown', onEsc);
</script>

<template>
  <main class="start">
    <HomeBackdrop :mode="step === 'new' || step === 'load' ? 'home' : 'scene'" />

    <template v-if="step === 'new'">
      <KitModal
        :enter-delay="ENTER_DELAY"
        :dim-color="DIM"
        :title="ru.start.fresh.title"
        :lead="fromV1 ? ru.start.fresh.lead : ru.start.fresh.leadNew"
        :width="SYSTEM_WINDOW.width"
        :top="SYSTEM_WINDOW.top"
        :esc-close="false"
      >
        <div class="col">
          <p
            v-if="fromV1"
            class="old"
          >
            {{ ru.start.fresh.oldBefore }}
            <a
              :href="oldUrl"
              target="_blank"
              rel="noopener"
            >{{ ru.start.fresh.oldLink }}</a>
          </p>
          <KeyButton
            class="tall"
            primary
            :sub="ru.kit.enter"
            @click="go('club')"
          >
            {{ ru.start.fresh.go }}
          </KeyButton>
          <a
            class="quiet-link"
            href="#/start"
            @click.prevent="go('load')"
          >{{ ru.start.fresh.lost }}</a>
          <p
            v-if="error"
            class="note bad"
            role="alert"
          >
            {{ error }}
          </p>
        </div>
      </KitModal>
      <CoachBubble
        v-if="bubble"
        class="bubble"
        :width="coachWidth(narrow)"
        :text="ru.start.fresh.coachHello"
        @close="bubble = false"
      />
    </template>

    <template v-else-if="step === 'load'">
      <input
        ref="picker"
        type="file"
        accept=".json,application/json"
        hidden
        @change="onFile"
      >
      <KitModal
        v-if="phase === 'ask'"
        :enter-delay="ENTER_DELAY"
        :dim-color="DIM"
        :title="ru.start.lost.title"
        :lead="ru.start.lost.lead"
        :width="SYSTEM_WINDOW.width"
        :top="SYSTEM_WINDOW.top"
        @close="go('back')"
      >
        <StartButtons
          :primary="ru.start.lost.pick"
          :quiet="ru.start.lost.newClub"
          @primary="picker?.click()"
          @quiet="go('back')"
        />
      </KitModal>
      <KitModal
        v-else-if="phase === 'check'"
        :enter-delay="ENTER_DELAY"
        :dim-color="DIM"
        :title="ru.start.lost.title"
        :lead="ru.start.lost.checked"
        :width="check.width"
        :top="check.top"
        @close="phase = 'ask'"
      >
        <div class="col">
          <p class="file">
            {{ fileName }}
          </p>
          <div class="prev">
            <h3 id="changes-title">
              {{ ru.start.lost.changes }}
            </h3>
            <p
              v-if="fileText"
              class="hint"
            >
              {{ fileText }}
            </p>
            <table
              class="changes"
              aria-labelledby="changes-title"
            >
              <thead>
                <tr>
                  <th>{{ ru.start.lost.player }}</th>
                  <td>{{ ru.start.lost.now }}</td>
                  <td>{{ ru.start.lost.inFile }}</td>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in found"
                  :key="p.name"
                >
                  <th scope="row">
                    {{ p.name }}
                  </th>
                  <td>{{ ru.start.lost.none }}</td>
                  <td>{{ factLine(p.facts) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <StartButtons
            :primary="ru.start.lost.restore"
            :quiet="ru.start.lost.another"
            @primary="restore"
            @quiet="phase = 'ask'"
          />
        </div>
      </KitModal>
      <KitModal
        v-else-if="phase === 'bad'"
        :enter-delay="ENTER_DELAY"
        :dim-color="DIM"
        :title="ru.start.lost.badTitle"
        :lead="why === 'newer' ? ru.start.lost.newerLead : ru.start.lost.badLead"
        :width="SYSTEM_WINDOW.width"
        :top="SYSTEM_WINDOW.top"
        @close="go('back')"
      >
        <p class="file">
          {{ fileName }}
        </p>
        <TelegramLine
          :before="ru.start.lost.sendBefore"
          :after="ru.start.lost.sendAfter"
        />
        <StartButtons
          :primary="ru.start.lost.another"
          :quiet="ru.start.lost.newClub"
          @primary="picker?.click()"
          @quiet="go('back')"
        />
      </KitModal>
      <KitModal
        v-else-if="phase === 'again'"
        :enter-delay="ENTER_DELAY"
        :dim-color="DIM"
        :title="ru.system.again.title"
        :lead="ru.start.fail.quota"
        :width="SYSTEM_WINDOW.width"
        :top="SYSTEM_WINDOW.top"
        @close="go('back')"
      >
        <StartButtons
          :primary="ru.start.lost.restore"
          :quiet="ru.start.lost.newClub"
          @primary="restore"
          @quiet="go('back')"
        />
      </KitModal>
      <KitModal
        v-else
        :enter-delay="ENTER_DELAY"
        :dim-color="DIM"
        :title="ru.start.lost.doneTitle"
        :lead="ru.start.lost.doneLead"
        :width="SYSTEM_WINDOW.width"
        :top="SYSTEM_WINDOW.top"
        @close="router.replace('/home')"
      >
        <KeyButton
          class="tall"
          primary
          :sub="ru.kit.enter"
          @click="router.replace('/home')"
        >
          {{ ru.start.lost.home }}
        </KeyButton>
      </KitModal>
    </template>

    <ClubEditWindow
      v-else-if="step === 'club'"
      v-model:draft="draft"
      @save="go('coach')"
      @cancel="go('back')"
    />

    <CoachPick
      v-else
      v-model="draft.coach"
      :busy="busy"
      :greet="step === 'greet'"
      @done="finish"
    />
  </main>
</template>

<style scoped>
.start {
  position: absolute;
  inset: 0;
}
.bubble {
  z-index: 60; /* над затемнением окна, как в кадре; место — общее .kb-coach, как у тренера Дома */
}
.old,
.file {
  margin: 0;
  text-align: center;
  color: var(--text-muted);
}
/* строки окна «Новый клуб» — `.note` кадра Э6.71: 15 px, как .st-sys-col .note; колонка с зазором 10 (system.css) */
.old,
.quiet-link {
  font-size: 15px;
}
/* кнопки окон первого запуска не ниже 44 px, и на 1024 (tall в system.mjs) */
.tall {
  min-height: 44px;
}
.old a,
.quiet-link {
  color: var(--text);
}
.quiet-link {
  display: block;
  text-align: center;
}
.old a:focus-visible,
.quiet-link:focus-visible {
  outline: 3px solid var(--text); /* Tab на ссылке — белая обводка, не золото (кадр Э6.73) */
  border-radius: 8px;
}
/* «Что изменится» (Э6.77): числа — единицы макета из .st-p-prev / .st-p-tbl.wide (parent.css, parent-time.css) и .st-sys-col (system.css);
   бумажные серые кадра в тёмном окне — светлые: шапка и подсказка вторичные, линии — как --paper-border (#c8c8c8) */
.col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.prev {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid #c8c8c8;
  border-radius: 10px;
}
.prev h3 {
  margin: 0 0 16px; /* в кадре — отступ по умолчанию 1em под заголовком */
  font-size: 16px;
  text-align: center;
}
.hint {
  margin: 0 0 10px; /* от таблицы — 10 ед. */
  font-size: 12px;
  text-align: center;
  color: rgb(255 255 255 / 0.72);
}
.changes {
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}
.changes th,
.changes td {
  padding: 4px 6px;
  border-bottom: 1px solid #c8c8c8;
  white-space: normal;
}
.changes th {
  font-weight: 700;
  white-space: nowrap;
}
.changes thead th,
.changes thead td {
  font-size: 12px;
  font-weight: 400;
  color: rgb(255 255 255 / 0.72);
  line-height: 1.2;
}
.bad {
  color: var(--error);
}
</style>
