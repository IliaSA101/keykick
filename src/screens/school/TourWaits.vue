<script setup lang="ts">
/**
 * Звено цепочки «Тур «Школы» ждёт» (067 Т16, Э3.16, К-Б): после итога матча и пака, пока тур дня не взят (Р73, Р78).
 * «Начать» (Enter) — в тур (цепочка кончается, итог тура ведёт в журнал, Р79); «Позже» и Esc — Дом, звено вернётся в следующий
 * заход (на Доме у «Школы» метка «тур ждёт»). Тур дня уже взят (перезагрузка, вторая вкладка) — звено пропускается дальше.
 * Окно цепочки: Enter не засчитывается, пока не прошла пауза (`enterDelay`), — двойной Enter с прошлого звена не жмёт «Начать».
 */
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { chainNext, chainSave, dropChain, endChain, escChain, schoolOpenOf } from '../../app/result/chain';
import { tourWaits } from '../../app/school/journal';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import ResultBackdrop from '../../components/shell/ResultBackdrop.vue';
import { albumDef, type Album } from '../../engine/album/section';
import { dayDef, type Day } from '../../engine/day/section';
import { kindOf, lastNumbered, waitingKind } from '../../engine/school/order';
import { schoolDef, type School } from '../../engine/school/section';
import { ru } from '../../i18n/ru';

const t = ru.school.waits;
const router = useRouter();
const { data, input, today, trainers } = useHomeInput();
const school = (): School => data<School>(schoolDef.name, schoolDef.empty());
const day = (): Day => data<Day>(dayDef.name, dayDef.empty());
const nextN = lastNumbered(school()) + 1;
const kind = ru.school.kinds[kindOf(nextN).id] ?? '';
/** Ждёт тренажёр нового вида: туры идут повтором (Р146), подпись — видом повтора, а не номером тура. */
const lead = waitingKind(school(), trainers()) !== null ? ru.school.repeat.title : fill(t.lead, { n: String(nextN), kind });

/** Тур дня уже взят: звено лишнее — следующее звено цепочки или конец. */
onMounted(() => {
  if (tourWaits(school(), day(), today(), trainers())) return;
  const album = data<Album>(albumDef.name, albumDef.empty());
  const next = chainNext(chainSave(album, day(), school(), today(), trainers()), schoolOpenOf(input.value), 'tourWaits', globalThis.Date.now());
  void router.replace(next === null ? endChain() : next.path);
});

let left = false;
function go(path: string): void {
  if (left) return;
  left = true;
  void router.push(path);
}
const start = (): void => {
  if (left) return;
  dropChain();
  go('/school/tour');
};
</script>

<template>
  <main class="waits">
    <ResultBackdrop />
    <KitModal
      :title="t.title"
      :lead="lead"
      :note="t.note"
      :width="560"
      :top="250"
      :enter-delay="300"
      @close="go(escChain())"
    >
      <p class="body">
        {{ t.body }}
      </p>
      <template #buttons>
        <KeyButton
          primary
          :sub="ru.kit.enter"
          @click="start"
        >
          {{ ru.match.intro.start }}
        </KeyButton>
        <span class="fill" />
        <KeyButton
          quiet
          @click="go(escChain())"
        >
          {{ ru.album.pack.later }}
        </KeyButton>
      </template>
    </KitModal>
  </main>
</template>

<style scoped>
.waits { position: absolute; inset: 0; overflow: hidden; }
.body { margin: 0 0 8px; font-size: 18px; text-align: center; }
.fill { flex: 1; }
</style>
