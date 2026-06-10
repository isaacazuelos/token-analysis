# Token Analysis

I had Claude Fable 5.0 build this to answer a question I had working on my own
language and parser. Everything after this sentence is AI-generated.

Two related corpus-analysis tools live here:

1. **token-density** (`src/cli.js`) — measures **tokens per byte** of
   real-world JavaScript/TypeScript from npm.
2. **haskell-operators** (`src/haskell/cli.js`) — ranks **operator usage**
   in popular Hackage packages, with each operator's meaning (per its
   Haddock docs) and fixity. See [Haskell operators](#haskell-operators).

## token-density

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

### Usage

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

### How it works

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

### Caveats

- npm packages ship compiled/bundled output more often than pristine source,
  which is somewhat denser than what a human types. Treat the headline number
  as an upper-ish bound on tokens/byte and the p75–p90 bytes-per-token as
  closer to hand-written code.
- Comments and whitespace are trivia, not tokens (their share of the source
  text is reported separately). If your scanner materializes comment tokens,
  add the comment counts in.

## Haskell operators

A separate tool (`src/haskell/cli.js`, no shared code or dependencies) that
answers: **which operators does real-world Haskell actually use, and what do
they mean?** It pulls the most-downloaded packages from Hackage, lexes every
`.hs` file, and ranks symbolic operators (`<$>`, `>>=`, ...) and
backtick-infix functions (``x `div` y``) by use, joining each with its
**fixity declaration** and the first paragraph of its **Haddock comment** —
the same text Hackage's rendered docs are generated from.

### Usage

```sh
# Top 30 packages (default), report to stdout:
node src/haskell/cli.js

# Save the report and the raw counts:
node src/haskell/cli.js --top 30 --out reports/haskell-operators-top-30.md \
    --json reports/haskell-operators-top-30.json

# A corpus of your choosing, re-running offline afterwards:
node src/haskell/cli.js --packages lens,aeson,containers
node src/haskell/cli.js --skip-download --operators 60
```

Options:

| Flag | Default | Meaning |
| --- | --- | --- |
| `-t, --top <n>` | 30 | how many top packages to pull |
| `-p, --packages <a,b>` | – | explicit package list instead of `--top` |
| `--operators <n>` | 40 | symbolic operators to list |
| `--backticks <n>` | 15 | backtick infix functions to list |
| `--doc-packages <l>` | base, ghc-internal, ... | packages searched first for docs/fixity |
| `--workdir <dir>` | `corpus-haskell` | where tarballs are extracted |
| `--skip-download` | off | reuse the existing corpus, no network |
| `--include-tests` | off | also count test/bench/example directories |
| `--max-file-bytes <n>` | 2000000 | skip files larger than this |
| `--out <file>` / `--json <file>` | – | write the report / raw counts |

A sample report is checked in at
[`reports/haskell-operators-top-30.md`](reports/haskell-operators-top-30.md).

### How it works

- **Package selection** — Hackage has a real popularity endpoint
  (`/packages/top`, 30-day downloads); the top N are downloaded as source
  tarballs and extracted. Identical files (vendored copies) are counted once,
  and test/bench/example directories are skipped by default.
- **Lexing** — a small purpose-built Haskell lexer skips comments (nested
  `{- -}`, line comments — while keeping operators like `-->`), string/char
  literals, CPP lines, numeric literals (`[1..10]` is a range, not a float),
  and quasiquote bodies (`[sql| ... |]` is foreign text). Qualified operators
  (`Map.!`) count as the bare operator; module qualifiers don't emit `.`.
  Prefix occurrences of `!`/`-`/`$` (bang patterns, negation, TH splices) are
  excluded using GHC's whitespace rule. Reserved syntax (`->`, `=`, `::`, ...)
  is tallied separately — it has no fixity and can't be redefined.
- **Meaning and fixity** — harvested from the defining package's source: the
  `-- |` / `{- | -}` Haddock comment above the signature (falling back to the
  class's doc for bare methods like `==`) and the `infixl/infixr/infix n op`
  declaration. Hackage's rendered docs are generated from exactly these, but
  the docs host wasn't reachable from this environment — the tarballs are.
  Since GHC 9.10 `base` is mostly a re-export shim, so `ghc-internal` and
  `ghc-prim` are downloaded as doc sources too (plus `containers`, `pretty`,
  `aeson`, `lens`, ... — see `--doc-packages`).
- **Homonyms** — several packages can define the same operator name. When an
  operator's uses are concentrated in a few packages, the documented
  definition from its heaviest user wins (sbv's `.==`); otherwise the
  canonical doc-package definition is preferred (Ord's `<=`, not a worked
  example's; aeson's `.:`, not a DSL's undocumented one).

### Caveats

See the generated report's own caveats section: counts are raw token
occurrences, `.` conflates composition with record-dot, generated FFI
bindings skew backtick counts, and homonym attribution is a heuristic —
check the "Defined in" column.
