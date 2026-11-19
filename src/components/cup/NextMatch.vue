<script setup lang="ts">
/** Панель «Следующий матч» на тёмном дереве (Э5.01–.08): эмблема соперника, раунд, «с «Гранитом»», где играем; кнопка с Enter либо статус «после урока N». */
import { storyArtUrl } from '../../app/art/storyArt';
import type { NextView } from '../../app/cup/groupView';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';

defineProps<{ next: NextView }>();
defineEmits<{ play: [] }>();
</script>

<template>
  <div class="ch-next">
    <p class="ch-nl">
      {{ ru.cup.screen.nextLabel }}
    </p>
    <div class="ch-nrow">
      <img
        class="ch-emi"
        :src="storyArtUrl(next.emblem)"
        alt=""
        width="81"
        height="96"
      >
      <div class="ch-nt">
        <b class="ph">{{ next.phase }}</b>
        <span class="op">{{ next.withOpp }}</span>
        <small class="wh">{{ next.action && next.note ? `${next.where} · ${next.note}` : next.where }}</small>
        <div
          v-if="next.action"
          class="ch-act"
        >
          <KeyButton
            primary
            md
            :sub="ru.kit.enter"
            @click="$emit('play')"
          >
            {{ next.action }}
          </KeyButton>
        </div>
        <p
          v-else
          class="ch-wt"
        >
          {{ next.status }}
        </p>
      </div>
    </div>
  </div>
</template>
