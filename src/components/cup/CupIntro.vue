<script setup lang="ts">
/**
 * Вступление матча Кубка (068 Т6, кадры Э5.23/.24): эмблемы двух команд, «против», дома или в гостях, правила строками, «Начать».
 * Только показ готового `CupMatchInfo` (`app/cup/run`): ничего не считает. Золота нет — эмблемы и белая рамка (ТАБУ).
 */
import { storyArtUrl } from '../../app/art/storyArt';
import { emblemKey } from '../../app/cup/groupView';
import type { CupMatchInfo } from '../../app/cup/run';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';
import KitTag from '../kit/KitTag.vue';

defineProps<{ info: CupMatchInfo; club: string }>();
defineEmits<{ start: []; help: []; home: [] }>();
const t = ru.cup.match;
</script>

<template>
  <section class="card panel cupintro">
    <h2>{{ info.title }}</h2>
    <div class="vs">
      <span><img
        :src="storyArtUrl(emblemKey('our'))"
        alt=""
        width="81"
        height="96"
      ><b>{{ club }}</b><small>{{ ru.cup.screen.ourYard }}</small></span>
      <i>{{ t.against }}<KitTag kind="nt">{{ info.where }}</KitTag></i>
      <span><img
        :src="storyArtUrl(emblemKey(info.team.id))"
        alt=""
        width="81"
        height="96"
      ><b>{{ info.team.name }}</b><small>{{ info.teamSub }}</small></span>
    </div>
    <ul>
      <li
        v-for="r in info.rules"
        :key="r"
      >
        {{ r }}
      </li>
    </ul>
    <div class="btns">
      <KeyButton
        primary
        :sub="ru.match.intro.startKey"
        @click="$emit('start')"
      >
        {{ ru.match.intro.start }}
      </KeyButton>
      <KeyButton
        quiet
        @click="$emit('help')"
      >
        {{ ru.match.intro.hands }}
      </KeyButton>
      <span style="flex: 1" />
      <KeyButton
        quiet
        @click="$emit('home')"
      >
        {{ ru.match.intro.home }}
      </KeyButton>
    </div>
  </section>
</template>

<style scoped>
.cupintro { position: absolute; left: 50%; margin-left: -330px; width: 660px; top: 92px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; }
h2 { margin: 0 0 -4px; font-size: 26px; }
.vs { display: flex; align-items: flex-start; justify-content: center; gap: 26px; margin: 3px 0 0; }
.vs > span { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 190px; }
.vs b { font-size: 22px; }
.vs small { font-size: 15px; color: var(--text-muted); }
.vs i { align-self: center; font-style: normal; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-muted); font-size: 16px; }
.vs i .kb-tag { font-size: 15px; }
ul { list-style: none; margin: 0 0 7px; padding: 0; font-size: 16px; font-weight: 700; display: flex; flex-direction: column; gap: 4px; }
li::before { content: '·'; margin-right: 8px; color: var(--brand-green); }
.btns { display: flex; gap: 10px; align-items: center; }
</style>
