# Token Analysis

I had Claude Fable 5.0 build this to answer a question I had working on my own
language and parser. Everything after this sentence is AI-generated.

A tool to see some facts about token density: it measures **tokens per byte**
of real-world JavaScript/TypeScript, as a proxy corpus for sizing
scanner/parser SoA vec capacities (`capacity ≈ source_bytes / bytes_per_token`)
in a new language without a corpus of its own.

"Per byte" means per byte of raw input — file size on disk, including
whitespace, comments, and everything else the scanner skips — so the ratios
can be applied directly to an input string's length.

It pulls the most-downloaded npm packages, installs them (and their
dependencies) into a local `corpus/` directory, tokenizes every `.js`/`.ts`
file with the TypeScript compiler, and prints a markdown report with the
density numbers plus a breakdown by token type.

## Usage

```sh
npm install

# Top 25 packages (default), report to stdout:
node src/cli.js

# More packages, save the report and raw numbers:
node src/cli.js --top 50 --out reports/top-50.md --json reports/top-50.json

# A corpus of your choosing:
node src/cli.js --packages react,typescript,lodash,express

# Clone the packages' source repos instead of using the published npm files
# (hand-written source rather than transpiled/bundled output):
node src/cli.js --repos --top 100 --out reports/top-100-repos.md

# Re-run analysis on an already-downloaded corpus (no network):
node src/cli.js --skip-install --include-dts
```

Options:

| Flag | Default | Meaning |
| --- | --- | --- |
| `-t, --top <n>` | 25 | how many top packages to pull |
| `-p, --packages <a,b>` | – | explicit package list instead of `--top` |
| `--repos` | off | clone source repos instead of installing npm files |
| `--workdir <dir>` | `corpus` | where the corpus is installed |
| `--skip-install` | off | reuse the existing corpus, no network |
| `--include-minified` | off | tokenize minified files (own report bucket) |
| `--include-dts` | off | tokenize `.d.ts` files (own report bucket) |
| `--max-file-bytes <n>` | 5000000 | skip files larger than this |
| `--out <file>` / `--json <file>` | – | write the report / raw aggregates |

Sample reports are checked in at [`reports/top-25.md`](reports/top-25.md),
[`reports/top-100.md`](reports/top-100.md) (published npm files), and
[`reports/top-100-repos.md`](reports/top-100-repos.md) (cloned source repos).

## How it works

- **Package selection** — there is no official "top packages" endpoint, so we
  run a handful of broad keyword queries against the npm registry search API
  (which reports weekly downloads), merge the results, and rank by downloads.
  `@types/*` packages are excluded from auto-selection since they contain no
  runtime code.
- **Corpus** — everything is installed into one shared `node_modules` with
  `--ignore-scripts`, so common dependencies are deduped and no third-party
  install scripts run. Files with identical contents (the same module
  published in several packages) are counted once.
- **Repo mode** (`--repos`) — instead of the published files, each package's
  `repository.url` is resolved from the registry and shallow-cloned (monorepos
  hosting several packages are cloned once). This measures hand-written source
  rather than transpiled/bundled output; `.git`, `node_modules`, and common
  build-output directories (`dist`, `build`, `vendor`, ...) are skipped.
  Test/fixture directories are skipped too unless `--include-tests` is given:
  compiler repos (TypeScript, babel) carry tens of thousands of intentionally
  weird fixture files that would otherwise dominate the corpus.
- **Tokenization** — files are parsed with the TypeScript compiler and the
  concrete syntax tree is walked down to its token leaves. A full parse (vs.
  running the scanner directly) keeps context-sensitive tokens correct: regex
  vs. division, template literals, JSX. The parse tree also yields an
  **AST nodes per token** ratio, useful for sizing parser-side vecs.
- **Buckets** — minified files (`.min.` in the name, or very long average
  lines) and `.d.ts` declarations have very different density from
  hand-written code, so they're excluded from the headline numbers by default
  and reported as their own file classes when included.

## Caveats

- npm packages ship compiled/bundled output more often than pristine source,
  which is somewhat denser than what a human types. Treat the headline number
  as an upper-ish bound on tokens/byte and the p75–p90 bytes-per-token as
  closer to hand-written code.
- Comments and whitespace are trivia, not tokens (their share of the source
  text is reported separately). If your scanner materializes comment tokens,
  add the comment counts in.
