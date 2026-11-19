<script setup lang="ts">
/**
 * Лист газеты клуба на стенде (068 Т7, 050-Р46/Р48, вариант В2): шапка, заголовок, «фото», две заметки, рубрика «Знаток Двора», «Дальше».
 * Всё содержимое — готовый вид выпуска (`paperView`), здесь только вёрстка; украшения выпуска 8 — по `view.deco`. Лист кладётся на стенд
 * окном `NewsWindow` (стенд и полочка кнопок — там). Размеры — `news.css`, украшения — `news-decor.css`.
 */
import { computed } from 'vue';
import { storyArtUrl, type StoryArtKey } from '../../app/art/storyArt';
import { fill } from '../../app/home/texts';
import type { PaperView } from '../../app/story/paperView';
import { ru } from '../../i18n/ru';
import { headWithoutClub, isLongClub, nbText, photoUrl } from './news';
import './news.css';
import './news-decor.css';

const props = defineProps<{ view: PaperView; wide: boolean; color: string }>();
const t = ru.story.paper;
const art = (k: StoryArtKey): string => storyArtUrl(k);
const long = computed(() => isLongClub(props.view.club));
const head = computed(() => nbText(long.value ? headWithoutClub(props.view.head, props.view.club) : props.view.head));
const vars = computed(() => {
  const u = (k: StoryArtKey): string => `url(${storyArtUrl(k)})`;
  return { '--c1': props.color, '--u-ink6': u('storyPaperInk6'), '--u-ink7': u('storyPaperInk7'), '--u-ink9': u('storyPaperInk9'), '--u-ink11': u('storyPaperInk11'), '--u-print': u('storyPaperStationery10') };
});
const icons = [art('storyPaperInk3'), art('storyPaperInk2')];
const photo = computed(() => (props.view.pic === 'title' ? '' : photoUrl(props.view.pic, props.wide)));
</script>

<template>
  <article
    class="nw-sheet"
    :class="[{ long }, view.deco ? `deco-${view.deco}` : '']"
    :style="vars"
  >
    <img
      v-if="view.deco === 'champ'"
      class="nw-stat nw-rosette"
      :src="art('storyPaperStationery9')"
      alt=""
    >
    <template v-else>
      <img
        class="nw-stat nw-pin l"
        :src="art('storyPaperStationery1')"
        alt=""
      >
      <img
        class="nw-stat nw-pin r"
        :src="art('storyPaperStationery1')"
        alt=""
      >
    </template>
    <div class="nw-mast">
      <img
        class="nw-ink nw-crest"
        :src="art('storyPaperInk8')"
        alt=""
      >
      <b class="nw-no">{{ fill(t.no, { n: view.n }) }}</b>
      <h2 v-if="long">
        <span class="nw-kick">{{ t.kick }}</span><span class="nw-club">{{ view.club }}</span>
      </h2>
      <h2 v-else>
        {{ fill(t.mast, { club: view.club }) }}
      </h2>
      <p>{{ fill(t.meta, { city: view.city, day: view.day }) }}</p>
    </div>
    <h3 class="nw-head">
      {{ head }}
    </h3>
    <div class="nw-body">
      <section class="nw-p">
        <figure class="nw-pp">
          <div
            v-if="view.pic === 'title'"
            class="nw-print"
          >
            <div class="nw-ph">
              <img
                :src="art('cupTitleKey')"
                alt=""
              >
            </div>
            <img
              class="nw-stat nw-tape a"
              :src="art('storyPaperStationery4')"
              alt=""
            >
            <img
              class="nw-stat nw-tape b"
              :src="art('storyPaperStationery4')"
              alt=""
            >
            <img
              class="nw-patch"
              :src="art('cupPatch')"
              alt=""
            >
            <img
              class="nw-stat nw-patch-pin"
              :src="art('storyPaperStationery1')"
              alt=""
            >
          </div>
          <div
            v-else
            class="nw-ph"
          >
            <img
              :src="photo"
              alt=""
            >
          </div>
          <figcaption>{{ view.caption }}</figcaption>
        </figure>
      </section>
      <section class="nw-n">
        <template
          v-for="([h, b], i) in view.notes"
          :key="i"
        >
          <h4>
            <img
              class="nw-ink nw-ico"
              :src="icons[i]"
              alt=""
            >{{ nbText(h) }}
          </h4>
          <p>{{ nbText(b) }}</p>
        </template>
      </section>
      <section class="nw-r">
        <aside
          class="nw-rub"
          :class="{ big: view.rubric.big !== '' }"
        >
          <h4>
            <img
              class="nw-ink nw-ico"
              :src="art('storyPaperInk4')"
              alt=""
            >{{ view.rubric.title }}
          </h4>
          <p
            v-if="view.rubric.big"
            class="nw-rub-t"
          >
            {{ view.rubric.big }}
          </p>
          <p>{{ nbText(view.rubric.text) }}</p>
        </aside>
      </section>
    </div>
    <footer class="nw-foot">
      <span>{{ nbText(view.next) }}</span>
    </footer>
  </article>
</template>
