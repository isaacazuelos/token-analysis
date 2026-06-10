// Hackage registry access: top-package ranking, version resolution, and
// source tarball download/extraction.
//
// Unlike npm, Hackage has a real popularity endpoint: `/packages/top` returns
// every package with its recent (30-day) download count, sorted. Tarballs are
// served from hackage.haskell.org directly; the rendered-docs host
// (hackage-content.haskell.org) is a separate origin we never need, since
// docs and fixity are harvested from the source files themselves.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HACKAGE = 'https://hackage.haskell.org';

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  return res.json();
}

/** Top `n` packages by recent downloads: `[{ name, downloads }]`, best first. */
export async function fetchTopPackages(n) {
  const all = await getJson(`${HACKAGE}/packages/top`);
  return all
    .slice(0, n)
    .map((p) => ({ name: p.packageName, downloads: p.downloads }));
}

async function latestVersion(name) {
  const body = await getJson(`${HACKAGE}/package/${name}/preferred`);
  const versions = body['normal-version'];
  if (!versions?.length) throw new Error(`no versions for ${name}`);
  return versions[0];
}

/** Finds an already-extracted `name-<version>` directory, if any. */
export function findExtracted(dir, name) {
  if (!fs.existsSync(dir)) return undefined;
  for (const entry of fs.readdirSync(dir)) {
    const m = /^(.*)-\d[\d.]*$/.exec(entry);
    if (m && m[1] === name && fs.statSync(path.join(dir, entry)).isDirectory()) {
      return path.join(dir, entry);
    }
  }
  return undefined;
}

async function downloadOne(dir, name) {
  const existing = findExtracted(dir, name);
  if (existing) return { name, dir: existing, cached: true };

  const version = await latestVersion(name);
  const id = `${name}-${version}`;
  const url = `${HACKAGE}/package/${id}/${id}.tar.gz`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tarball for ${id}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const tarPath = path.join(dir, `${id}.tar.gz`);
  fs.writeFileSync(tarPath, buf);
  const tar = spawnSync('tar', ['-xzf', tarPath, '-C', dir], { stdio: 'pipe' });
  fs.rmSync(tarPath);
  if (tar.status !== 0) {
    throw new Error(`tar failed for ${id}: ${tar.stderr?.toString().trim()}`);
  }
  if (!fs.existsSync(path.join(dir, id))) {
    throw new Error(`tarball for ${id} did not extract to ${id}/`);
  }
  return { name, dir: path.join(dir, id), cached: false };
}

/**
 * Downloads and extracts packages into `dir` (skipping any already there),
 * a few at a time. Returns `{ packages: [{ name, dir }], failed: [name] }`.
 */
export async function downloadPackages(dir, names, { log = () => {}, concurrency = 4 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const queue = [...names];
  const packages = [];
  const failed = [];

  async function worker() {
    for (;;) {
      const name = queue.shift();
      if (!name) return;
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const result = await downloadOne(dir, name);
          packages.push(result);
          log(`  ${name} ${result.cached ? '(cached)' : ''}`);
          lastErr = undefined;
          break;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      if (lastErr) {
        failed.push(name);
        log(`  ${name} FAILED: ${lastErr.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  // Preserve the requested (popularity) order.
  const byName = new Map(packages.map((p) => [p.name, p]));
  return { packages: names.map((n) => byName.get(n)).filter(Boolean), failed };
}
