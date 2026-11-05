<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { homeLeague } from '../app/cup';
import { playerName, players } from '../app/players';
import { progress } from '../app/progress';
import { soon } from '../app/unlocks';
import { kicksLeft } from '../engine/save';
import { artUrl } from '../art/assets';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

// Первый матч начинается с создания своего клуба (docs/design.md, «Свой клуб»).
const playTo = computed(() => (progress.club ? '/match' : '/club'));
// Недобитая серия пенальти — вход с главной: иначе ушёл с итога, и удары не найти.
const kicks = computed(() => kicksLeft(progress.penalty));
// Кубок — одна кнопка, чтобы главная влезала в 1024×640: самый ранний недоигранный видимый,
// все доиграны — самой старшей лиги. Остальные кубки — с полки трофеев на экране кубка.
const cup = computed(() => homeLeague());
// «Новое!» на кнопке кубка — пока у лиги нет записи, то есть до первого матча кубка (спека 002).
const cupFresh = computed(() => cup.value !== null && progress.cups[cup.value] === undefined);
// «Скоро: 1/8 финала кубка дворовой лиги — после урока 4, ещё 3 урока» — что и когда откроется (спека 002).
const soonText = computed(() => {
  const next = soon();
  if (!next) return null;
  const t = ru.unlocks;
  const left = next.left > 1 ? `${t.left} ${next.left} ${plural(next.left, t.lessons)}` : t.thisLesson;
  return `${t.soon} ${next.label} — ${t.after} ${next.lesson}, ${left}`;
});

// Игроков двое и больше — кто играет и «Сменить» (у главной нет верхней панели).
const who = computed(() => (players.players.length >= 2 ? playerName.value : null));

// Фон задаётся из скрипта: путь зависит от подраздела сайта (BASE_URL).
const bgStyle = { backgroundImage: `url(${artUrl('menuBg')})` };
</script>

<template>
  <section
    class="home"
    :style="bgStyle"
  >
    <div class="panel">
      <h1 class="logo">
        <img
          :src="artUrl('logo')"
          :alt="ru.appTitle"
          width="1100"
          height="526"
        >
      </h1>
      <!-- Клуб и игрок — одной строкой: в окне 1024×640 лишняя строка выталкивает кнопки за край. -->
      <div
        v-if="progress.club || who !== null"
        class="id-row"
      >
        <p
          v-if="progress.club"
          class="club-name"
        >
          {{ progress.club.name }}
        </p>
        <p
          v-if="who !== null"
          class="who"
        >
          <span>{{ who }}</span>
          <RouterLink
            class="switch"
            to="/players"
            :aria-label="ru.players.switchLabel"
          >
            {{ ru.players.switch }}
          </RouterLink>
        </p>
      </div>
      <!-- Девиз — пока клуба нет; с клубом его место нужнее кнопкам (1024×640, серия пенальти). -->
      <p
        v-if="!progress.club"
        class="tagline"
      >
        {{ ru.tagline }}
      </p>
      <nav
        class="actions"
        :class="{ pair: kicks > 0 && cup !== null }"
      >
        <RouterLink
          class="btn primary"
          :to="playTo"
        >
          {{ ru.home.play }}
        </RouterLink>
        <!-- Пенальти и кубок: одна кнопка — во всю ширину, обе — рядом (окно 1024×640). -->
        <RouterLink
          v-if="kicks > 0"
          class="btn"
          :class="{ wide: cup === null }"
          to="/penalty"
        >
          {{ ru.home.penalty }} ({{ kicks }})
        </RouterLink>
        <RouterLink
          v-if="cup !== null"
          class="btn cup"
          :class="{ wide: kicks === 0 }"
          :to="`/cup/${cup}`"
        >
          {{ ru.cup.titles[cup] }}
          <span
            v-if="cupFresh"
            class="fresh"
          >{{ ru.unlocks.fresh }}</span>
        </RouterLink>
        <RouterLink
          class="btn"
          to="/locker"
        >
          {{ ru.home.locker }}
        </RouterLink>
        <RouterLink
          class="btn"
          to="/stats"
        >
          {{ ru.home.stats }}
        </RouterLink>
      </nav>
      <!-- Не больше двух строк, целиком: многоточие съедало, после какого урока откроется (тестировщик 005). -->
      <p
        v-if="soonText"
        class="soon"
      >
        {{ soonText }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Главный экран всегда на картинке вечернего стадиона, поэтому цвета здесь свои, а не из темы. */
.home {
  position: fixed;
  inset: 0;
  background-color: #1a1838;
  background-size: cover;
  background-position: right center;
  display: flex;
  /* Низкое окно (масштаб 125 %, браузер не на весь экран): панель не обрезается, а прокручивается. */
  align-items: safe center;
  overflow-y: auto;
  padding: 16px calc(4vw / var(--ui-scale));
}

.panel {
  width: min(560px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.logo {
  margin: 0;
  width: 100%;
}

.logo img {
  width: auto;
  max-width: 100%;
  height: auto;
  /*
   * Низкое окно: логотип ужимается, кнопки остаются в окне без прокрутки. 32vh, а не 36vh:
   * в 1024×640 с кнопкой кубка и «Скоро» в две строки иначе не хватало ~22 px.
   */
  max-height: min(268px, 32vh / var(--ui-scale));
  margin-inline: auto;
  display: block;
  filter: drop-shadow(0 8px 24px rgb(0 0 0 / 0.45));
}

.club-name {
  margin: 0;
  padding: 4px 22px;
  border-radius: 999px;
  color: #1b1b1f;
  background: #f4c24a;
  font-size: 1.4rem;
  font-weight: 800;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.45);
}

.id-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.who {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff6e0;
  font-size: 1.15rem;
  font-weight: 800;
  text-shadow: 0 2px 8px rgb(0 0 0 / 0.7);
}

.switch {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 18px;
  border: 2px solid #f4c24a;
  border-radius: 999px;
  background: rgb(16 15 44 / 0.7);
  color: #fff6e0;
  text-decoration: none;
  text-shadow: none;
}

.switch:hover {
  background: rgb(16 15 44 / 0.9);
}

.switch:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 4px;
}

.tagline {
  margin: 0;
  color: #fff6e0;
  font-size: 1.25rem;
  font-weight: 600;
  text-shadow: 0 2px 8px rgb(0 0 0 / 0.7);
}

/*
 * Шкафчик и статистика — рядом, одной строкой: с кнопкой серии пенальти панель всё равно
 * помещается в окно 1024×640 без прокрутки. Главные кнопки — во всю ширину.
 */
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  width: min(420px, 100%);
  margin-top: 16px;
}

