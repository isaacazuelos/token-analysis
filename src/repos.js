// Repo mode: clone the upstream source repositories of the chosen packages
// instead of analyzing their published (often transpiled/bundled) npm files.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REGISTRY = 'https://registry.npmjs.org';

// Normalize the registry `repository.url` zoo to something `git clone` takes.
function normalizeRepoUrl(url) {
  if (!url) return null;
  let u = url.trim();
  if (u.startsWith('git+')) u = u.slice(4);
  u = u.replace(/^git:\/\//, 'https://');
  u = u.replace(/^ssh:\/\/git@/, 'https://');
  u = u.replace(/^git@([^:]+):/, 'https://$1/');
  if (/^[\w.-]+\/[\w.-]+$/.test(u)) u = `https://github.com/${u}`; // "owner/repo"
  if (u.startsWith('github:')) u = `https://github.com/${u.slice(7)}`;
  if (!u.startsWith('https://')) return null;
  return u.replace(/\.git$/, '');
}

async function fetchRepoUrl(pkg) {
  const res = await fetch(`${REGISTRY}/${encodeURIComponent(pkg)}/latest`);
  if (!res.ok) return null;
  const body = await res.json();
  const repo = body.repository;
  return normalizeRepoUrl(typeof repo === 'string' ? repo : repo?.url);
}

/**
 * Resolves the source repos for `packages` and shallow-clones each unique one
 * into `<reposDir>/<owner>__<name>`. Several packages often share a monorepo;
 * those are cloned once. Returns `{ cloned, reused, failed }` where `failed`
 * lists packages with no resolvable repo or a failed clone.
 */
export async function cloneRepos(reposDir, packages, { log = () => {} } = {}) {
  fs.mkdirSync(reposDir, { recursive: true });

  const urls = await Promise.all(packages.map((pkg) => fetchRepoUrl(pkg)));
  const byUrl = new Map(); // url -> packages that live there
  const failed = [];
  packages.forEach((pkg, i) => {
    if (urls[i]) {
      byUrl.set(urls[i], [...(byUrl.get(urls[i]) ?? []), pkg]);
    } else {
      log(`  skipping ${pkg}: no usable repository URL in the registry`);
      failed.push(pkg);
    }
  });

  log(`cloning ${byUrl.size} unique repos for ${packages.length} packages into ${reposDir}/ ...`);
  const cloned = [];
  const reused = [];
  for (const [url, pkgs] of byUrl) {
    const dirName = url.split('/').slice(-2).join('__').replace(/[^\w.-]/g, '_');
    const dest = path.join(reposDir, dirName);
    if (fs.existsSync(dest)) {
      reused.push(url);
      continue;
    }
    try {
      execFileSync(
        'git',
        ['clone', '--depth', '1', '--single-branch', '--no-tags', '--quiet', url, dest],
        { stdio: ['ignore', 'ignore', 'inherit'], timeout: 300_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      );
      cloned.push(url);
    } catch {
      log(`  skipping ${url}: clone failed`);
      failed.push(...pkgs);
    }
  }
  return { cloned, reused, failed };
}

/** Directories that hold generated or third-party code rather than source. */
export const REPO_EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'output',
  'vendor',
  'coverage',
  '.next',
  '.yarn',
]);

/**
 * Test and fixture directories. Excluded by default in repo mode: compiler
 * repos (TypeScript, babel) carry tens of thousands of tiny, intentionally
 * weird fixture files that would otherwise dominate the corpus.
 */
export const REPO_TEST_DIRS = new Set([
  'test',
  'tests',
  '__tests__',
  'fixtures',
  '__fixtures__',
  '__mocks__',
  'testdata',
  'test262',
]);

export function countClonedRepos(reposDir) {
  if (!fs.existsSync(reposDir)) return 0;
  return fs.readdirSync(reposDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
}
