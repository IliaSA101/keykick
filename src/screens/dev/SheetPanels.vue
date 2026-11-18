<script setup lang="ts">
/**
 * Раздел «панели»: карточка перехода, тренер, плашка события, подсказка наведения, выбор из списка — eb-panels (063 К7).
 * Карточка матча, портрет и реплика тренера с ×, карточки «Район строится / открыт» — в волне своего экрана (Р33).
 */
import CoachBubble from '../../components/panel/CoachBubble.vue';
import EventPlate from '../../components/panel/EventPlate.vue';
import GoCard from '../../components/panel/GoCard.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitChip from '../../components/kit/KitChip.vue';
import PickCard from '../../components/panel/PickCard.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import { ru } from '../../i18n/ru';

const t = ru.kit.sheet;
// состояния строк — как на кадре: пройден · «за звёздами» · текущий и выбранный стрелками
const STATES = ['done', 'ring', 'cur'] as const;
const pickRows = t.pick.rows.map((r, i) => ({
  ...r,
  state: STATES[i] ?? 'done',
  sel: i === 2,
  ...(i === 2 ? { play: t.pick.play } : {}),
}));
</script>

<template>
  <div
    class="eb-row"
    style="top: 0"
  >
    <ShellHeader page="map" />
  </div>
  <GoCard
    class="eb-at"
    style="left: 12px; top: 110px; width: 360px"
    :lead="t.goLead"
    :where="t.goWhere"
  />
  <GoCard
    class="eb-at"
    style="left: 12px; top: 250px; width: 300px"
    :lead="t.goLead"
    :where="t.goWhere"
    variant="map"
  />
  <CoachBubble
    class="eb-at"
    style="left: 400px; top: 110px"
    state="hover"
  />
  <CoachBubble
    class="eb-at"
    style="left: 400px; top: 200px"
    :text="t.coachText"
  />
  <EventPlate
    class="eb-at"
    style="left: 12px; top: 400px"
    :sub="t.eventSub"
  >
    {{ t.eventText }}
  </EventPlate>
  <EventPlate
    class="eb-at"
    style="left: 400px; top: 400px"
  >
    <template #action>
      <KeyButton
        primary
        md
        sub="Enter"
      >
        {{ t.eventAction }}
      </KeyButton>
    </template>{{ t.eventText }}
  </EventPlate>
  <div
    class="eb-lab"
    style="left: 690px; top: 48px"
  >
    {{ t.tipLab }}
  </div>
  <KitChip
    class="eb-at"
    style="left: 690px; top: 66px"
    :tip="[t.tipLine1, t.tipLine2]"
  />
  <div
    class="eb-lab"
    style="left: 690px; top: 124px"
  >
    {{ t.pickLab }}
  </div>
  <PickCard
    class="eb-at"
    style="left: 690px; top: 142px; width: 320px"
    :title="t.pick.title"
    :sub="t.pick.sub"
    :rows="pickRows"
    :hint="t.pick.hint"
  />
</template>