/* Пенальти и кубок рядом: ряд шире и шрифт мельче — «Кубок городской лиги» в одну строку. */
.actions.pair {
  width: min(520px, 100%);
}

.actions.pair .btn:not(.primary, .wide) {
  padding-inline: 10px;
  font-size: 1.05rem;
}

.actions .primary,
.actions .wide {
  grid-column: 1 / -1;
}

/* Кнопки — «клавиши»: объём снизу, как у букв логотипа. */
.btn {
  display: block;
  text-align: center;
  padding: 14px 16px;
  border-radius: 16px;
  font-weight: 800;
  font-size: 1.15rem;
  text-decoration: none;
  color: #1b3a12;
  background: linear-gradient(#ffffff, #e4ecd9);
  box-shadow:
    0 6px 0 #9fb58a,
    0 10px 20px rgb(0 0 0 / 0.35);
  transition:
    transform 0.08s,
    box-shadow 0.08s;
}

.btn.primary {
  font-size: 1.5rem;
  padding: 18px 24px;
  color: #ffffff;
  background: linear-gradient(#6fd34a, #2f9a27);
  box-shadow:
    0 7px 0 #1d6b18,
    0 0 0 3px #f4c24a,
    0 12px 26px rgb(0 0 0 / 0.4);
  text-shadow: 0 2px 0 #1d6b18;
}

/* Кубок — золотая «клавиша»: цель по ходу лиги, её видно сразу. */
.btn.cup {
  position: relative;
  color: #3a2a00;
  background: linear-gradient(#ffe08a, #f4c24a);
  box-shadow:
    0 6px 0 #b3861a,
    0 10px 20px rgb(0 0 0 / 0.35);
}

.btn:hover {
  transform: translateY(-2px);
}

/* «Новое!» — наклейка на углу кнопки кубка: высоту кнопки не меняет и не мигает. */
.fresh {
  position: absolute;
  top: -10px;
  right: -8px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #e2342b;
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1.3;
  transform: rotate(6deg);
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.4);
}

.soon {
  margin: 0;
  max-width: 100%;
  text-align: center;
  text-wrap: balance;
  color: #fff6e0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 2px 8px rgb(0 0 0 / 0.7);
}

.btn:active {
  transform: translateY(5px);
  box-shadow: 0 1px 0 #9fb58a;
}

.btn.primary:active {
  box-shadow:
    0 2px 0 #1d6b18,
    0 0 0 3px #f4c24a;
}

.btn:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 4px;
}

/* Узкий экран: панель по центру, под ней затемнение, иначе текст теряется на трибунах.
   Затемнение — отдельным слоем: фон задан в style, и правило отсюда его бы не перебило. */
@media (width <= 760px) {
  .home {
    justify-content: center;
  }

  .home::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgb(20 18 50 / 0.55);
  }

  .panel {
    position: relative;
  }
}
</style>
