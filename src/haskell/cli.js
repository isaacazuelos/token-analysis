#!/usr/bin/env node
// haskell-operators: rank operator usage in popular Hackage packages, with
// each operator's meaning (from its Haddock docs) and fixity.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { countPackages, newCounts, topEntries } from './count.js';
import { downloadPackages, fetchTopPackages, findExtracted } from './hackage.js';
import { harvestDocs } from './harvest.js';
import { renderMarkdown, toJson } from './report.js';

// Searched first when resolving an operator's defining package: most common
// operators live in base/ghc-prim, and these ship canonical docs + fixity.
const DEFAULT_DOC_PACKAGES = [
  // ghc-internal before base: since GHC 9.10, base is largely a re-export
  // shim, so the Prelude operators' real definitions (and Haddock comments)
  // live in ghc-internal.
  'ghc-internal', 'base', 'ghc-prim', 'containers', 'bytestring', 'text',
  'filepath', 'transformers', 'mtl', 'pretty', 'aeson', 'lens', 'vector',
];

const HELP = `haskell-operators: most-used operators in popular Hackage packages,
with meaning (per Hackage docs) and fixity.

Usage: node src/haskell/cli.js [options]

Options:
  -t, --top <n>           number of top packages to pull (default: 30)
  -p, --packages <list>   comma-separated package names (overrides --top)
      --operators <n>     symbolic operators to list (default: 40)
      --backticks <n>     backtick infix functions to list (default: 15)
      --doc-packages <l>  extra packages searched (first) for docs/fixity
                          (default: ${DEFAULT_DOC_PACKAGES.join(',')})
      --workdir <dir>     corpus location (default: corpus-haskell)
      --skip-download     reuse the existing corpus, don't touch the network
      --include-tests     also count test/bench/example directories
      --max-file-bytes    skip files larger than this (default: 2000000)
      --out <file>        write the markdown report here (also printed)
      --json <file>       write raw counts and docs as JSON here
  -h, --help              show this help
`;

function main() {
  const { values: args } = parseArgs({
    options: {
      top: { type: 'string', short: 't', default: '30' },
      packages: { type: 'string', short: 'p' },
      operators: { type: 'string', default: '40' },
      backticks: { type: 'string', default: '15' },
      'doc-packages': { type: 'string', default: DEFAULT_DOC_PACKAGES.join(',') },
      workdir: { type: 'string', default: 'corpus-haskell' },
      'skip-download': { type: 'boolean', default: false },
      'include-tests': { type: 'boolean', default: false },
      'max-file-bytes': { type: 'string', default: '2000000' },
      out: { type: 'string' },
      json: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const log = (msg) => process.stderr.write(`${msg}\n`);
  run(args, log).catch((err) => {
    log(`error: ${err.message}`);
    process.exitCode = 1;
  });
}

function intArg(args, name, min = 1) {
  const v = Number.parseInt(args[name], 10);
  if (!Number.isInteger(v) || v < min) throw new Error(`--${name} must be an integer >= ${min}`);
  return v;
}

function extractedPackages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((e) => fs.statSync(path.join(dir, e)).isDirectory())
    .map((e) => ({ name: e.replace(/-\d[\d.]*$/, ''), dir: path.join(dir, e) }));
}

async function run(args, log) {
  const workdir = path.resolve(args.workdir);
  const corpusDir = path.join(workdir, 'packages');
  const docsDir = path.join(workdir, 'docs');
  const maxFileBytes = intArg(args, 'max-file-bytes');
  const docPackageNames = args['doc-packages'].split(',').map((s) => s.trim()).filter(Boolean);

  let requested;
  let failed = [];
  let corpus;
  let docPackages;

  if (args['skip-download']) {
    log(`reusing existing corpus at ${corpusDir}/`);
    corpus = extractedPackages(corpusDir);
    if (corpus.length === 0) throw new Error(`no corpus at ${corpusDir}; run without --skip-download`);
    requested = corpus.map((p) => p.name);
    docPackages = extractedPackages(docsDir);
  } else {
    if (args.packages) {
      requested = args.packages.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      const top = intArg(args, 'top');
      log(`fetching top ${top} packages from hackage.haskell.org ...`);
      const ranked = await fetchTopPackages(top);
      requested = ranked.map((p) => p.name);
      log(`top packages by 30-day downloads: ${requested.slice(0, 10).join(', ')}${requested.length > 10 ? ', ...' : ''}`);
    }

    log(`downloading ${requested.length} package tarballs ...`);
    ({ packages: corpus, failed } = await downloadPackages(corpusDir, requested, { log }));

    // Doc packages already in the corpus are reused from there; the rest go
    // into their own directory so they don't pollute the usage counts.
    const extraDocs = docPackageNames.filter(
      (name) => !corpus.some((p) => p.name === name) && !findExtracted(docsDir, name),
    );
    if (extraDocs.length) {
      log(`downloading ${extraDocs.length} doc packages (${extraDocs.join(', ')}) ...`);
      const { failed: docFailed } = await downloadPackages(docsDir, extraDocs, { log });
      if (docFailed.length) log(`warning: doc packages failed: ${docFailed.join(', ')}`);
    }
    docPackages = extractedPackages(docsDir);
  }

  log('lexing corpus ...');
  const counts = newCounts();
  countPackages(counts, corpus, { includeTests: args['include-tests'], maxFileBytes, log });
  if (counts.files === 0) throw new Error('no .hs files found in the corpus');
  log(
    `lexed ${counts.files.toLocaleString()} files (${(counts.bytes / 1024 / 1024).toFixed(1)} MiB), ` +
      `${counts.ops.size.toLocaleString()} distinct operators`,
  );

  const opEntries = topEntries(counts.ops, intArg(args, 'operators'));
  const backtickEntries = topEntries(counts.backticks, intArg(args, 'backticks'));

  // Search order for definitions: doc packages as listed, then the corpus by
  // popularity (skipping corpus copies of doc packages so base stays first).
  const docOrder = new Map(docPackageNames.map((name, i) => [name, i]));
  const searchList = [
    ...docPackageNames
      .map((name) => corpus.find((p) => p.name === name) ?? docPackages.find((p) => p.name === name))
      .filter(Boolean),
    ...corpus.filter((p) => !docOrder.has(p.name)),
  ];

  log('harvesting docs and fixity from defining packages ...');
  const wantedEntries = [...opEntries, ...backtickEntries];
  const docs = harvestDocs(new Set(wantedEntries.map((e) => e.name)), searchList, {
    usage: new Map(wantedEntries.map((e) => [e.name, e])),
    docPkgNames: docPackageNames,
    corpusSize: corpus.length,
    maxFileBytes,
    log,
  });

  const meta = {
    date: new Date().toISOString().slice(0, 10),
    requested,
    failed,
    docPackages: docPackageNames,
    includeTests: args['include-tests'],
    maxFileBytes,
  };

  const report = { counts, opEntries, backtickEntries, docs, meta };
  const markdown = renderMarkdown(report);
  process.stdout.write(markdown);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, markdown);
    log(`wrote ${args.out}`);
  }
  if (args.json) {
    fs.mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true });
    fs.writeFileSync(args.json, JSON.stringify(toJson(report), null, 2));
    log(`wrote ${args.json}`);
  }
}

main();
