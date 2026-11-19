<script setup lang="ts">
/**
 * Шапка — `topbar` из kit.mjs, одна на всю игру: логотип, пять пунктов меню (063-Р17), справа меню игрока (068-Р82; в матче его нет) и звук.
 * page — id активного пункта (`home`, `map`…; другой — никакого); match — состояние «матч»: меню приглушено и не нажимается,
 * справа «Пауза Esc»; pause=false — без паузы (матч окончен, окно поверх держит Esc само, запрос Сюжета 050 №21).
 */
import { useNav } from '../../app/nav/useNav';
import { artUrl } from '../../art/assets';
import { isScreen } from '../../engine/nav';
import { ru } from '../../i18n/ru';
import PauseButton from './PauseButton.vue';
import PlayerMenu from './PlayerMenu.vue';
import SoundButton from './SoundButton.vue';

const props = withDefaults(defineProps<{ page?: string; match?: boolean; pause?: boolean }>(), { page: '', match: false, pause: true });
defineEmits<{ pause: [] }>();

const items = Object.entries(ru.frame.menu);
const nav = useNav();
/** Пункт меню идёт через модель навигации (054): вид входа в Путь клуба и счёт входов; ссылка с `href` остаётся для открытия в новой вкладке. */
function go(e: MouseEvent, id: string): void {
  if (props.match || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0 || !isScreen(id)) return;
  e.preventDefault();
  nav.send({ t: 'menu', item: id });
}
</script>

<template>
  <header
    class="kb-top"
    :class="{ match }"
  >
    <img
      class="logo"
      :src="artUrl('logo')"
      :alt="ru.frame.logoAlt"
    >
    <nav :aria-label="ru.frame.menuLabel">
      <a
        v-for="[id, title] in items"
        :key="id"
        :href="match ? undefined : `#/${id}`"
        :class="{ on: !match && id === page }"
        :aria-current="!match && id === page ? 'page' : undefined"
        @click="go($event, id)"
      >{{ title }}</a>
    </nav>
    <div class="kb-tools">
      <PauseButton
        v-if="match && pause"
        @pause="$emit('pause')"
      />
      <PlayerMenu v-if="!match" />
      <SoundButton />
    </div>
  </header>
</template>
