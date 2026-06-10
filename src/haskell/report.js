// Render the operator-frequency report as markdown (and raw JSON).

import { topEntries } from './count.js';

// Reserved punctuation is language syntax with a fixed meaning; it has no
// term-level fixity, so it gets its own table with hardcoded descriptions.
const SYNTAX_MEANINGS = new Map([
  ['=', 'definition / binding'],
  ['->', 'function arrow: types, lambdas, and `case` alternatives'],
  ['<-', 'bind in `do`-notation, list comprehensions, and pattern guards'],
  ['::', 'type annotation ("has type")'],
  ['\\', 'lambda abstraction'],
  ['|', 'guards, `data` alternatives, comprehension separator'],
  ['=>', 'class-constraint arrow'],
  ['..', 'arithmetic ranges, record wildcards, `(..)` exports'],
  ['@', 'as-patterns; visible type application'],
  ['~', 'irrefutable (lazy) patterns; type-equality constraints'],
]);

// `|` breaks GFM table cells even inside code spans.
const cell = (s) => String(s).replace(/\|/g, '\\|');
const code = (s) => `\`${cell(s)}\``;
const pct = (x) => `${(100 * x).toFixed(2)}%`;

function fixityCell(info) {
  if (!info?.fixity) return 'infixl 9 †';
  const f = `${info.fixity.assoc} ${info.fixity.prec}`;
  return info.fixityVaries ? `${f} ‡` : f;
}

function meaningCell(info) {
  const doc = info?.doc;
  if (!doc) return '*(no signature found — possibly a data constructor or generated code)*';
  const sig = doc.sig ? `${code(doc.sig)}` : '';
  const text = doc.text ? cell(doc.text) : '*(no Haddock comment at definition)*';
  return sig ? `${sig} — ${text}` : text;
}

function definedInCell(info) {
  const doc = info?.doc;
  if (!doc) return '—';
  return `${doc.pkg} ${code(doc.module)}`;
}

function operatorTable(entries, totalUses, docs) {
  const lines = [
    '| # | Operator | Uses | Share | Pkgs | Fixity | Defined in | Meaning (per Hackage docs) |',
    '| ---: | --- | ---: | ---: | ---: | --- | --- | --- |',
  ];
  entries.forEach((e, idx) => {
    const info = docs.get(e.name);
    lines.push(
      `| ${idx + 1} | ${code(e.name)} | ${e.count.toLocaleString()} | ${pct(e.count / totalUses)} ` +
        `| ${e.pkgs} | ${fixityCell(info)} | ${definedInCell(info)} | ${meaningCell(info)} |`,
    );
  });
  return lines.join('\n');
}

