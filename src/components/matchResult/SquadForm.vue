<script setup lang="ts">
/*
 * Форма пальцев в итоге матча (спека 017, design §8, ТЗ-2.10, 017-Р26): строка роста («Левый указательный: +2 %»,
 * при смене ранга — «: +2 % · основа») — только рост, падения не показываем; на контрольных уроках (14 и 21) — отчёт по 8 игрокам с лесенкой
 * «юниор → новичок → основа → сборная → звезда». Ничего не выросло и отчёта нет — компонент пуст.
 */
import type { FormGrowth } from '../../engine/matchResult/form';
import type { ReportRow } from '../../engine/matchResult/resultModel';
import { ru } from '../../i18n/ru';

defineProps<{
  growth: FormGrowth[];
  /** Отчёт по 8 игрокам; null — только рост. */
  report: ReportRow[] | null;
}>();

const t = ru.match2Result.form;
const names = t.ranks;
</script>

<template>
  <section
    v-if="growth.length > 0 || report"
    class="form"
  >
    <template v-if="growth.length > 0">
      <h3 class="head">
        {{ t.grew }}
      </h3>
      <ul class="grew">
        <li
          v-for="g in growth"
          :key="g.finger"
          :data-finger="g.finger"
        >
          {{ g.name }}:
          <template v-if="g.percent > 0">
            {{ t.gain.replace('{n}', String(g.percent)) }}
          </template>
          <template v-if="g.percent > 0 && g.rank > g.from">
            ·
          </template>
          <b v-if="g.rank > g.from">{{ names[g.rank] }}</b>
        </li>
      </ul>
    </template>
    <template v-if="report">
      <h3 class="head">
        {{ t.report }}
      </h3>
      <ul class="report">
        <li
          v-for="r in report"
          :key="r.name"
          class="row"
        >
          <span class="who">{{ r.name }}</span>
          <span
            class="ladder"
            aria-hidden="true"
          >
            <i
              v-for="(_, k) in names"
              :key="k"
              :class="{ on: k <= r.rank }"
            />
          </span>
          <b class="rank">{{ names[r.rank] }}</b>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.form {
  text-align: center;
}

.head {
  margin: 0 0 var(--space-1);
  font-size: 0.95rem;
  color: var(--text-muted);
}

.grew,
.report {
  margin: 0;
  padding: 0;
  list-style: none;
}

.grew li {
  font-size: 0.95rem;
}

.grew b {
  color: var(--accent);
}

/* Отчёт — две колонки по четыре игрока, чтобы итог с кнопками помещался в 640 по высоте. */
.report {
  display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: center;
  gap: 2px var(--space-4);
}

.row {
  display: grid;
  grid-template-columns: 11em 5em 4.5em;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.8rem;
  text-align: left;
}

.ladder {
  display: flex;
  gap: 3px;
}

.ladder i {
  width: 12px;
  height: 8px;
  border-radius: 3px;
  background: var(--border);
}

.ladder i.on {
  background: var(--accent);
}
</style>
