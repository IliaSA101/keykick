<script setup lang="ts">
/**
 * Окно титула Кубка двора (068 Т9, кадры Э5.39/.40): кадр ролика фоном на всю сцену (под шапкой: шапка выше по слою, как в кадре), заголовок, лента наград на тёмно-зелёной плашке, строка про Музей, «Дальше».
 * Только показ готовой `CupTitle` (`app/cup/title`): ничего не считает, экранов не знает. Плашка зелёная, золота на синем нет (ТАБУ);
 * Esc держит экран итога (Дом). `narrow` — сцена уже 1100 базовых px (кадр Э5.40).
 */
import { artUrl } from '../../art/assets';
import { lookOf } from '../../app/album/locker';
import { storyArtUrl } from '../../app/art/storyArt';
import type { CupTitle } from '../../app/cup/title';
import type { ClubKit } from '../../engine/club/section';
import { ru } from '../../i18n/ru';
import ShirtView from '../club/ShirtView.vue';
import KeyButton from '../kit/KeyButton.vue';

const props = defineProps<{ title: CupTitle; club: ClubKit; narrow: boolean }>();
defineEmits<{ primary: [] }>();
const bg = `url('${storyArtUrl('cupTitleKey')}')`;
const looks = new Map(props.title.tiles.filter((x) => x.kitId !== null).map((x) => [x.kitId, lookOf(x.kitId, props.club)] as const));
</script>

<template>
  <section
    class="ct"
    :class="{ narrow }"
    :aria-label="title.head"
  >
    <div
      class="bg"
      :style="{ backgroundImage: bg }"
    />
    <div class="vig" />
    <div class="head">
      <h1>{{ title.head }}</h1>
      <p>{{ title.sub }}</p>
    </div>
    <div class="awards">
      <div
        v-for="tile in title.tiles"
        :key="tile.kind + tile.label"
        class="tile"
      >
        <span class="ic">
          <img
            v-if="tile.kind === 'cup'"
            :src="storyArtUrl('cupCup')"
            alt=""
          >
          <img
            v-else-if="tile.kind === 'patch'"
            :src="storyArtUrl('cupPatch')"
            alt=""
          >
          <img
            v-else-if="tile.kind === 'boots'"
            :src="artUrl('bootsBasic')"
            alt=""
          >
          <ShirtView
            v-else-if="tile.kind === 'kit'"
            :kit="looks.get(tile.kitId)!.kit"
            :deco="looks.get(tile.kitId)!.deco"
            :label="tile.label"
            crop
          />
          <svg
            v-else-if="tile.kind === 'step'"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
            <defs>
              <radialGradient
                id="gstep"
                cx="35%"
                cy="28%"
                r="80%"
              >
                <stop
                  offset="0"
                  stop-color="#6fdc98"
                />
                <stop
                  offset=".55"
                  stop-color="#27945a"
                />
                <stop
                  offset="1"
                  stop-color="#14512f"
                />
              </radialGradient>
            </defs>
            <circle
              cx="32"
              cy="32"
              r="29"
              fill="url(#gstep)"
              stroke="#fff"
              stroke-width="3"
            />
            <circle
              cx="32"
              cy="32"
              r="23.5"
              fill="none"
              stroke="#fff"
              stroke-opacity=".45"
              stroke-width="1.5"
            />
            <path
              d="M17 27L32 17l15 10M19 27v14M45 27v14M26 31v10M38 31v10M32 31v10M15 43h34"
              fill="none"
              stroke="#fff"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else
            viewBox="0 0 52 64"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="gpk1"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop
                  offset="0"
                  stop-color="#48b97d"
                />
                <stop
                  offset="1"
                  stop-color="#17603a"
                />
              </linearGradient>
            </defs>
            <rect
              x="12"
              y="4"
              width="34"
              height="48"
              rx="6"
              fill="url(#gpk1)"
              stroke="#fff"
              stroke-width="2"
              transform="rotate(10 29 28)"
            />
            <rect
              x="5"
              y="10"
              width="34"
              height="48"
              rx="6"
              fill="#e6f3ec"
              stroke="#1f6b43"
              stroke-width="2"
            />
            <path
              d="M22 27v18M13 36h18"
              stroke="#1f8a4c"
              stroke-width="6"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <b>{{ tile.label }}</b>
      </div>
    </div>
    <div class="foot">
      <span class="museum">
        <img
          class="next"
          :src="storyArtUrl('cupCup')"
          alt=""
        >
        <span><b>{{ title.museum }}</b> · {{ title.next }}</span>
      </span>
      <KeyButton
        primary
        :sub="ru.result.enter"
        @click="$emit('primary')"
      >
        {{ ru.result.next }}
      </KeyButton>
    </div>
  </section>