export function renderMarkdown({ counts, opEntries, backtickEntries, docs, meta }) {
  const totalOps = [...counts.ops.values()].reduce((a, e) => a + e.count, 0);
  const totalTicks = [...counts.backticks.values()].reduce((a, e) => a + e.count, 0);
  const syntaxEntries = topEntries(counts.syntax, 99);
  const totalSyntax = syntaxEntries.reduce((a, e) => a + e.count, 0);
  const mib = (counts.bytes / 1024 / 1024).toFixed(1);

  const out = [];
  out.push(`# Most-used Haskell operators (top ${meta.requested.length} Hackage packages)`);
  out.push('');
  out.push(`Generated ${meta.date} by \`src/haskell/cli.js\`.`);
  out.push('');
  out.push(
    `Corpus: the ${meta.requested.length} most-downloaded packages on Hackage ` +
      `(30-day downloads, via \`/packages/top\`)` +
      (meta.failed.length ? `; ${meta.failed.length} failed to download (${meta.failed.join(', ')})` : '') +
      `. ${counts.files.toLocaleString()} unique \`.hs\` files, ${mib} MiB, ` +
      `${totalOps.toLocaleString()} symbolic-operator uses and ` +
      `${totalTicks.toLocaleString()} backtick-infix uses` +
      (meta.includeTests ? ' (test/bench/example directories included).' : ' (test/bench/example directories excluded).'),
  );
  out.push('');
  out.push(`Packages: ${meta.requested.join(', ')}.`);
  out.push('');
  out.push(
    'Meaning and fixity are harvested from the defining package’s source on Hackage — ' +
      'the `-- |` Haddock comment and `infix[lr] n op` declaration that Hackage’s rendered ' +
      'docs are generated from. When an operator’s uses are concentrated in a few packages, ' +
      'the definition from its heaviest user wins (a DSL’s `.==`); otherwise the canonical ' +
      `definition from ${meta.docPackages.join(', ')} is preferred.`,
  );
  out.push('');

  out.push(`## Symbolic operators (top ${opEntries.length} of ${counts.ops.size})`);
  out.push('');
  out.push('"Share" is of all symbolic-operator uses; "Pkgs" is how many corpus packages use it.');
  out.push('');
  out.push(operatorTable(opEntries, totalOps, docs));
  out.push('');
  out.push('† no fixity declaration found: Haskell defaults to `infixl 9`.');
  out.push('‡ different packages declare different fixities for this name; the defining package’s is shown.');
  out.push('');

  out.push(`## Backtick infix functions (top ${backtickEntries.length})`);
  out.push('');
  out.push(
    'Ordinary functions applied infix, as in ``x `div` y``. Counts cover only infix uses, ' +
      'not prefix calls, so these rank far below the symbolic operators.',
  );
  out.push('');
  out.push(operatorTable(backtickEntries, totalTicks, docs));
  out.push('');
  out.push('† no fixity declaration found: Haskell defaults to `infixl 9`.');
  out.push('');

  out.push('## Reserved syntax (for scale)');
  out.push('');
  out.push(
    'These are reserved punctuation, not operators — they have no fixity and cannot be ' +
      'redefined — but they share the same lexical grammar, so here are their counts for comparison.',
  );
  out.push('');
  out.push('| Token | Uses | Share | Meaning |');
  out.push('| --- | ---: | ---: | --- |');
  for (const e of syntaxEntries) {
    out.push(
      `| ${code(e.name)} | ${e.count.toLocaleString()} | ${pct(e.count / totalSyntax)} ` +
        `| ${SYNTAX_MEANINGS.get(e.name) ?? ''} |`,
    );
  }
  out.push('');

  out.push('## Caveats');
  out.push('');
  out.push('- Counts are raw token occurrences: export lists, fixity declarations, and');
  out.push('  definition sites count alongside ordinary uses.');
  out.push('- Prefix occurrences of `!`, `-`, and `$` are excluded using GHC’s whitespace');
  out.push('  rule (loose before, tight after): bang patterns and strictness annotations,');
  out.push('  negation, and Template Haskell splices don’t count as infix uses.');
  out.push('- `.` conflates function composition, `OverloadedRecordDot` field access,');
  out.push('  and the dot in `forall a. t`; module qualifiers (`Map.!`) are *not* counted.');
  out.push('- Identically-named operators from different packages are merged (`.=` is both');
  out.push('  aeson’s pair builder and lens’s state setter); the meaning shown is the');
  out.push('  highest-preference definition found, so check "Defined in".');
  out.push('- Generated code skews counts: a single package of machine-written FFI');
  out.push('  bindings can produce tens of thousands of uses of one function (see the');
  out.push('  "Pkgs" column for how widespread a name really is).');
  out.push('- Skipped: `.lhs`/`.hsc` files, CPP lines, quasiquote bodies, and');
  out.push(`  files over ${meta.maxFileBytes.toLocaleString()} bytes.`);
  out.push('');
  return out.join('\n');
}

export function toJson({ counts, opEntries, backtickEntries, docs, meta }) {
  const enrich = (e) => ({
    name: e.name,
    count: e.count,
    pkgs: e.pkgs,
    byPkg: Object.fromEntries(e.byPkg),
    fixity: docs.get(e.name)?.fixity ?? null,
    fixityVaries: docs.get(e.name)?.fixityVaries ?? false,
    doc: docs.get(e.name)?.doc ?? null,
  });
  return {
    meta,
    totals: {
      files: counts.files,
      bytes: counts.bytes,
      packages: counts.packages,
      distinctOperators: counts.ops.size,
      distinctBackticks: counts.backticks.size,
    },
    stats: counts.stats,
    operators: opEntries.map(enrich),
    backticks: backtickEntries.map(enrich),
    syntax: topEntries(counts.syntax, 99).map((e) => ({
      name: e.name,
      count: e.count,
      pkgs: e.pkgs,
    })),
  };
}
