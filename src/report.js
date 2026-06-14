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
    whitespace: { count: 0, chars: 0 },
    byClass: Object.fromEntries(
      FILE_CLASSES.map((c) => [c, { files: 0, bytes: 0, tokens: 0, nodes: 0 }]),
    ),
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, { count: 0, chars: 0 }])),
    kinds: new Map(),
    perFile: [], // [bytes, tokens, comments, whitespaceRuns] per file, for the distributions
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
  agg.whitespace.count += result.whitespace.count;
  agg.whitespace.chars += result.whitespace.chars;

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
  if (result.tokens > 0) {
    agg.perFile.push([file.bytes, result.tokens, result.comments.count, result.whitespace.count]);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

// Sorted ascending list of bytes-per-piece for a perFile column (1=tokens,
// 2=comments, 3=whitespace runs), skipping files with none of that piece so
// the ratio is defined. The low percentiles are the dense files that bind vec
// capacity: `capacity = bytes / N` reallocates on a file only when N exceeds
// that file's bytes-per-piece.
function perFileRatios(perFile, idx) {
  const out = [];
  for (const row of perFile) {
    if (row[idx] > 0) out.push(row[0] / row[idx]);
  }
  return out.sort((a, b) => a - b);
}

const DIST_PERCENTILES = [5, 10, 25, 50, 75, 90, 95];

function percentileObject(sorted) {
  return Object.fromEntries(DIST_PERCENTILES.map((p) => [`p${p}`, percentile(sorted, p)]));
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

// A p10..p90 row for a sorted bytes-per-piece distribution.
function distributionTable(sorted) {
  return table([
    ['p10', 'p25', 'p50 (median)', 'p75', 'p90'],
    [10, 25, 50, 75, 90].map((p) => fix(percentile(sorted, p))),
  ]);
}

export function renderMarkdown(agg, meta) {
  const stats = meta.scanStats;
  const bytesPerToken = perFileRatios(agg.perFile, 1);
  const bytesPerComment = perFileRatios(agg.perFile, 2);
  const bytesPerWhitespace = perFileRatios(agg.perFile, 3);
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
  lines.push(distributionTable(bytesPerToken));
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

  lines.push('## Trivia distribution');
  lines.push('');
  lines.push('Per-file bytes per trivia piece, for sizing comment / whitespace SoA vecs from');
  lines.push('input length the same way as the token vec (`capacity = bytes / N`; pick a low');
  lines.push('percentile to over-provision the dense files). A comment piece is one line of a');
  lines.push('comment (a K-line block comment counts as K); a whitespace piece is one');
  lines.push('contiguous run of spaces/tabs/newlines, which a comment splits.');
  lines.push('');
  const commentFiles = bytesPerComment.length;
  lines.push(
    `Comments — present in ${num(commentFiles)} of ${num(agg.perFile.length)} files ` +
      `(${pct(commentFiles, agg.perFile.length)}); bytes per comment line:`,
  );
  lines.push('');
  lines.push(distributionTable(bytesPerComment));
  lines.push('');
  lines.push('Whitespace — bytes per contiguous run:');
  lines.push('');
  lines.push(distributionTable(bytesPerWhitespace));
  lines.push('');
  lines.push('### Sizing guidance');
  lines.push('');
  lines.push(
    `- Comment vec: \`N = ${fix(percentile(bytesPerComment, 10))}\` (p10) over-provisions ` +
      '~90% of comment-bearing files. Files with no comments still reserve `bytes / N` and ' +
      'leave it empty — size from token count instead if that waste matters.',
  );
  lines.push(
    `- Whitespace vec: \`N = ${fix(percentile(bytesPerWhitespace, 10))}\` (p10) over-provisions ` +
      '~90% of files; whitespace is in nearly every file, so input-length sizing is safe.',
  );
  lines.push(
    `- Aggregate means: \`N = ${fix(agg.bytes / agg.comments.count)}\` bytes/comment-line, ` +
      `\`N = ${fix(agg.bytes / agg.whitespace.count)}\` bytes/whitespace-run.`,
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
  catRows.push([
    '*(trivia: comments)*',
    num(agg.comments.count),
    '–',
    num(agg.comments.chars),
    pct(agg.comments.chars, agg.chars),
  ]);
  catRows.push([
    '*(trivia: whitespace)*',
    num(agg.whitespace.count),
    '–',
    num(agg.whitespace.chars),
    pct(agg.whitespace.chars, agg.chars),
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
  const bytesPerToken = perFileRatios(agg.perFile, 1);
  const bytesPerComment = perFileRatios(agg.perFile, 2);
  const bytesPerWhitespace = perFileRatios(agg.perFile, 3);
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
    bytesPerTokenPercentiles: percentileObject(bytesPerToken),
    byClass: agg.byClass,
    categories: agg.categories,
    trivia: {
      comments: {
        ...agg.comments,
        filesWithComments: bytesPerComment.length,
        bytesPerCommentPercentiles: percentileObject(bytesPerComment),
      },
      whitespace: {
        ...agg.whitespace,
        bytesPerRunPercentiles: percentileObject(bytesPerWhitespace),
      },
    },
    kinds: Object.fromEntries(
      [...agg.kinds.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => [kindName(kind), count]),
    ),
  };
}
