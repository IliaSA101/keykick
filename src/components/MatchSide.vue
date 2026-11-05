<script setup lang="ts">
/*
 * Команда сбоку от поля матча — на широком окне, где по бокам пусто (docs/design.md, 04.11,
 * «формы по бокам»): крупная форма, кто это и название команды (у соперника — и город).
 * Своя форма — спиной, с именем и номером, как надетая в шкафчике. Колонка от 150 px —
 * весь комплект с бутсами (OutfitView, спека 004), уже — только футболка.
 */
import OutfitView from './OutfitView.vue';
import type { Boots } from '../engine/boots';
import type { shirtBack } from '../engine/club';
import type { Kit } from '../engine/kit';

defineProps<{
  kit: Kit;
  /** Имя и номер на спине; нет — форма спереди. */
  back?: ReturnType<typeof shirtBack>;
  /** Бутсы под гетрами: свои — надетые, у соперника — обычные. */
  boots: Boots;
  /** «Ты» или «Соперник». */
  role: string;
  name: string;
  city?: string | null;
}>();
</script>

<template>
  <figure class="side">
    <OutfitView
      class="kit"
      layout="stack"
      :kit="kit"
      :back="back ?? null"
      :boots="boots"
    />
    <figcaption>
      <span class="role">{{ role }}</span>
      <b class="name">{{ name }}</b>
      <span
        v-if="city"
        class="city"
      >{{ city }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.side {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
  color: #ffffff;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
}

.kit {
  width: min(100%, 180px);
}

figcaption {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 100%;
  line-height: 1.2;
}

.role {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
}

/* Длинное название переносится по словам, а не вылезает за колонку. */
.name {
  font-size: 1rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.city {
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>
