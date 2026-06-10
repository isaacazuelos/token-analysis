// Discover the most-downloaded npm packages.
//
// There is no official "top N packages" registry endpoint, so we approximate:
// the search API (`/-/v1/search`) returns weekly download counts and can be
// sorted by popularity, but requires a text query. We run several broad
// keyword queries, merge the results, and rank the union by weekly downloads.
// This reliably surfaces the usual suspects (tslib, lodash, react, chalk, ...).

const SEARCH_KEYWORDS = [
  'javascript',
  'nodejs',
  'node',
  'typescript',
  'util',
  'cli',
  'react',
  'http',
  'json',
  'parser',
  'string',
  'array',
  'promise',
  'stream',
  'async',
  'fs',
  'es6',
  'browser',
];

const REGISTRY = 'https://registry.npmjs.org';

async function searchByKeyword(keyword, size) {
  const url =
    `${REGISTRY}/-/v1/search?text=${encodeURIComponent(`keywords:${keyword}`)}` +
    `&popularity=1.0&quality=0.0&maintenance=0.0&size=${size}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`registry search for "${keyword}" failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  return body.objects ?? [];
}

/**
 * Returns the top `n` packages by weekly downloads, as
 * `[{ name, weeklyDownloads }]`, best first.
 *
 * `@types/*` packages are excluded: they contain only declaration files, so
 * they would skew a corpus meant to represent runtime code. Pass them via
 * `--packages` explicitly if you want them.
 */
export async function fetchTopPackages(n, { log = () => {} } = {}) {
  const perQuery = Math.min(250, Math.max(50, n * 3));
  const byName = new Map();

  const results = await Promise.allSettled(
    SEARCH_KEYWORDS.map((kw) => searchByKeyword(kw, perQuery)),
  );

  let failures = 0;
  for (const result of results) {
    if (result.status === 'rejected') {
      failures += 1;
      continue;
    }
    for (const obj of result.value) {
      const name = obj.package?.name;
      const weekly = obj.downloads?.weekly ?? 0;
      if (!name || name.startsWith('@types/')) continue;
      const existing = byName.get(name);
      if (!existing || weekly > existing.weeklyDownloads) {
        byName.set(name, { name, weeklyDownloads: weekly });
      }
    }
  }

  if (failures === SEARCH_KEYWORDS.length) {
    throw new Error('all registry searches failed; check network access to registry.npmjs.org');
  }
  if (failures > 0) {
    log(`warning: ${failures}/${SEARCH_KEYWORDS.length} registry searches failed; ranking from the rest`);
  }

  return [...byName.values()]
    .sort((a, b) => b.weeklyDownloads - a.weeklyDownloads)
    .slice(0, n);
}
