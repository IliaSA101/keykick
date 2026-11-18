import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import packs from './tools/packs.mjs';

// Игра публикуется подразделом GitHub Pages, поэтому все пути идут с префиксом.
export default defineConfig({
  base: '/keykick/',
  // Пакеты лиг (060 §5): закрытые едут только при KK_EDITION=closed.
  plugins: [vue(), packs({ edition: process.env.KK_EDITION })],
  // Служебные папки с точкой (там и копии агентов) — не наш код: без этого их правки перезагружали страницу.
  server: { host: true, watch: { ignored: ['**/.*/**'] } },
  build: { target: 'es2022' },
});
