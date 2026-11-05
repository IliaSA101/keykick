import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Игра публикуется подразделом GitHub Pages, поэтому все пути идут с префиксом.
export default defineConfig({
  base: '/keykick/',
  plugins: [vue()],
  // Копии агентов (.claude/worktrees) — не наш код: без этого их правки перезагружали страницу.
  server: { host: true, watch: { ignored: ['**/.claude/**'] } },
  build: { target: 'es2022' },
});
