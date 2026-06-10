# Token density report

Generated 2026-06-10 from the published files of npm packages and their
dependencies, as a proxy corpus for modern JavaScript/TypeScript.

- Requested packages (25): ansi-styles, strip-ansi, ansi-regex, string-width, supports-color, chalk, commander, wrap-ansi, tslib, minipass, type-fest, react-is, readable-stream, escape-string-regexp, p-limit, locate-path, p-locate, has-flag, is-fullwidth-code-point, js-yaml, postcss, agent-base, string_decoder, resolve, isarray
- Packages in corpus tree (incl. dependencies): 46

## Headline numbers

- **Tokens per byte: 0.1688**
- **Bytes per token: 5.92**
- Tokens per KiB: 172.9
- AST nodes per token: 0.44 (TypeScript CST granularity)

Per-file distribution of bytes per token:

| p10 | p25 | p50 (median) | p75 | p90 |
| --- | --- | --- | --- | --- |
| 3.88 | 4.47 | 5.30 | 7.06 | 10.38 |

### Sizing guidance

For a scanner token vec sized from input length, `capacity = bytes / N`:

- `N = 5.92` (aggregate mean) right-sizes the typical case.
- `N = 3.88` (p10 file) over-provisions enough that ~90% of files never reallocate.
- For parser SoA vecs, multiply token capacity by ~0.44 (AST nodes per token), adjusted for how granular your AST is relative to TypeScript’s.

## Corpus

|  | Files | Size |
| --- | --- | --- |
| Tokenized | 281 | 1.5 MiB |
| Skipped: exact duplicates | 10 | 27.4 KiB |
| Skipped: minified | 5 | 65.1 KiB |
| Skipped: .d.ts | 280 | 714.4 KiB |
| Skipped: over size limit | 0 | 0.0 KiB |

## By file class

| Class | Files | Size | Tokens | Bytes/token | Tokens/KiB |
| --- | --- | --- | --- | --- | --- |
| js | 281 | 1.5 MiB | 269,810 | 5.92 | 172.9 |

## Token type breakdown

| Category | Count | % of tokens | Chars | % of source text |
| --- | --- | --- | --- | --- |
| identifier | 79,776 | 29.6% | 550,882 | 34.5% |
| keyword | 28,659 | 10.6% | 122,531 | 7.7% |
| punctuation | 146,513 | 54.3% | 159,741 | 10.0% |
| string | 8,173 | 3.0% | 108,323 | 6.8% |
| template | 455 | 0.2% | 5,451 | 0.3% |
| number | 6,024 | 2.2% | 9,110 | 0.6% |
| regex | 210 | 0.1% | 4,649 | 0.3% |
| *(trivia: comments)* | 3,361 | – | 237,342 | 14.9% |
| *(trivia: whitespace)* | – | – | 399,854 | 25.0% |

## Most common token kinds

| Token | Count | % of tokens |
| --- | --- | --- |
| `Identifier` | 79,753 | 29.6% |
| `)` | 23,616 | 8.8% |
| `(` | 23,616 | 8.8% |
| `.` | 19,006 | 7.0% |
| `,` | 12,717 | 4.7% |
| `;` | 12,015 | 4.5% |
| `=` | 10,690 | 4.0% |
| `}` | 9,606 | 3.6% |
| `{` | 9,606 | 3.6% |
| `StringLiteral` | 8,173 | 3.0% |
| `NumericLiteral` | 6,024 | 2.2% |
| `if` | 4,702 | 1.7% |
| `this` | 3,989 | 1.5% |
| `]` | 3,689 | 1.4% |
| `[` | 3,689 | 1.4% |
| `:` | 3,222 | 1.2% |
| `return` | 3,203 | 1.2% |
| `===` | 2,351 | 0.9% |
| `function` | 2,253 | 0.8% |
| `const` | 1,910 | 0.7% |

## Caveats

- Published npm files skew toward compiled/bundled output, which is denser
  than hand-written source. Minified files are bucketed separately (excluded
  by default) to limit this, but transpiled output remains.
- Tokenization follows TypeScript’s grammar; comments and whitespace are
  trivia, not tokens. If your scanner emits comment tokens, add the comment
  count to the token totals.
- Char counts are UTF-16 code units; byte counts are file sizes. The corpus
  is overwhelmingly ASCII, so the two are nearly interchangeable.