</template>

<style scoped>
.ct { position: absolute; inset: 0; z-index: 9; color: #fff; overflow: hidden; }
.bg { position: absolute; inset: 0; background: 50% 25% / cover no-repeat; }
.vig { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 38%, transparent 38%, rgb(18 7 0 / 0.72) 100%), linear-gradient(rgb(18 7 0 / 0.55), transparent 22%); }
.head { position: absolute; left: 36px; top: 62px; width: 560px; text-shadow: 0 3px 14px rgb(40 18 0 / 0.85); }
h1 { margin: 0; font-size: 44px; line-height: 1.05; white-space: nowrap; }
.head p { display: inline-block; margin: 10px 0 0; padding: 6px 16px; border-radius: 12px; background: rgb(10 30 20 / 0.62); font-size: 20px; font-weight: 700; text-shadow: none; }
.awards { position: absolute; left: 36px; right: 36px; top: 408px; box-sizing: border-box; display: flex; gap: 8px; padding: 8px; border-radius: 16px; border: 2px solid rgb(255 255 255 / 0.3); background: rgb(10 42 28 / 0.95); box-shadow: 0 10px 28px rgb(0 0 0 / 0.5); }
.tile { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px 6px; border-radius: 12px; background: rgb(255 255 255 / 0.07); text-align: center; }
.ic { display: flex; align-items: center; justify-content: center; height: 62px; filter: drop-shadow(0 4px 5px rgb(0 0 0 / 0.55)); }
.ic > img, .ic > svg { height: 100%; width: auto; }
.ic > :deep(.shirt) { height: 100%; width: auto; }
.tile b { min-height: 3.6em; font-size: 12.5px; line-height: 1.2; }
.foot { position: absolute; left: 36px; right: 36px; top: 562px; display: flex; align-items: center; justify-content: space-between; }
.museum { display: flex; align-items: center; gap: 12px; padding: 6px 16px 6px 10px; border-radius: 14px; background: rgb(10 42 28 / 0.82); font-size: 15px; font-weight: 700; }
.next { height: 40px; width: auto; /* силуэт: Кубок района ещё не выигран */ filter: brightness(0) opacity(0.7) drop-shadow(1px 0 0 rgb(255 255 255 / 0.75)) drop-shadow(-1px 0 0 rgb(255 255 255 / 0.75)) drop-shadow(0 1px 0 rgb(255 255 255 / 0.75)) drop-shadow(0 -1px 0 rgb(255 255 255 / 0.75)); }
.narrow h1 { font-size: 37px; }
.narrow .head { width: 470px; }
.narrow .head p { padding: 6px 60px 6px 0; border-radius: 0; background: linear-gradient(90deg, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.35) 70%, transparent); font-size: 17px; }
.narrow .awards { top: 410px; left: 20px; right: 20px; gap: 4px; padding: 6px; }
.narrow .tile { padding: 8px 2px 6px; }
.narrow .ic { height: 54px; }
.narrow .tile b { min-height: 2.4em; font-size: 14px; }
.narrow .foot { top: 552px; left: 20px; right: 20px; }
</style>
