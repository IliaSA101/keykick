/**
 * Тесты — на чистой логике (src/engine, контент, сохранение) и стражи по исходникам.
 * Окружение — обычный node: проверяемые модули не тянут Vue и DOM.
 * Экраны проверяются глазами в браузере, DOM-тесты виджетов появятся с Фазы 2.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    reporters: 'dot',
  },
});
