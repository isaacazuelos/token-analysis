// Build the corpus: install the chosen packages into <workdir>/node_modules.
//
// Everything installs into one shared tree so packages that depend on each
// other share (and dedupe) their dependencies. Install scripts are disabled --
// we only want the published files, and running arbitrary postinstall scripts
// for dozens of packages is not worth it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const NPM_FLAGS = [
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  '--legacy-peer-deps',
  '--loglevel=error',
];

function npmInstall(cwd, packages) {
  execFileSync('npm', ['install', ...packages, ...NPM_FLAGS], {
    cwd,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

/**
 * Installs `packages` (names, latest versions) under `workdir`.
 * Returns `{ installed, failed }` lists of package names.
 */
export function buildCorpus(workdir, packages, { log = () => {} } = {}) {
  fs.mkdirSync(workdir, { recursive: true });
  const manifest = path.join(workdir, 'package.json');
  if (!fs.existsSync(manifest)) {
    fs.writeFileSync(manifest, JSON.stringify({ name: 'corpus', private: true }, null, 2));
  }

  const installed = [];
  const failed = [];

  log(`installing ${packages.length} packages into ${workdir}/ ...`);
  try {
    npmInstall(workdir, packages);
    installed.push(...packages);
  } catch {
    // A single conflicting package can sink the combined install; retry one
    // at a time so we keep everything that installs cleanly.
    log('combined install failed; retrying packages individually');
    for (const pkg of packages) {
      try {
        npmInstall(workdir, [pkg]);
        installed.push(pkg);
      } catch {
        log(`  skipping ${pkg}: install failed`);
        failed.push(pkg);
      }
    }
  }

  return { installed, failed };
}

/** Counts the distinct packages that ended up in the corpus tree. */
export function countInstalledPackages(workdir) {
  const root = path.join(workdir, 'node_modules');
  if (!fs.existsSync(root)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      count += fs.readdirSync(path.join(root, entry.name)).length;
    } else {
      count += 1;
    }
  }
  return count;
}
