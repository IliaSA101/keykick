<script setup lang="ts">
/**
 * Стенд газет Музея (068 Т11, Э2К.28): доска 2×4 с миниатюрами восьми выпусков (`NewsMini`), подписью и номером; вышедший выпуск — кнопка,
 * открывает окно архива (хозяин — `MuseumScreen`). «Все газеты ›» — синяя плашка-ярлык kit (`kb-chip sm`, 068-Р96, Э2К.26), открывает последний вышедший. Свежий выпуск — метка «свежий» до урока 31,
 * дальше — строка про Стенгазету Дома (049-Р37). Не вышедший — силуэт. Положение доски — хозяин (`box`, `ropes`); здесь только содержимое.
 */
import { computed } from 'vue';
import { fill } from '../../app/home/texts';
import type { PaperView } from '../../app/story/paperView';
import NewsMini from '../../components/story/NewsMini.vue';
import { papersShelf } from '../../engine/museum';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  shelf: ReturnType<typeof papersShelf>;
  views: Record<number, PaperView>;
  color: string;
  /** Ширина миниатюры, px сцены. */
  cell: number;
  /** С урока 31 свежий выпуск — на Стенгазете Дома (049-Р37). */
  note: boolean;
}>();
const emit = defineEmits<{ open: [n: number] }>();
const t = ru.museum;
const title = computed(() => fill(t.papers, { n: String(props.shelf.have), of: String(props.shelf.of) }));
/** Короткое название выпуска (подпись под миниатюрой): три названия общие с «Новым клубом» первого запуска и заголовками комиксов. */
function shortOf(n: number): string {
  if (n === 1) return ru.parent.players.stuck.newClub;
  if (n === 5) return ru.story.comic.title.group;
  if (n === 8 && props.views[8]?.deco === 'silver') return ru.story.comic.title.silver;
  return ru.story.paper.shorts[n] ?? '';
}
</script>

<template>
  <div class="bh">
    <b>{{ title }}</b>
    <button
      v-if="shelf.last !== null"
      type="button"
      class="kb-chip sm"
      @click="emit('open', shelf.last)"
    >
      {{ t.allPapers }}
    </button>
  </div>
  <div
    v-if="note"
    class="note"
  >
    {{ t.standNote }}
  </div>
  <div class="pg">
    <template
      v-for="c in shelf.cells"
      :key="c.n"
    >
      <button
        v-if="c.have && views[c.n]"
        type="button"
        class="pm"
        :class="{ fresh: c.fresh }"
        @click="emit('open', c.n)"
      >
        <i
          v-if="c.fresh"
          class="new"
        >{{ t.fresh }}</i>
        <NewsMini
          :view="views[c.n]!"
          :color="color"
          :width="cell"
        />
        <b>{{ shortOf(c.n) }}</b><em>{{ fill(ru.story.paper.no, { n: c.n }) }}</em>
      </button>
      <span
        v-else
        class="pm none"
      ><i class="mh" /><i class="hl" /><i class="hl s" /><i class="ph" /><em>{{ fill(ru.story.paper.no, { n: c.n }) }}</em></span>
    </template>
  </div>
</template>

<style scoped>
.bh {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
}
.bh > b {
  font-size: 13px;
  line-height: 1.1;
  white-space: nowrap;
}
.bh button.kb-chip:focus-visible,
.pm:focus-visible {
  outline: 2px solid #3c8a5c;
  outline-offset: 2px;
}
.note {
  margin-top: -3px;
  font-size: 12px;
  line-height: 1.2;
  color: #6b6652;
}
.pg {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.pm {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 0;
  margin: 0;
  padding: 0 0 2px;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
}
button.pm > b {
  min-height: 2.1em;
  padding-right: 22px;
  font-size: 12px;
  line-height: 1.05;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: #26241f;
}
.pm > em {
  position: absolute;
  right: 3px;
  bottom: 2px;
  font-style: normal;
  font-size: 12px;
  font-weight: 800;
  color: #6b6652;
}
/* свежий: белое кольцо и зелёное (не жёлтое рядом с синим) */
.pm.fresh {
  overflow: visible;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3c8a5c, 0 2px 6px #0006;
}
.new {
  position: absolute;
  top: 18px;
  right: -6px;
  z-index: 2;
  padding: 1px 7px;
  border-radius: 9px;
  background: #3c8a5c;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  font-style: normal;
  box-shadow: 0 1px 3px #0006;
}
.pm.none {
  align-self: start;
  height: 72px;
  padding: 4px 2px 3px;
  background: #ebe5d2;
  border: 1.5px dashed #b4ab92;
  opacity: 0.85;
  cursor: default;
}
.pm.none > i {
  display: block;
  height: 5px;
  background: #d5cdb7;
}
.pm.none > .hl {
  flex: none;
  height: 6px;
}
.pm.none > .hl.s {
  margin-right: 40%;
}
.pm.none > .ph {
  flex: 1;
  min-height: 14px;
  height: auto;
  background: #ddd6c1;
}
.pm.none > em {
  color: #8d8570;
}
</style>
