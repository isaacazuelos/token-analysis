// Aggregate per-file token stats and render the report.

import { FILE_CLASSES } from './scan.js';
import { CATEGORIES, kindName } from './tokenize.js';

export function newAggregate() {
  return {
    files: 0,
    bytes: 0,
    chars: 0,
    tokens: 0,
    nodes: 0,
    tokenChars: 0,
    comments: { count: 0, chars: 0 },
    byClass: Object.fromEntries(
      FILE_CLASSES.map((c) => [c, { files: 0, bytes: 0, tokens: 0, nodes: 0 }]),
    ),
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, { count: 0, chars: 0 }])),
    kinds: new Map(),
    perFile: [], // [bytes, tokens] per file, for the distribution
  };
}

export function addFile(agg, file, result) {
  agg.files += 1;
  agg.bytes += file.bytes;
  agg.chars += result.chars;
  agg.tokens += result.tokens;
  agg.nodes += result.nodes;
  agg.tokenChars += result.tokenChars;
  agg.comments.count += result.comments.count;
  agg.comments.chars += result.comments.chars;

  const cls = agg.byClass[file.class];
  cls.files += 1;
  cls.bytes += file.bytes;
  cls.tokens += result.tokens;
  cls.nodes += result.nodes;

  for (const cat of CATEGORIES) {
    agg.categories[cat].count += result.categories[cat].count;
    agg.categories[cat].chars += result.categories[cat].chars;
  }
  for (const [kind, count] of result.kinds) {
    agg.kinds.set(kind, (agg.kinds.get(kind) ?? 0) + count);
  }
  if (result.tokens > 0) agg.perFile.push([file.bytes, result.tokens]);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const num = (n) => n.toLocaleString('en-US');
const fix = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '–');
const pct = (n, total) => (total > 0 ? `${((100 * n) / total).toFixed(1)}%` : '–');
const mb = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MiB` : `${(n / 1024).toFixed(1)} KiB`;

function table(rows) {
  const header = rows[0].map(String);
  const sep = header.map(() => '---');
  return [header, sep, ...rows.slice(1).map((r) => r.map(String))]
    .map((r) => `| ${r.join(' | ')} |`)
    .join('\n');
}

export function renderMarkdown(agg, meta) {
  const stats = meta.scanStats;
  const bytesPerToken = agg.perFile.map(([b, t]) => b / t).sort((a, b) => a - b);
  const lines = [];

  const repoMode = meta.mode === 'repos';
  lines.push('# Token density report');
  lines.push('');
  if (repoMode) {
    lines.push(`Generated ${meta.date} from the source repositories of top npm packages`);
    lines.push('(hand-written code, build-output directories excluded), as a proxy corpus');
    lines.push('for modern JavaScript/TypeScript.');
  } else {
    lines.push(`Generated ${meta.date} from the published files of npm packages and their`);
    lines.push('dependencies, as a proxy corpus for modern JavaScript/TypeScript.');
  }
  lines.push('');
  if (meta.requested.length > 0) {
    lines.push(`- Requested packages (${meta.requested.length}): ${meta.requested.join(', ')}`);
  } else {
    lines.push('- Reused an existing corpus (`--skip-install`)');
  }
  if (meta.failed.length > 0) {
    lines.push(`- ${repoMode ? 'No repo found / clone failed' : 'Failed to install'}: ${meta.failed.join(', ')}`);
  }
  if (repoMode) {
    lines.push(`- Repositories cloned (monorepos deduped): ${num(meta.packagesInTree)}`);
  } else {
    lines.push(`- Packages in corpus tree (incl. dependencies): ${num(meta.packagesInTree)}`);
  }
  lines.push('');

  lines.push('## Headline numbers');
  lines.push('');
  lines.push('Byte counts are raw input size (whitespace, comments, and all), so these');
  lines.push('ratios apply directly to an input string’s length.');
  lines.push('');
  lines.push(`- **Tokens per byte: ${fix(agg.tokens / agg.bytes, 4)}**`);
  lines.push(`- **Bytes per token: ${fix(agg.bytes / agg.tokens)}**`);
  lines.push(`- Tokens per KiB: ${fix((agg.tokens / agg.bytes) * 1024, 1)}`);
  lines.push(`- AST nodes per token: ${fix(agg.nodes / agg.tokens)} (TypeScript CST granularity)`);
  lines.push('');
  lines.push('Per-file distribution of bytes per token:');
  lines.push('');
  lines.push(
    table([
      ['p10', 'p25', 'p50 (median)', 'p75', 'p90'],
      [10, 25, 50, 75, 90].map((p) => fix(percentile(bytesPerToken, p))),
    ].map((r, i) => (i === 0 ? r : r))),
  );
  lines.push('');
  lines.push('### Sizing guidance');
  lines.push('');
  lines.push('For a scanner token vec sized from input length, `capacity = bytes / N`:');
  lines.push('');
  lines.push(
    `- \`N = ${fix(agg.bytes / agg.tokens)}\` (aggregate mean) right-sizes the typical case.`,
  );
  lines.push(
    `- \`N = ${fix(percentile(bytesPerToken, 10))}\` (p10 file) over-provisions enough that ~90% of files never reallocate.`,
  );
  lines.push(
    `- For parser SoA vecs, multiply token capacity by ~${fix(agg.nodes / agg.tokens)} ` +
      '(AST nodes per token), adjusted for how granular your AST is relative to TypeScript’s.',
  );
  lines.push('');

  lines.push('## Corpus');
  lines.push('');
  lines.push(
    table([
      ['', 'Files', 'Size'],
      ['Tokenized', num(agg.files), mb(agg.bytes)],
      ['Skipped: exact duplicates', num(stats.skippedDuplicate.files), mb(stats.skippedDuplicate.bytes)],
      ['Skipped: minified', num(stats.skippedMinified.files), mb(stats.skippedMinified.bytes)],
      ['Skipped: .d.ts', num(stats.skippedDts.files), mb(stats.skippedDts.bytes)],
      ['Skipped: over size limit', num(stats.skippedTooLarge.files), mb(stats.skippedTooLarge.bytes)],
    ]),
  );
  lines.push('');

  lines.push('## By file class');
  lines.push('');
  const classRows = [['Class', 'Files', 'Size', 'Tokens', 'Bytes/token', 'Tokens/KiB']];
  for (const cls of FILE_CLASSES) {
    const c = agg.byClass[cls];
    if (c.files === 0) continue;
    classRows.push([
      cls,
      num(c.files),
      mb(c.bytes),
      num(c.tokens),
      fix(c.bytes / c.tokens),
      fix((c.tokens / c.bytes) * 1024, 1),
    ]);
  }
  lines.push(table(classRows));
  lines.push('');

  lines.push('## Token type breakdown');
  lines.push('');
  const catRows = [['Category', 'Count', '% of tokens', 'Chars', '% of source text']];
  for (const cat of CATEGORIES) {
    const c = agg.categories[cat];
    if (c.count === 0) continue;
    catRows.push([cat, num(c.count), pct(c.count, agg.tokens), num(c.chars), pct(c.chars, agg.chars)]);
  }
  const trivia = agg.chars - agg.tokenChars;
  catRows.push([
    '*(trivia: comments)*',
    num(agg.comments.count),
    '–',
    num(agg.comments.chars),
    pct(agg.comments.chars, agg.chars),
  ]);
  catRows.push([
    '*(trivia: whitespace)*',
    '–',
    '–',
    num(trivia - agg.comments.chars),
    pct(trivia - agg.comments.chars, agg.chars),
  ]);
  lines.push(table(catRows));
  lines.push('');

  lines.push('## Most common token kinds');
  lines.push('');
  const topKinds = [...agg.kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  lines.push(
    table([
      ['Token', 'Count', '% of tokens'],
      ...topKinds.map(([kind, count]) => [
        `\`${kindName(kind)}\``,
        num(count),
        pct(count, agg.tokens),
      ]),
    ]),
  );
  lines.push('');

  lines.push('## Caveats');
  lines.push('');
  if (repoMode) {
    lines.push('- Repos include tests and fixtures alongside the shipping source; common');
    lines.push('  build-output directories (dist, build, vendor, ...) are skipped, but any');
    lines.push('  committed generated code outside those is still counted.');
  } else {
    lines.push('- Published npm files skew toward compiled/bundled output, which is denser');
    lines.push('  than hand-written source. Minified files are bucketed separately (excluded');
    lines.push('  by default) to limit this, but transpiled output remains.');
  }
  lines.push('- Tokenization follows TypeScript’s grammar; comments and whitespace are');
  lines.push('  trivia, not tokens. If your scanner emits comment tokens, add the comment');
  lines.push('  count to the token totals.');
  lines.push('- Char counts are UTF-16 code units; byte counts are file sizes. The corpus');
  lines.push('  is overwhelmingly ASCII, so the two are nearly interchangeable.');
  if (stats.parseFailures > 0) {
    lines.push(`- ${stats.parseFailures} file(s) failed to parse and were skipped.`);
  }
  lines.push('');

  return lines.join('\n');
}

export function toJson(agg, meta) {
  const bytesPerToken = agg.perFile.map(([b, t]) => b / t).sort((a, b) => a - b);
  return {
    meta,
    totals: {
      files: agg.files,
      bytes: agg.bytes,
      chars: agg.chars,
      tokens: agg.tokens,
      astNodes: agg.nodes,
      tokensPerByte: agg.tokens / agg.bytes,
      bytesPerToken: agg.bytes / agg.tokens,
      nodesPerToken: agg.nodes / agg.tokens,
    },
    bytesPerTokenPercentiles: Object.fromEntries(
      [5, 10, 25, 50, 75, 90, 95].map((p) => [`p${p}`, percentile(bytesPerToken, p)]),
    ),
    byClass: agg.byClass,
    categories: agg.categories,
    trivia: {
      comments: agg.comments,
      whitespaceChars: agg.chars - agg.tokenChars - agg.comments.chars,
    },
    kinds: Object.fromEntries(
      [...agg.kinds.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => [kindName(kind), count]),
    ),
  };
}
