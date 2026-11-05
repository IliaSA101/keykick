// Задачи для пенальти: данные — в content, проверка — в движке (тест падает на ошибке в JSON).
import tasksJson from '../content/tasks.json';
import { parseTasks } from '../engine/tasks';

export const tasks = parseTasks(tasksJson);
