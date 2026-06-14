# Token density report

Generated 2026-06-14 from the source repositories of top npm packages
(hand-written code, build-output directories excluded), as a proxy corpus
for modern JavaScript/TypeScript.

- Requested packages (100): strip-ansi, ansi-styles, ansi-regex, supports-color, chalk, commander, wrap-ansi, string-width, tslib, minipass, type-fest, react-is, readable-stream, escape-string-regexp, has-flag, p-limit, p-locate, locate-path, is-fullwidth-code-point, js-yaml, agent-base, postcss, isarray, argparse, string_decoder, resolve, typescript, yargs-parser, yargs, hasown, cliui, path-exists, picocolors, zod, json5, fs-extra, @babel/parser, chokidar, convert-source-map, strip-json-comments, inherits, get-stream, readdirp, graceful-fs, negotiator, is-glob, camelcase, is-stream, braces, fill-range, yaml, lodash, yocto-queue, @typescript-eslint/types, es-errors, node-releases, statuses, es-object-atoms, is-extglob, util-deprecate, get-intrinsic, node-fetch, @typescript-eslint/typescript-estree, jsesc, @typescript-eslint/visitor-keys, @babel/core, magic-string, universalify, @typescript-eslint/scope-manager, rimraf, gopd, espree, buffer, http-errors, object-assign, es-define-property, scheduler, react, http-proxy-agent, normalize-path, pify, @typescript-eslint/utils, eslint, fdir, parse5, path-parse, react-dom, strip-bom, minimist, mime, csstype, fastq, optionator, has-tostringtag, flatted, levn, prelude-ls, undici, kind-of, lines-and-columns
- Repositories cloned (monorepos deduped): 91

## Headline numbers

Byte counts are raw input size (whitespace, comments, and all), so these
ratios apply directly to an input string’s length.

- **Tokens per byte: 0.1316**
- **Bytes per token: 7.60**
- Tokens per KiB: 134.8
- AST nodes per token: 0.41 (TypeScript CST granularity)

Per-file distribution of bytes per token:

| p10 | p25 | p50 (median) | p75 | p90 |
| --- | --- | --- | --- | --- |
| 4.62 | 5.65 | 7.05 | 9.07 | 12.75 |

### Sizing guidance

For a scanner token vec sized from input length, `capacity = bytes / N`:

- `N = 7.60` (aggregate mean) right-sizes the typical case.
- `N = 4.62` (p10 file) over-provisions enough that ~90% of files never reallocate.
- For parser SoA vecs, multiply token capacity by ~0.41 (AST nodes per token), adjusted for how granular your AST is relative to TypeScript’s.

## Trivia distribution

Per-file bytes per trivia piece, for sizing comment / whitespace SoA vecs from
input length the same way as the token vec (`capacity = bytes / N`; pick a low
percentile to over-provision the dense files). A comment piece is one line of a
comment (a K-line block comment counts as K); a whitespace piece is one
contiguous run of spaces/tabs/newlines, which a comment splits.

Comments — present in 4,598 of 6,114 files (75.2%); bytes per comment line:

| p10 | p25 | p50 (median) | p75 | p90 |
| --- | --- | --- | --- | --- |
| 69.00 | 113.50 | 208.00 | 467.08 | 1114.00 |

Whitespace — bytes per contiguous run:

| p10 | p25 | p50 (median) | p75 | p90 |
| --- | --- | --- | --- | --- |
| 9.11 | 11.00 | 13.79 | 17.20 | 22.01 |

### Sizing guidance

- Comment vec: `N = 69.00` (p10) over-provisions ~90% of comment-bearing files. Files with no comments still reserve `bytes / N` and leave it empty — size from token count instead if that waste matters.
- Whitespace vec: `N = 9.11` (p10) over-provisions ~90% of files; whitespace is in nearly every file, so input-length sizing is safe.
- Aggregate means: `N = 253.17` bytes/comment-line, `N = 15.56` bytes/whitespace-run.

## Corpus

|  | Files | Size |
| --- | --- | --- |
| Tokenized | 6,118 | 44.6 MiB |
| Skipped: exact duplicates | 100 | 92.6 KiB |
| Skipped: minified | 10 | 455.4 KiB |
| Skipped: .d.ts | 508 | 5.6 MiB |
| Skipped: over size limit | 0 | 0.0 KiB |

## By file class

| Class | Files | Size | Tokens | Bytes/token | Tokens/KiB |
| --- | --- | --- | --- | --- | --- |
| js | 2,935 | 15.7 MiB | 2,109,046 | 7.83 | 130.8 |
| ts | 3,183 | 28.8 MiB | 4,039,331 | 7.48 | 136.9 |

## Token type breakdown

| Category | Count | % of tokens | Chars | % of source text |
| --- | --- | --- | --- | --- |
| identifier | 1,822,431 | 29.6% | 17,299,601 | 37.1% |
| keyword | 639,816 | 10.4% | 3,090,862 | 6.6% |
| punctuation | 3,397,977 | 55.3% | 3,598,016 | 7.7% |
| string | 186,784 | 3.0% | 3,292,848 | 7.1% |
| template | 31,233 | 0.5% | 946,376 | 2.0% |
| number | 62,551 | 1.0% | 117,422 | 0.3% |
| regex | 1,999 | 0.0% | 44,733 | 0.1% |
| jsxText | 5,586 | 0.1% | 221,147 | 0.5% |
| *(trivia: comments)* | 184,522 | – | 7,808,930 | 16.7% |
| *(trivia: whitespace)* | 3,001,474 | – | 10,254,832 | 22.0% |

## Most common token kinds

| Token | Count | % of tokens |
| --- | --- | --- |
| `Identifier` | 1,819,826 | 29.6% |
| `,` | 436,379 | 7.1% |
| `(` | 425,340 | 6.9% |
| `)` | 425,334 | 6.9% |
| `.` | 385,455 | 6.3% |
| `;` | 330,284 | 5.4% |
| `:` | 289,121 | 4.7% |
| `{` | 226,462 | 3.7% |
| `}` | 225,173 | 3.7% |
| `StringLiteral` | 186,784 | 3.0% |
| `=` | 150,551 | 2.4% |
| `const` | 80,979 | 1.3% |
| `if` | 68,556 | 1.1% |
| `[` | 67,154 | 1.1% |
| `]` | 67,152 | 1.1% |
| `return` | 63,792 | 1.0% |
| `NumericLiteral` | 62,467 | 1.0% |
| `|` | 48,087 | 0.8% |
| `<` | 44,000 | 0.7% |
| `>` | 43,020 | 0.7% |

## Caveats

- Repos include tests and fixtures alongside the shipping source; common
  build-output directories (dist, build, vendor, ...) are skipped, but any
  committed generated code outside those is still counted.
- Tokenization follows TypeScript’s grammar; comments and whitespace are
  trivia, not tokens. If your scanner emits comment tokens, add the comment
  count to the token totals.
- Char counts are UTF-16 code units; byte counts are file sizes. The corpus
  is overwhelmingly ASCII, so the two are nearly interchangeable.
