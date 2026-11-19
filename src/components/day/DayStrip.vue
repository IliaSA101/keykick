<script setup lang="ts">
/**
 * Полоса «Итог дня» (068 Т8, Э6.36–Э6.37, story.md §3): газетная полоса над затемнённой сценой — шапка «клуб · день», заголовок старшего
 * события, пункты, «Завтра — урок N» и две кнопки. Enter и Esc — «В Дом» (владелец окна — экран итога), «Ещё матч» (у Кубка после победы — «На карту», `moreLabel`) — мышью и Tab.
 * Только показ готового `StripView` (`app/day/view`); бумага светлая, золота на синем нет (ТАБУ).
 */
import type { StripView } from '../../app/day/view';
import { ru } from '../../i18n/ru';
import { storyArtUrl } from '../../app/art/storyArt';
import KeyButton from '../kit/KeyButton.vue';

defineProps<{ view: StripView; moreLabel?: string }>();
defineEmits<{ home: []; more: [] }>();
/** Вырезка листа газеты (Э6, 050-Р53): рваный край в самой картинке, тень — CSS. */
const paper = `url(${storyArtUrl('storyPaperStripPaper')})`;
</script>

<template>
  <div class="ds-shade">
    <article
      class="ds"
      role="dialog"
      aria-modal="true"
      :aria-label="ru.day.act.summary"
      :style="{ '--paper': paper }"
    >
      <div class="l">
        <p class="kick">
          {{ view.kick }}
        </p>
        <h3>{{ view.head }}</h3>
      </div>
      <ul>
        <li
          v-for="i in view.items"
          :key="i"
        >
          <template v-if="i.startsWith(view.passedLead)">
            <b>{{ view.passedLead }}</b>{{ i.slice(view.passedLead.length) }}
          </template>
          <template v-else>
            {{ i }}
          </template>
        </li>
      </ul>
      <div class="r">
        <p class="tom">
          {{ view.tomorrow }}
        </p>
        <div class="btns">
          <KeyButton
            md
            @click="$emit('more')"
          >
            {{ moreLabel ?? ru.day.act.more }}
          </KeyButton>
          <KeyButton
            md
            primary
            :sub="ru.result.enter"
            @click="$emit('home')"
          >
            {{ ru.result.home }}
          </KeyButton>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
/* Э6.36–.37: полоса у низа экрана, сцена под ней затемнена (0,4) — взгляд на бумагу, не на ворота; бумага — вырезка листа, не рамка вокруг синего (ТАБУ) */
.ds-shade { position: absolute; inset: 0; z-index: 30; background: rgb(10 9 32 / 0.4); display: flex; align-items: flex-end; justify-content: center; padding: 0 24px 68px; box-sizing: border-box; }
.ds { position: relative; width: 100%; height: 150px; box-sizing: border-box; padding: 0 4px; display: flex; align-items: stretch; background: var(--paper) 0 0 / 100% 100% no-repeat; color: #2a2418; filter: drop-shadow(0 5px 9px rgb(0 0 0 / 0.5)); }
.ds::before { content: ''; position: absolute; left: 40px; right: 40px; top: 17px; border-top: 4px solid #1f8a4c; }
.l { flex: 0 0 27%; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; padding: 18px 18px 8px 24px; }
.kick { margin: 0 0 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4a4338; }
h3 { margin: 0; font-size: 25px; line-height: 1.1; font-weight: 800; text-wrap: balance; font-family: 'DejaVu Serif', Georgia, 'Times New Roman', serif; }
ul { flex: 1 1 0; min-width: 0; box-sizing: border-box; margin: 24px 0 18px; padding: 0 18px; list-style: none; display: flex; flex-direction: column; justify-content: center; gap: 12px; border-left: 1px solid #8b8d94; font-size: 15px; font-weight: 400; line-height: 1.3; }
li b { font-weight: 700; }
li { position: relative; padding-left: 16px; text-wrap: balance; }
li::before { content: ''; position: absolute; left: 0; top: 7px; width: 7px; height: 7px; background: #2a2418; }
.r { flex: 0 0 31%; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 10px; margin: 24px 0 18px; padding: 0 24px 0 18px; border-left: 1px solid #8b8d94; }
.tom { margin: 0; font-size: 16px; font-weight: 800; line-height: 1.25; text-wrap: balance; }
.btns { display: flex; flex-wrap: nowrap; align-items: center; gap: 12px; }
@media (max-width: 1100px) { .r { padding-right: 34px; } .btns { gap: 10px; } }
</style>
