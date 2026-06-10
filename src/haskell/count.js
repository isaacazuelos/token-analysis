// Walk extracted package trees, lex every .hs file, and aggregate
// operator-usage counts across the corpus.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { lexInfix } from './lex.js';

// Directories whose contents aren't representative library/application code.
export const TEST_DIRS = new Set([
  'test', 'tests', 'testsuite', 'Test', 'Tests',
  'bench', 'benchmark', 'benchmarks',
  'example', 'examples', 'demo',
]);

const SKIP_DIRS = new Set([
  '.git', 'dist', 'dist-newstyle', '.stack-work', 'vendor', 'node_modules',
]);

/** Yields `{ path, text, bytes }` for every .hs file under `dir`. */
export function* walkHsFiles(dir, { includeTests, maxFileBytes, stats }) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (!includeTests && TEST_DIRS.has(entry.name)) {
        stats.skippedTestDirs += 1;
        continue;
      }
      yield* walkHsFiles(full, { includeTests, maxFileBytes, stats });
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.lhs') || entry.name.endsWith('.hsc')) {
        stats.skippedLiterate += 1;
        continue;
      }
      if (!entry.name.endsWith('.hs')) continue;
      const bytes = fs.statSync(full).size;
      if (bytes > maxFileBytes) {
        stats.skippedLarge += 1;
        continue;
      }
      yield { path: full, text: fs.readFileSync(full, 'utf8'), bytes };
    }
  }
}

export function newCounts() {
  return {
    ops: new Map(), // name -> { count, pkgs: Set }
    backticks: new Map(),
    syntax: new Map(),
    files: 0,
    bytes: 0,
    packages: 0,
    stats: { skippedTestDirs: 0, skippedLiterate: 0, skippedLarge: 0, duplicates: 0 },
  };
}

function bump(map, name, pkg, by = 1) {
  let entry = map.get(name);
  if (!entry) {
    entry = { count: 0, byPkg: new Map() };
    map.set(name, entry);
  }
  entry.count += by;
  entry.byPkg.set(pkg, (entry.byPkg.get(pkg) ?? 0) + by);
}

/**
 * Lexes every .hs file of every package into `counts`. Files with identical
 * contents (vendored copies, ghc-lib vs ghc-lib-parser) are counted once.
 */
export function countPackages(counts, packages, { includeTests, maxFileBytes, log = () => {} }) {
  const seen = new Set();
  for (const pkg of packages) {
    counts.packages += 1;
    for (const file of walkHsFiles(pkg.dir, {
      includeTests,
      maxFileBytes,
      stats: counts.stats,
    })) {
      const hash = crypto.createHash('sha1').update(file.text).digest('base64');
      if (seen.has(hash)) {
        counts.stats.duplicates += 1;
        continue;
      }
      seen.add(hash);
      counts.files += 1;
      counts.bytes += file.bytes;
      for (const tok of lexInfix(file.text)) {
        if (tok.kind === 'op') bump(counts.ops, tok.name, pkg.name);
        else if (tok.kind === 'backtick') {
          // Single-letter infix names (`f`, `k`) are always local bindings;
          // they can't be meaningfully documented or ranked.
          if (tok.name.length > 1) bump(counts.backticks, tok.name, pkg.name);
        } else bump(counts.syntax, tok.name, pkg.name);
      }
      if (counts.files % 2000 === 0) log(`  ${counts.files} files ...`);
    }
  }
}

/** Top `n` entries of a counts map as `[{ name, count, pkgs, byPkg }]`. */
export function topEntries(map, n) {
  return [...map.entries()]
    .map(([name, e]) => ({ name, count: e.count, pkgs: e.byPkg.size, byPkg: e.byPkg }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n);
}
