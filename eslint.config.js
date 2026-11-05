// @ts-check
/**
 * Линтер как правила проекта: проверки по типам для TS и Vue, ноль предупреждений.
 * Правило, которое здесь выключено, выключено с причиной рядом.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

export default tseslint.config(
  // tools/*.mjs и .claude/hooks — служебные скрипты вне tsconfig: их гоняют руками или хуками.
  {
    ignores: ['dist/**', 'node_modules/**', 'art-src/**', 'art-work/**', 'tools/**/*.mjs', '.claude/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // Подчёркивание в начале имени — наш способ сказать «аргумент не нужен».
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Экраны называются одним словом осмысленно (Home, Locker): префикс Screen есть в имени файла.
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // Сам конфиг на JS: проверки по типам ему негде взять проект.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
