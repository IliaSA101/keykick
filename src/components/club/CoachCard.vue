<script setup lang="ts">
/**
 * Карточка тренера (портрет и имя) — общая у выбора тренера при первом запуске (`CoachPick`, Э2К.34) и у смены тренера в «Клубе»
 * (`CoachSwap`, Э2К.38). `sel` — выбран (белая рамка), `focus` — рамка-фокус стрелок, `mine` — нынешний тренер (зелёная кайма),
 * `sm` — мелкая карточка смены; `sub` — подпись под именем («твой» / «соперник»). Выбор и клавиши — у хозяина.
 */
import { coachPortrait } from './coachArt';

defineProps<{ id: string; name: string; sel?: boolean; focus?: boolean; mine?: boolean; sm?: boolean; sub?: string; pressed: boolean }>();
</script>

<template>
  <button
    type="button"
    class="ccard"
    :class="{ sel, focus, mine, sm }"
    :aria-pressed="pressed"
  >
    <img
      :src="coachPortrait(id)"
      :alt="sub === undefined ? name : ''"
    >
    <b>{{ name }}</b>
    <small v-if="sub !== undefined">{{ sub }}</small>
  </button>
</template>

<style scoped>
/* числа — единицы макета из генераторов Э2К.34 и Э2К.38 (e2k-club.mjs, collection-e-club.css); множителя нет */
.ccard {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 170px; /* кадр: .ce-coach width 150 + padding 8×2 + кайма 2×2 в content-box; здесь border-box — ширина с отступами */
  padding: 8px;
  border: 2px solid #2b2f72;
  border-radius: 14px;
  background: #1a1c45;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.ccard img {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  object-fit: cover;
  object-position: 50% 6%;
  background: #fff;
}
.ccard b {
  font-size: 14px;
}
.ccard small {
  font-size: 11px;
  color: var(--text-muted);
}
.ccard.sm {
  gap: 3px;
  width: 134px;
  padding: 7px;
  border-radius: 12px;
}
.ccard.sm img {
  border-radius: 8px;
}
.ccard.sm b {
  font-size: 13px;
}
.ccard.mine {
  border-color: var(--zone-middle); /* нынешний тренер — зелёная кайма (кадр Э2К.38) */
}
.ccard.sel {
  border-color: #fff; /* выбор — белая рамка, не золото на синем */
  box-shadow: 0 0 0 3px #ffffff55;
}
.ccard.focus {
  outline: 3px solid #fff; /* фокус стрелок — белое кольцо, не золото на синем (ТАБУ) */
  outline-offset: 2px;
}
.ccard:focus-visible {
  border-color: #fff;
  outline: 3px solid #fff; /* фокус — плотное белое кольцо, как у остальных элементов окон (не золото: ТАБУ) */
  outline-offset: 3px;
}
</style>
