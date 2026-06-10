// Walk the corpus and yield the source files worth tokenizing.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.jsx']);
const TS_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx']);

/** File classes used throughout the report. */
export const FILE_CLASSES = ['js', 'ts', 'dts', 'minified'];

function classify(filePath, text) {
  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(base);
  if (/\.d\.(ts|mts|cts)$/.test(base)) return 'dts';
  if (TS_EXTENSIONS.has(ext)) return 'ts';
  if (!JS_EXTENSIONS.has(ext)) return null;
  return looksMinified(base, text) ? 'minified' : 'js';
}

// Minified/bundled-and-compressed code has wildly different density (no
// whitespace, single-letter identifiers) than code humans write, so it gets
// its own bucket. Heuristic: a ".min." name, or long average line length.
function looksMinified(basename, text) {
  if (basename.includes('.min.')) return true;
  const sample = text.length > 50_000 ? text.slice(0, 50_000) : text;
  const lines = sample.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return false;
  const avg = nonEmpty.reduce((sum, l) => sum + l.length, 0) / nonEmpty.length;
  return avg > 250;
}

function* walk(dir, excludeDirs) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue; // .bin/ links, avoid double counting
    if (entry.isDirectory()) {
      if (excludeDirs?.has(entry.name)) continue;
      yield* walk(full, excludeDirs);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * Yields `{ path, class, bytes, text }` for every scannable source file under
 * `root`, skipping exact-duplicate file contents (the same file is often
 * published by several packages).
 *
 * `stats` is mutated with counts of what was skipped and why.
 */
export function* scanFiles(root, { maxFileBytes, includeMinified, includeDts, excludeDirs }, stats) {
  const seenHashes = new Set();

  for (const filePath of walk(root, excludeDirs)) {
    const ext = path.extname(filePath).toLowerCase();
    if (!JS_EXTENSIONS.has(ext) && !TS_EXTENSIONS.has(ext)) continue;

    const bytes = fs.statSync(filePath).size;
    if (bytes === 0) continue;
    if (bytes > maxFileBytes) {
      stats.skippedTooLarge.files += 1;
      stats.skippedTooLarge.bytes += bytes;
      continue;
    }

    const buf = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha1').update(buf).digest('base64');
    if (seenHashes.has(hash)) {
      stats.skippedDuplicate.files += 1;
      stats.skippedDuplicate.bytes += bytes;
      continue;
    }
    seenHashes.add(hash);

    const text = buf.toString('utf8');
    const fileClass = classify(filePath, text);
    if (fileClass === null) continue;
    if (fileClass === 'minified' && !includeMinified) {
      stats.skippedMinified.files += 1;
      stats.skippedMinified.bytes += bytes;
      continue;
    }
    if (fileClass === 'dts' && !includeDts) {
      stats.skippedDts.files += 1;
      stats.skippedDts.bytes += bytes;
      continue;
    }

    yield { path: filePath, class: fileClass, bytes, text };
  }
}

export function newScanStats() {
  return {
    skippedTooLarge: { files: 0, bytes: 0 },
    skippedDuplicate: { files: 0, bytes: 0 },
    skippedMinified: { files: 0, bytes: 0 },
    skippedDts: { files: 0, bytes: 0 },
    parseFailures: 0,
  };
}
