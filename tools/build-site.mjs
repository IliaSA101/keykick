// Сборка dist/ из трёх адресов по site.json (спека 013, design.md §2).
// Метки собираются во временных копиях (git worktree), рабочая копия не трогается.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitePlan } from './site-plan.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(repo, 'dist');

function run(cmd, args, cwd, env = {}) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`не удалось: ${cmd} ${args.join(' ')} (в ${cwd})`);
}

function git(args) {
  run('git', ['-C', repo, ...args], repo);
}

const plan = sitePlan(JSON.parse(readFileSync(join(repo, 'site.json'), 'utf8')));
const tmp = mkdtempSync(join(tmpdir(), 'kk-site-'));
const worktrees = new Map();

function sourceFor(ref) {
  if (ref === null) return repo;
  if (!worktrees.has(ref)) {
    const dir = join(tmp, `src-${ref}`);
    git(['worktree', 'add', '--detach', dir, ref]);
    worktrees.set(ref, dir);
    run('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], dir);
  }
  return worktrees.get(ref);
}

try {
  const out = join(tmp, 'out');
  for (const step of plan) {
    const src = sourceFor(step.ref);
    const env = step.channel ? { VITE_KK_CHANNEL: step.channel } : {};
    console.log(`\n== ${step.name}: ${step.ref ?? 'голова'} → ${step.base}`);
    run('npx', ['vite', 'build', '--base', step.base, '--outDir', join(out, step.name), '--emptyOutDir'], src, env);
  }

  // Ворота: у каждой сборки есть index.html со ссылками под её base.
  for (const step of plan) {
    const html = join(out, step.name, 'index.html');
    if (!existsSync(html)) throw new Error(`${step.name}: нет index.html`);
    if (!readFileSync(html, 'utf8').includes(`"${step.base}assets/`)) {
      throw new Error(`${step.name}: index.html не ссылается на ${step.base}assets/`);
    }
  }
  const rootStep = plan.find((s) => s.name === 'root');
  for (const step of plan) {
    if (step.dir && existsSync(join(out, rootStep.name, step.dir))) {
      throw new Error(`корневая сборка уже содержит папку «${step.dir}»`);
    }
  }

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(join(out, rootStep.name), dist, { recursive: true });
  for (const step of plan) {
    if (step.dir) cpSync(join(out, step.name), join(dist, step.dir), { recursive: true });
  }
  console.log(`\ndist/ собран: ${readdirSync(dist).join(', ')}`);
} finally {
  for (const dir of worktrees.values()) {
    try {
      git(['worktree', 'remove', '--force', dir]);
    } catch {
      /* копию уберёт rmSync ниже */
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}
