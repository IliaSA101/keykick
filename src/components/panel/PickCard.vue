<script lang="ts">
/** Строка выбора: состояние — пройден (`done`), «за звёздами» (`ring`), текущий (`cur`); `sel` — выбрана стрелками (белая рамка). */
export interface PickRow {
  name: string;
  sub: string;
  stars: string;
  state: 'done' | 'ring' | 'cur';
  sel?: boolean;
  /** Метка рядом с подписью («товарищеский»). */
  tag?: string;
  /** Подпись режима («режим: за звёздами»). */
  mode?: string;
  /** Ярлык «сегодня» во второй строке. */
  today?: string;
  /** Подпись кнопки «играть» во второй строке (значок ▶ ставит компонент). */
  play?: string;
}
</script>

<script setup lang="ts">
/**
 * Выбор из списка — `.panel.pop.tail.pickcard` (карточка уроков двора на карте): шапка с названием и «Закрыть Esc»,
 * строки двух колонок (название | звёзды), выбранная стрелками — с белой рамкой, внизу подсказка клавиш. Место — style снаружи.
 */
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';
import KitChip from '../kit/KitChip.vue';
import KitTag from '../kit/KitTag.vue';

defineProps<{ title: string; sub: string; rows: PickRow[]; hint: string }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <div class="card panel pop tail pickcard">
    <div class="ph">
      <p class="lk">
        <span class="line">{{ title }}</span>
        <span class="line sub">{{ sub }}</span>
      </p>
      <KeyButton
        quiet
        md
        :sub="ru.kit.esc"
        @click="$emit('close')"
      >
        {{ ru.kit.close }}
      </KeyButton>
    </div>
    <div
      v-for="row in rows"
      :key="row.name"
      class="lrow"
      :class="[row.state, { sel: row.sel }]"
    >
      <span class="ln">
        <span class="line">{{ row.name }} <i
          v-if="row.state === 'ring'"
          class="ring-ic"
        /></span>
        <span class="line"><span class="ln-sub">{{ row.sub }} <KitTag
          v-if="row.tag"
          kind="nt"
        >{{ row.tag }}</KitTag></span></span>
      </span>
      <b>{{ row.stars }}</b>
      <div
        v-if="row.mode || row.today || row.play"
        class="act"
      >
        <span
          v-if="row.mode"
          class="mode"
        >{{ row.mode }}</span>
        <KitChip
          v-if="row.today"
          sm
          on
        >
          {{ row.today }}
        </KitChip>
        <span
          v-if="row.play"
          class="play"
        ><KeyButton md>▶ {{ row.play }}</KeyButton></span>
      </div>
    </div>
    <p class="hint">
      {{ hint }}
    </p>
  </div>
</template>

<style scoped>
.line {
  display: block;
  white-space: nowrap;
}
.line.sub {
  font-size: 13px;
  color: var(--text-muted);
}
</style>
