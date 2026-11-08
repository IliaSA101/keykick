<script setup lang="ts">
/*
 * «Кто играет?» (#/players): карточки игроков этого компьютера и «Новый игрок».
 * Открывается сам, когда игроков двое и больше и в этой вкладке ещё не выбран, и по «Сменить».
 * Клуб и урок на карточке — из разделов v2 (app/players/cards). Выбрал или создал — на `/`: карта,
 * а у игрока без клуба охрана входа ведёт дальше на `/start` (спека 019-Т11, Т13).
 */
import { computed, nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import PlayerAddForm from '../../components/players/PlayerAddForm.vue';
import PlayerCards from '../../components/players/PlayerCards.vue';
import { playerCards } from '../../app/players/cards';
import { players, playingId } from '../../app/players/list';
import { choosePlayer } from '../../app/roster';
import { PLAYERS_MAX } from '../../engine/players';
import { ru } from '../../i18n/ru';

const t = ru.players;
const router = useRouter();

const cards = computed(playerCards);
const canAdd = computed(() => players.players.length < PLAYERS_MAX);
const adding = ref(false);
const cardList = ref<{ focusAdd: () => void } | null>(null);

function play(id: string): void {
  choosePlayer(id);
  void router.push('/');
}

function cancelAdd(): void {
  adding.value = false;
  void nextTick(() => cardList.value?.focusAdd());
}
</script>

<template>
  <section class="players">
    <header class="panel head">
      <h1>{{ t.title }}</h1>
      <p>{{ t.lead }}</p>
    </header>

    <PlayerCards
      ref="cardList"
      :cards="cards"
      :focus-id="playingId ?? players.current"
      :show-add="canAdd && !adding"
      @play="play"
      @add="adding = true"
    />

    <p
      v-if="!canAdd"
      class="panel note"
    >
      {{ t.full }}
    </p>

    <PlayerAddForm
      v-if="adding"
      @created="router.push('/')"
      @cancel="cancelAdd"
    />
  </section>
</template>

<style scoped>
.players {
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.head h1 {
  margin: 0;
}

.head p {
  margin: var(--space-1) 0 0;
  color: var(--text-muted);
}

.note {
  margin: 0;
  color: var(--text-muted);
}
</style>
