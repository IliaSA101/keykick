<script setup lang="ts">
/*
 * Копии сохранений у родителя (спека 014-Т6, Р13, design §8 «Возврат снимка»): по игроку — снимки дней и копии «до …»
 * с датой и кнопкой «Сохранить файлом». Файл копии грузится тем же «Загрузить файл» и заменяет только её игрока.
 * Строки — чистая `copyGroups`; файл отдаёт `downloadCopy`. `demo` — готовые имена копий для витрины кадров.
 */
import { computed, ref } from 'vue';
import { players } from '../../app/players/list';
import { copyNames, deletedNames, downloadCopy } from '../../app/save/backup';
import { localDay } from '../../app/session';
import { copyGroups } from '../../engine/save/backupView';
import { ru } from '../../i18n/ru';

const props = defineProps<{ demo?: { names: string[]; nameOf: Record<string, string> } }>();

const t = ru.backup.copies;

const names = props.demo?.names ?? copyNames();
// Удалённого игрока в списке нет: его имя берём из копии «до удаления» (014-Р18).
const gone = props.demo === undefined ? deletedNames() : {};
const groups = computed(() =>
  copyGroups(
    names,
    (id) => (props.demo === undefined ? (players.players.find((p) => p.id === id)?.name ?? gone[id] ?? null) : (props.demo.nameOf[id] ?? null)),
    localDay,
  ),
);

/** Что сказали о последнем нажатии: имя файла или «не получился». */
const answer = ref<{ name: string } | 'failed' | null>(null);

/** Файл собирается (ждём журнал игрока до 3 с): вторая копия не стартует, пока первая не закончила. */
const busy = ref(false);

async function save(key: string): Promise<void> {
  if (props.demo !== undefined || busy.value) return;
  busy.value = true;
  try {
    const r = await downloadCopy(key);
    answer.value = r === null ? 'failed' : { name: r.name };
  } catch {
    answer.value = 'failed';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="block">
    <h2>{{ t.title }}</h2>
    <p class="muted">
      {{ t.lead }}
    </p>
    <p
      v-if="groups.length === 0"
      class="muted"
    >
      {{ t.empty }}
    </p>
    <div
      v-for="g in groups"
      :key="g.id"
      class="group"
    >
      <h3>{{ g.name ?? t.gone }}</h3>
      <ul>
        <li
          v-for="c in g.items"
          :key="c.key"
        >
          <span class="what">{{ t.kinds[c.kind] }}</span>
          <span class="when">{{ c.format === null ? c.when : `${t.format} ${c.format}` }}</span>
          <button
            type="button"
            class="btn"
            :disabled="busy"
            :aria-label="`${t.save}: ${g.name ?? g.id}, ${t.kinds[c.kind]} ${c.format === null ? c.when : `${t.format} ${c.format}`}`"
            @click="save(c.key)"
          >
            {{ t.save }}
          </button>
        </li>
      </ul>
    </div>
    <p
      v-if="answer === 'failed'"
      class="note"
      role="alert"
    >
      {{ t.failed }}
    </p>
    <p
      v-else-if="answer !== null"
      class="note"
      role="status"
    >
      {{ t.saved }} {{ answer.name }}
    </p>
  </section>
</template>

<style scoped src="./paper.css"></style>
<style scoped>
.group {
  margin-top: var(--space-3);
}

h3 {
  margin: 0;
  font-size: 1.05rem;
}

ul {
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--paper-border);
}

.what {
  min-width: 11rem;
  font-weight: 700;
}

.when {
  flex: 1;
  color: #555;
}
</style>
