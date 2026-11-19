<script setup lang="ts">
/**
 * Выбор тактики перед матчем Мини-футбола (067-Р22, кадры Э4.50, 51): четыре карточки со схемой на поле и строкой «что меняет», выбранная — белая рамка,
 * закрытая — приглушена с подписью тура «Школы», тренер одной строкой говорит, что изменится, «На матч». Выбор и «На матч» — события хозяину (клавиши — у него).
 */
import { artUrl } from '../../art/assets';
import { fill } from '../../app/home/texts';
import { TACTIC_IDS, tacticTour } from '../../engine/base/games/mini';
import { ru } from '../../i18n/ru';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import TacticScheme from './TacticScheme.vue';

const props = defineProps<{ open: readonly string[]; selected: string; built: number; gold: boolean; ours: string; rival: string }>();
defineEmits<{ select: [id: string]; go: [] }>();
const t = ru.base.mini.tactic;
const say = (): string => t.items[props.selected as keyof typeof t.items]?.say ?? '';
</script>

<template>
  <KitPanel
    soft
    class="pick"
  >
    <h2>{{ t.title }}</h2>
    <p class="sub">
      {{ t.sub }}
    </p>
    <div class="cards">
      <button
        v-for="id in TACTIC_IDS"
        :key="id"
        type="button"
        class="card-t"
        :class="{ sel: id === selected, shut: !open.includes(id) }"
        :aria-pressed="id === selected"
        :disabled="!open.includes(id)"
        @click="$emit('select', id)"
      >
        <span class="pic">
          <TacticScheme
            :id="id"
            :built="built"
            :gold="gold"
            :ours="ours"
            :rival="rival"
          />
          <span
            v-if="!open.includes(id)"
            class="tour"
          >
            <svg
              width="14"
              height="16"
              viewBox="0 0 14 16"
              aria-hidden="true"
            ><rect
              x="1.5"
              y="7"
              width="11"
              height="8"
              rx="1.5"
              fill="#fff"
            /><path
              d="M4 7V5a3 3 0 0 1 6 0v2"
              fill="none"
              stroke="#fff"
              stroke-width="2"
            /></svg>{{ fill(t.tour, { n: tacticTour(id) }) }}
          </span>
        </span>
        <b class="name">{{ t.items[id as keyof typeof t.items].name }}</b>
        <span class="what">{{ t.items[id as keyof typeof t.items].what }}</span>
      </button>
    </div>
    <div class="foot">
      <div class="kb-result-coach">
        <img
          class="ava"
          :src="artUrl('coachFace')"
          :alt="ru.kit.coachName"
        >
        <div class="kb-bub">
          <b class="nm">{{ ru.kit.coachName }}</b>
          <p>{{ say() }}</p>
        </div>
      </div>
      <KeyButton
        primary
        md
        :sub="ru.kit.enter"
        @click="$emit('go')"
      >
        {{ ru.kit.go }}
      </KeyButton>
    </div>
  </KitPanel>
</template>

<style scoped>
/* числа — базовые px сцены 1024×640, как кадры Э4.50, 51 */
.pick { position: absolute; left: 16px; right: 16px; top: 104px; box-sizing: border-box; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
h2 { margin: 0; font-size: 24px; line-height: 1.15; }
.sub { margin: -4px 0 0; font-size: 14px; color: var(--text-muted); }
.cards { display: flex; gap: 12px; }
.card-t { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 8px 8px 10px; border: 0; border-radius: 14px; background: rgb(255 255 255 / 0.07); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.18); color: inherit; font: inherit; text-align: left; cursor: pointer; }
/* выбранная — белая рамка (067-Р22): белое с синим допустимо */
.card-t.sel { background: rgb(255 255 255 / 0.12); box-shadow: 0 0 0 3px #fff; }
.card-t.shut { cursor: default; }
.pic { position: relative; display: block; aspect-ratio: 3 / 2; overflow: hidden; border-radius: 9px; background: #1f2242; }
.name { font-size: 19px; line-height: 1.2; color: #fff; }
.what { min-height: 2.5em; font-size: 14px; line-height: 1.25; color: var(--text-muted); }
/* закрытая: схема в силуэте, имя и строка приглушены; подпись тура — плашка поверх схемы */
.shut .pic :deep(.scheme) { opacity: 0.35; filter: grayscale(1); }
.shut .name, .shut .what { opacity: 0.6; }
.tour { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 14px; background: rgb(20 24 48 / 0.85); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.6); font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.foot .kb-result-coach { flex: 1 1 auto; min-width: 0; }
</style>
