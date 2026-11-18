<script setup lang="ts">
/**
 * Раздел «кнопки»: ключевые кнопки, ярлыки, пауза, звук и клавиши, метки, переключатель — eb-buttons (063 К7): места и подписи
 * как на кадре. Части одного экрана («На матч» в карточке, «Начать» на зелёной сцене, подсказка двора) — в волне своего экрана (Р33).
 */
import { ref } from 'vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KeyCap from '../../components/kit/KeyCap.vue';
import KitChip from '../../components/kit/KitChip.vue';
import KitTag from '../../components/kit/KitTag.vue';
import KitToggle from '../../components/kit/KitToggle.vue';
import PauseButton from '../../components/shell/PauseButton.vue';
import SoundButton from '../../components/shell/SoundButton.vue';
import { ru } from '../../i18n/ru';

const t = ru.kit.sheet;
const sound = ref(true);
</script>

<template>
  <div
    class="eb-lab"
    style="left: 16px; top: 44px"
  >
    {{ t.primaryLab }}
  </div>
  <div
    class="btns eb-at on-blue"
    style="left: 16px; top: 62px"
  >
    <KeyButton
      primary
      sub="Enter"
    >
      {{ t.primary }}
    </KeyButton>
    <KeyButton
      primary
      sub="Enter"
      state="hover"
    >
      {{ t.primary }}
    </KeyButton>
    <KeyButton
      primary
      sub="Enter"
      state="down"
    >
      {{ t.primary }}
    </KeyButton>
    <KeyButton
      primary
      sub="Enter"
      state="off"
    >
      {{ t.primary }}
    </KeyButton>
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 238px"
  >
    {{ t.plainLab }}
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 256px"
  >
    <KeyButton sub="Enter">
      {{ t.second }}
    </KeyButton>
    <KeyButton
      sub="Enter"
      state="hover"
    >
      {{ t.second }}
    </KeyButton>
    <KeyButton
      sub="Enter"
      state="down"
    >
      {{ t.second }}
    </KeyButton>
    <KeyButton
      sub="Enter"
      state="off"
    >
      {{ t.second }}
    </KeyButton>
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 330px"
  >
    {{ t.quietLab }}
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 348px"
  >
    <KeyButton quiet>
      {{ t.quiet }}
    </KeyButton>
    <KeyButton
      quiet
      state="hover"
    >
      {{ t.quiet }}
    </KeyButton>
    <KeyButton
      quiet
      state="down"
    >
      {{ t.quiet }}
    </KeyButton>
    <KeyButton
      quiet
      state="off"
    >
      {{ t.quiet }}
    </KeyButton>
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 404px"
  >
    {{ t.chips }}
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 422px"
  >
    <KitChip>{{ t.chipSheet }}</KitChip>
    <KitChip open>
      {{ t.chipSheet }}
    </KitChip>
    <KitChip
      sm
      on
    >
      {{ t.chipToday }}
    </KitChip>
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 458px"
  >
    {{ t.keysLab }}
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 476px"
  >
    <PauseButton />
    <SoundButton show="on" />
    <SoundButton show="off" />
    <KeyCap>{{ ru.kit.enter }}</KeyCap>
    <KeyCap>{{ ru.kit.esc }}</KeyCap>
    <KeyCap arrow="left" />
    <KeyCap arrow="right" />
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 512px"
  >
    {{ t.tagsLab }}
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 530px"
  >
    <KitTag>{{ t.tags.control }}</KitTag>
    <KitTag kind="nt">
      {{ t.tags.friendly }}
    </KitTag>
    <KitTag kind="ok">
      {{ t.tags.ok }}
    </KitTag>
    <KitTag kind="bad">
      {{ t.tags.bad }}
    </KitTag>
    <KitTag kind="solid">
      {{ t.tags.solid }}
    </KitTag>
  </div>
  <div
    class="eb-lab"
    style="left: 16px; top: 562px"
  >
    {{ t.toggleLab }}
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 580px"
  >
    <KitToggle
      :on="sound"
      @toggle="sound = !sound"
    >
      {{ t.toggle }}
    </KitToggle>
    <KitToggle :on="false">
      {{ t.toggle }}
    </KitToggle>
  </div>
</template>
