# Token density report

Generated 2026-06-10 from the source repositories of top npm packages
(hand-written code, build-output directories excluded), as a proxy corpus
for modern JavaScript/TypeScript.

- Reused an existing corpus (`--skip-install`)
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
| 4.62 | 5.68 | 7.08 | 9.10 | 12.83 |

### Sizing guidance

For a scanner token vec sized from input length, `capacity = bytes / N`:

- `N = 7.60` (aggregate mean) right-sizes the typical case.
- `N = 4.62` (p10 file) over-provisions enough that ~90% of files never reallocate.
- For parser SoA vecs, multiply token capacity by ~0.41 (AST nodes per token), adjusted for how granular your AST is relative to TypeScript’s.

## Corpus

|  | Files | Size |
| --- | --- | --- |
| Tokenized | 5,942 | 43.4 MiB |
| Skipped: exact duplicates | 100 | 92.6 KiB |
| Skipped: minified | 8 | 313.9 KiB |
| Skipped: .d.ts | 461 | 5.5 MiB |
| Skipped: over size limit | 0 | 0.0 KiB |

## By file class

| Class | Files | Size | Tokens | Bytes/token | Tokens/KiB |
| --- | --- | --- | --- | --- | --- |
| js | 2,764 | 14.6 MiB | 1,951,401 | 7.85 | 130.5 |
| ts | 3,178 | 28.8 MiB | 4,038,280 | 7.48 | 136.9 |

## Token type breakdown

| Category | Count | % of tokens | Chars | % of source text |
| --- | --- | --- | --- | --- |
| identifier | 1,775,372 | 29.6% | 16,906,734 | 37.2% |
| keyword | 621,680 | 10.4% | 3,012,221 | 6.6% |
| punctuation | 3,313,432 | 55.3% | 3,505,100 | 7.7% |
| string | 181,132 | 3.0% | 3,222,144 | 7.1% |
| template | 30,363 | 0.5% | 934,961 | 2.1% |
| number | 60,157 | 1.0% | 113,164 | 0.2% |
| regex | 1,959 | 0.0% | 43,905 | 0.1% |
| jsxText | 5,586 | 0.1% | 221,147 | 0.5% |
| *(trivia: comments)* | 70,637 | – | 5,356,960 | 11.8% |
| *(trivia: whitespace)* | – | – | 12,175,254 | 26.8% |

## Most common token kinds

| Token | Count | % of tokens |
| --- | --- | --- |
| `Identifier` | 1,773,987 | 29.6% |
| `,` | 428,652 | 7.2% |
| `(` | 411,516 | 6.9% |
| `)` | 411,510 | 6.9% |
| `.` | 373,736 | 6.2% |
| `;` | 329,917 | 5.5% |
| `:` | 286,347 | 4.8% |
| `{` | 219,117 | 3.7% |
| `}` | 217,828 | 3.6% |
| `StringLiteral` | 181,132 | 3.0% |
| `=` | 144,667 | 2.4% |
| `const` | 78,165 | 1.3% |
| `if` | 65,961 | 1.1% |
| `[` | 64,379 | 1.1% |
| `]` | 64,377 | 1.1% |
| `return` | 61,808 | 1.0% |
| `NumericLiteral` | 60,073 | 1.0% |
| `|` | 48,068 | 0.8% |
| `<` | 43,684 | 0.7% |
| `>` | 42,778 | 0.7% |

## Caveats

- Repos include tests and fixtures alongside the shipping source; common
  build-output directories (dist, build, vendor, ...) are skipped, but any
  committed generated code outside those is still counted.
- Tokenization follows TypeScript’s grammar; comments and whitespace are
  trivia, not tokens. If your scanner emits comment tokens, add the comment
  count to the token totals.
- Char counts are UTF-16 code units; byte counts are file sizes. The corpus
  is overwhelmingly ASCII, so the two are nearly interchangeable.
