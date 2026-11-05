<script setup lang="ts">
/*
 * Поле матча: фон-стадион, табло сверху (счёт с голами пенальти, атака, секундомер), удар мяча по итогу атаки,
 * большая надпись (начало тайма, решающая атака), строка печати снизу (слот).
 * Анимация — только CSS; при «меньше движения» мяч не летит, сразу видна надпись.
 */
import KitView from './KitView.vue';
import { artUrl } from '../art/assets';
import type { Kit } from '../engine/kit';
import type { AttackResult } from '../engine/match';
import { ru } from '../i18n/ru';

defineProps<{
  us: string;
  /** Название соперника на табло. */
  rival: string;
  /** Маленькие формы у названий команд; null — без формы (клуба нет). */
  usKit?: Kit | null;
  rivalKit?: Kit | null;
  goals: number;
  conceded: number;
  /** Голов с пенальти по ходу матча (спека 005): больше нуля — «пен. 1» у счёта. */
  penalties?: number;
  /** Строка под счётом: «Атака 2 из 6», разминка, решающая атака или серия; пусто — нет строки. */
  caption: string;
  /** Решающая атака (и каждая атака решающей серии): строка под счётом горит золотом. */
  decisive?: boolean;
  /** Секундомер тайма «мм:сс»; null — не показывать (вступление, разминка). */
  clock: string | null;
  /** Итог последнего удара — пока он не null, мяч летит и горит надпись. */
  shot: AttackResult | null;
  /** Номер удара: новый номер — анимация мяча заново. */
  shotId: string;
  /** Своя надпись удара (разминка — «В сетку!»); нет — по итогу удара. */
  shotText?: string | null;
  /** Большая надпись посреди поля: «Начинаем тайм!», «Решающая атака!». */
  banner?: string | null;
}>();

// Фон задаётся из скрипта: путь зависит от подраздела сайта (BASE_URL).
const bgStyle = { backgroundImage: `url(${artUrl('matchBg')})` };
const ballUrl = artUrl('ball');
</script>

<template>
  <section
    class="pitch"
    :style="bgStyle"
  >
    <div
      class="board"
      aria-live="polite"
    >
      <span class="team">
        <span
          v-if="usKit"
          class="mini"
        ><KitView :kit="usKit" /></span>{{ us }}
      </span>
      <span class="score">{{ goals }} : {{ conceded }}<span
        v-if="penalties"
        class="pen"
      > ({{ ru.midPenalty.short }} {{ penalties }})</span></span>
      <span class="team">
        {{ rival }}<span
          v-if="rivalKit"
          class="mini"
        ><KitView :kit="rivalKit" /></span>
      </span>
      <span
        v-if="caption"
        class="attack"
        :class="{ decisive }"
      >
        {{ caption }}
        <!-- Секундомер меняется на каждом нажатии: из живой области табло его не зачитываем. -->
        <span
          v-if="clock"
          class="clock"
          aria-hidden="true"
        >{{ clock }}</span>
      </span>
    </div>

    <img
      v-if="shot"
      :key="`${shotId}-${shot}`"
      class="ball"
      :class="shot"
      :src="ballUrl"
      alt=""
      width="256"
      height="256"
    >
    <p
      v-if="shot"
      :key="`label-${shotId}`"
      class="shot-label"
      :class="shot"
      role="status"
    >
      {{ shotText ?? ru.match.shot[shot] }}
    </p>
    <p
      v-else-if="banner"
      :key="`banner-${banner}`"
      class="shot-label banner"
      role="status"
    >
      {{ banner }}
    </p>

    <div class="line-slot">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.pitch {
  position: relative;
  min-height: 230px;
  border-radius: 16px;
  overflow: hidden;
  background-size: cover;
  background-position: center 38%;
  /* Золотая кромка и тень, как у панелей: на фоне стадиона поле не сливается с ним. */
  box-shadow:
    0 0 0 3px rgb(244 194 74 / 0.7),
    0 12px 32px rgb(0 0 0 / 0.55);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Табло — тёмная плашка, читается на любом месте фона. */
.board {
  align-self: center;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px 16px;
  margin-top: 10px;
  padding: 6px 18px;
  border-radius: 12px;
  background: rgb(10 20 40 / 0.78);
  color: #ffffff;
  font-weight: 700;
}

.team {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 1rem;
}

/* Форма у названия — не выше строки счёта: табло не растёт (окно 1024×640). */
.mini {
  width: 32px;
  height: 32px;
  flex: none;
  align-self: center;
}

.mini :deep(.kit) {
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.7));
}

.score {
  font-size: 1.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #ffd84a;
}

.score .pen {
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
}

.attack {
  flex-basis: 100%;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
}

.attack.decisive {
  color: #ffd84a;
}

.clock {
  margin-left: 14px;
  font-variant-numeric: tabular-nums;
  color: #ffd84a;
}

.ball {
  position: absolute;
  left: calc(50% - 28px);
  bottom: 72px;
  width: 56px;
  height: 56px;
  pointer-events: none;
}

.ball.goal {
  animation: to-net 0.7s ease-out forwards;
}

.ball.save {
  animation: to-keeper 0.9s ease-out forwards;
}

.ball.conceded {
  animation: to-us 0.8s ease-in forwards;
}

@keyframes to-net {
  to {
    transform: translate(60px, -120px) scale(0.45);
  }
}

@keyframes to-keeper {
  55% {
    transform: translate(-20px, -110px) scale(0.5);
  }
  to {
    transform: translate(-150px, -30px) scale(0.6) rotate(-200deg);
  }
}

@keyframes to-us {
  from {
    transform: translate(0, -120px) scale(0.45);
  }
  to {
    transform: translate(0, 40px) scale(1.3);
    opacity: 0;
  }
}

.shot-label {
  position: absolute;
  inset: 0;
  margin: auto;
  height: fit-content;
  text-align: center;
  font-size: 3rem;
  font-weight: 900;
  color: #ffffff;
  text-shadow:
    0 3px 0 rgb(0 0 0 / 0.5),
    0 0 18px rgb(0 0 0 / 0.6);
  pointer-events: none;
  animation: pop 0.35s 0.35s ease-out both;
}

/*
 * Удар играется во время печати: надпись — слева от табло, а не поверх строк (между табло
 * и блоком разминки места нет). Справа угол занят кнопкой справки.
 */
.shot-label:not(.banner) {
  inset: 14px auto auto 16px;
  margin: 0;
  max-width: 230px;
  font-size: 2rem;
  text-align: left;
}

.shot-label.goal {
  color: #ffd84a;
}

.shot-label.conceded,
.shot-label.banner {
  font-size: 2.2rem;
}

.shot-label.banner {
  color: #ffd84a;
}

@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}

/*
 * Поля слота узкие: блок разминки из трёх строк умещается в поле без роста (окно 1024×640).
 * Слой выше мяча: мяч вылетает из-за строк и не закрывает их в первый миг удара.
 */
.line-slot {
  position: relative;
  z-index: 1;
  padding: 6px 10px;
}

@media (prefers-reduced-motion: reduce) {
  .ball {
    display: none;
  }

  .shot-label {
    animation: none;
  }
}
</style>
