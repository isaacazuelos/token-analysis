#!/usr/bin/env node
// token-density: measure token density of popular npm packages.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { buildCorpus, countInstalledPackages } from './corpus.js';
import { addFile, newAggregate, renderMarkdown, toJson } from './report.js';
import { cloneRepos, countClonedRepos, REPO_EXCLUDE_DIRS, REPO_TEST_DIRS } from './repos.js';
import { newScanStats, scanFiles } from './scan.js';
import { fetchTopPackages } from './top-packages.js';
import { tokenizeFile } from './tokenize.js';

const HELP = `token-density: report token density (tokens per byte) of popular npm code

Usage: node src/cli.js [options]

Options:
  -t, --top <n>           number of top packages to pull (default: 25)
  -p, --packages <list>   comma-separated package names (overrides --top)
      --repos             clone the packages' source repos and analyze those
                          instead of the published npm files
      --include-tests     repo mode: also scan test/fixture directories
      --workdir <dir>     where to install the corpus (default: corpus)
      --skip-install      reuse an existing corpus, don't touch the network
      --include-minified  tokenize minified files too (own report bucket)
      --include-dts       tokenize .d.ts files too (own report bucket)
      --max-file-bytes    skip files larger than this (default: 5000000)
      --out <file>        write the markdown report here (also printed)
      --json <file>       write raw aggregates as JSON here
  -h, --help              show this help
`;

function main() {
  const { values: args } = parseArgs({
    options: {
      top: { type: 'string', short: 't', default: '25' },
      packages: { type: 'string', short: 'p' },
      workdir: { type: 'string', default: 'corpus' },
      repos: { type: 'boolean', default: false },
      'include-tests': { type: 'boolean', default: false },
      'skip-install': { type: 'boolean', default: false },
      'include-minified': { type: 'boolean', default: false },
      'include-dts': { type: 'boolean', default: false },
      'max-file-bytes': { type: 'string', default: '5000000' },
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
  const workdir = path.resolve(args.workdir);

  run(args, workdir, log).catch((err) => {
    log(`error: ${err.message}`);
    process.exitCode = 1;
  });
}

async function run(args, workdir, log) {
  const mode = args.repos ? 'repos' : 'npm';
  const reposDir = path.join(workdir, 'repos');
  let requested = [];
  let failed = [];

  if (args['skip-install']) {
    log(`reusing existing corpus at ${workdir}/`);
  } else {
    if (args.packages) {
      requested = args.packages.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      const top = Number.parseInt(args.top, 10);
      if (!Number.isInteger(top) || top < 1) throw new Error(`--top must be a positive integer`);
      log(`fetching top ${top} packages from registry.npmjs.org ...`);
      const ranked = await fetchTopPackages(top, { log });
      requested = ranked.map((p) => p.name);
      log(`top packages by weekly downloads: ${requested.slice(0, 10).join(', ')}${requested.length > 10 ? ', ...' : ''}`);
    }
    if (mode === 'repos') {
      ({ failed } = await cloneRepos(reposDir, requested, { log }));
    } else {
      ({ failed } = buildCorpus(workdir, requested, { log }));
    }
  }

  const scanStats = newScanStats();
  const agg = newAggregate();
  const scanOpts = {
    maxFileBytes: Number.parseInt(args['max-file-bytes'], 10),
    includeMinified: args['include-minified'],
    includeDts: args['include-dts'],
    excludeDirs:
      mode === 'repos'
        ? new Set([...REPO_EXCLUDE_DIRS, ...(args['include-tests'] ? [] : REPO_TEST_DIRS)])
        : undefined,
  };

  const root = mode === 'repos' ? reposDir : path.join(workdir, 'node_modules');
  if (!fs.existsSync(root)) throw new Error(`no corpus at ${root}; run without --skip-install`);

  log('scanning and tokenizing ...');
  let processed = 0;
  for (const file of scanFiles(root, scanOpts, scanStats)) {
    try {
      addFile(agg, file, tokenizeFile(file.path, file.text));
    } catch {
      scanStats.parseFailures += 1;
    }
    processed += 1;
    if (processed % 2000 === 0) log(`  ${processed} files ...`);
  }
  if (agg.files === 0) throw new Error('no source files found in the corpus');
  log(`tokenized ${agg.files} files (${(agg.bytes / 1024 / 1024).toFixed(1)} MiB, ${agg.tokens.toLocaleString()} tokens)`);

  const meta = {
    date: new Date().toISOString().slice(0, 10),
    mode,
    requested,
    failed,
    packagesInTree: mode === 'repos' ? countClonedRepos(reposDir) : countInstalledPackages(workdir),
    scanStats,
    options: { ...scanOpts, excludeDirs: scanOpts.excludeDirs && [...scanOpts.excludeDirs] },
  };

  const markdown = renderMarkdown(agg, meta);
  process.stdout.write(markdown);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, markdown);
    log(`wrote ${args.out}`);
  }
  if (args.json) {
    fs.mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true });
    fs.writeFileSync(args.json, JSON.stringify(toJson(agg, meta), null, 2));
    log(`wrote ${args.json}`);
  }
}

main();
