<script setup lang="ts">
/**
 * Служебные окна каркаса (063 Т11): «Игра обновилась / Что нового» (063-Р58) и «Позови взрослого» при квоте. Не показываются на входных
 * экранах и в матче (`meta.bare`: старт, «Кто играет?», матч, итог и страница родителя — посреди дела окно не нужно).
 * Квота важнее обновления. Окно квоты после Esc возвращается на следующем экране, пока отказ записи не снят.
 * «Что нового» (б): раз после обновления у игрока (`pendingNews`, новичку пусто — 010-Р4); `seen.news` отмечается ДО перезагрузки,
 * чтобы окно не вернулось. «Игра обновилась» (а): оболочка старше пакета (`shellOld` из `usePack`) — списка новой версии она не знает.
 */
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { shellOld } from '../../app/packs/usePack';
import { saveClubFile } from '../../app/save/exportFile';
import { useSession } from '../../app/save/session';
import news from '../../content/news.json';
import { APP_VERSION } from '../../engine/save/envelope';
import { seenDef, type Seen } from '../../engine/seen/section';
import { markNewsSeen, pendingNews, systemWindow, updateLines } from '../../engine/versions/news';
import QuotaWindow from './QuotaWindow.vue';
import UpdateWindow from './UpdateWindow.vue';

const route = useRoute();
const session = useSession();
const quiet = computed(() => route.meta.bare === true);

const seen = computed<Seen>(() => {
  const p = session.player.value;
  return (p.kind === 'ok' ? (p.env.sections[seenDef.name]?.data as Seen | undefined) : undefined) ?? seenDef.empty();
});
const pending = computed(() => (session.status.value === 'ok' ? pendingNews(news, seen.value.news, APP_VERSION) : []));
const lines = computed(() => updateLines(shellOld.value, pending.value));

const laterUpdate = ref(false);
const laterQuota = ref(false);
const savedAs = ref<string | null>(null);
const failed = ref(false);
// Esc на окне квоты не навсегда: на следующем экране окно придёт снова; отказ записи снят — забываем всё
watch(() => route.fullPath, () => void (laterQuota.value = false));
// «Игра обновилась», закрытое Esc, — у игрока, а не у вкладки: другой игрок получит своё окно
watch(
  () => (session.player.value.kind === 'ok' ? session.player.value.env.pid : undefined),
  () => void (laterUpdate.value = false),
);
watch(
  () => session.status.value,
  (s) => {
    if (s !== 'quota') {
      laterQuota.value = false;
      savedAs.value = null;
      failed.value = false;
    }
  },
);

const which = computed(() =>
  systemWindow({ bare: quiet.value, status: session.status.value, laterQuota: laterQuota.value, laterUpdate: laterUpdate.value, lines: lines.value }),
);

/** Отметка «Что нового» виденной; `false` — не легла (квота: окно квоты встанет само, перезагружать и закрывать нельзя). */
function markSeen(): boolean {
  return pending.value.length === 0 || session.save({ seen: markNewsSeen(seen.value, APP_VERSION) }).ok;
}

/** «Обновить»: отметка — до перезагрузки; не легла — не перезагружаем (иначе петля перезагрузок), встанет окно квоты. */
function reload(): void {
  if (!markSeen()) return;
  globalThis.location.reload();
}

/** Esc: окно закрыто без перезагрузки; «Что нового» при этом считается виденным (не легло — окно уступает квоте). */
function later(): void {
  if (!markSeen()) return;
  laterUpdate.value = true;
}

function saveFile(): void {
  const out = saveClubFile(session, new Date(), globalThis.location.origin + globalThis.location.pathname);
  failed.value = !out.ok;
  if (out.ok) savedAs.value = out.name;
}
</script>

<template>
  <UpdateWindow
    v-if="which === 'update'"
    :lines="lines ?? []"
    @go="reload"
    @later="later"
  />
  <QuotaWindow
    v-else-if="which === 'quota'"
    :saved-as="savedAs"
    :failed="failed"
    @save="saveFile"
    @close="laterQuota = true"
  />
</template>
