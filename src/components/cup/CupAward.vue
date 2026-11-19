<script setup lang="ts">
/**
 * Окно награды Кубка (068 Т6-3, кадры Э5.37, .38, .41): призовая форма на зелёной подложке или медаль серебра, метки, две кнопки.
 * Подложка зелёная, а не синее окно: награда не стоит на синем (038-Р15, ТАБУ). Только показ готовой `CupAward` (`app/cup/awards`):
 * ничего не считает, экранов не знает; Esc держит экран итога (Дом), а не окно.
 */
import { lookOf } from '../../app/album/locker';
import { storyArtUrl } from '../../app/art/storyArt';
import type { CupAward } from '../../app/cup/awards';
import type { ClubKit } from '../../engine/club/section';
import { ru } from '../../i18n/ru';
import ShirtView from '../club/ShirtView.vue';
import KeyButton from '../kit/KeyButton.vue';
import KitModal from '../panel/KitModal.vue';
import { ENTER_DELAY } from '../panel/focusCycle';

const props = defineProps<{ award: CupAward; club: ClubKit }>();
defineEmits<{ primary: []; quiet: [] }>();
const look = lookOf(props.award.kitId, props.club);
</script>

<template>
  <KitModal
    class="cupaw"
    :title="award.title"
    :lead="award.lead"
    :width="560"
    :top="92"
    :esc-close="false"
    :enter-delay="ENTER_DELAY"
  >
    <div class="ped">
      <i class="glow" />
      <div
        v-if="award.kitId"
        class="kit"
      >
        <ShirtView
          :kit="look.kit"
          :deco="look.deco"
          :label="look.name ?? ''"
          crop
        />
      </div>
      <img
        v-else
        class="medal"
        :src="storyArtUrl('cupMedal')"
        alt=""
      >
    </div>
    <p
      v-if="award.sub"
      class="sub"
    >
      {{ award.sub }}
    </p>
    <p class="tags">
      <span
        v-for="tag in award.tags"
        :key="tag"
        class="kb-tag ok"
      >{{ tag }}</span>
    </p>
    <template #buttons>
      <KeyButton
        primary
        :sub="ru.result.enter"
        @click="$emit('primary')"
      >
        {{ award.primary }}
      </KeyButton>
      <span style="flex: 1" />
      <KeyButton
        quiet
        @click="$emit('quiet')"
      >
        {{ award.quiet }}
      </KeyButton>
    </template>
  </KitModal>
</template>

<style scoped>
.ped { position: relative; display: flex; align-items: center; justify-content: center; margin: 8px 0; padding: 16px; border-radius: 16px; border: 1px solid rgb(255 255 255 / 0.22); background: radial-gradient(ellipse at 50% 85%, #36996148 0, transparent 70%), linear-gradient(160deg, #1f6b43, #144b2e); overflow: hidden; }
.ped > * { position: relative; }
.ped > .glow { position: absolute; inset: 0; background: radial-gradient(closest-side, rgb(255 255 255 / 0.28), transparent); }
.kit { height: 190px; display: flex; }
.kit > :deep(.shirt) { height: 100%; width: auto; }
.medal { height: 176px; }
.sub { margin: 0 0 6px; color: var(--text-muted); font-size: 15px; text-align: center; }
.tags { margin: 0 0 6px; display: flex; gap: 8px; justify-content: center; }
</style>
