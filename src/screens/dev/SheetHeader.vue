<script setup lang="ts">
/** Раздел «шапка» листа сверки: eb-header (063 К7) — четыре шапки, подписи как на кадре, ряд «Звук: включён · выключен». */
import SoundButton from '../../components/shell/SoundButton.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import { ru } from '../../i18n/ru';

const t = ru.kit.sheet;
</script>

<template>
  <div
    class="eb-lab"
    style="left: 16px; top: 44px"
  >
    {{ t.headerNormal }}
  </div>
  <div
    class="eb-row"
    style="top: 60px"
  >
    <ShellHeader page="home" />
  </div>
  <div
    class="eb-row"
    style="top: 108px"
  >
    <ShellHeader page="map" />
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 166px"
  >
    {{ t.headerMatch }}
  </div>
  <div
    class="eb-row"
    style="top: 182px"
  >
    <ShellHeader match />
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 240px"
  >
    {{ t.headerEnded }}
  </div>
  <div
    class="eb-row"
    style="top: 256px"
  >
    <ShellHeader
      match
      :pause="false"
    />
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 318px"
  >
    {{ t.soundRow }}
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 336px"
  >
    <SoundButton show="on" />
    <SoundButton show="off" />
  </div>
</template>
