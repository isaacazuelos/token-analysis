// A small Haskell lexer that extracts infix-operator usage from source text.
//
// It does not build a full token stream; it walks the text skipping the
// things that could be mistaken for operators (comments, string/char
// literals, CPP lines, quasiquote bodies, numeric literals) and yields the
// symbolic operator tokens and backtick-quoted infix functions that remain.
//
// Tricky bits it gets right:
//   - `{- -}` block comments nest; `--` starts a line comment only when the
//     whole symbol run is dashes (`-->`/`--|` are operators, per the report)
//   - qualified operators (`Map.!`, `Prelude.++`) count as the bare operator,
//     while `f.g` (no qualifier) counts as composition
//   - `[1..10]` is a range, not a float and a `..`; `[sql| ... |]`
//     quasiquote bodies are foreign text and are skipped entirely
//   - MagicHash (`Int#`, `(# x #)`) hashes are not the `#` operator

const SYMBOL_CHARS = new Set('!#$%&*+./<>=?@\\^|~:-');

// Haskell 2010 reservedop: language syntax, not term-level operators.
export const RESERVED_SYNTAX = new Set([
  '..', '::', '=', '\\', '|', '<-', '->', '@', '~', '=>',
]);

const NUMBER_RE =
  /^(0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|[0-9][0-9_]*(\.[0-9][0-9_]*)?([eE][+-]?[0-9]+)?)/;

const CHAR_LIT_RE = /^'(\\[^'\n]+|[^'\\\n])'/;

const BACKTICK_RE = /^`((?:[A-Z][A-Za-z0-9_']*\.)*[A-Za-z_][A-Za-z0-9_']*)`/;

// `[name| ... |]` opens a quasiquote when the name touches the bracket and
// bar. e/t/d/p are the Template Haskell quotes whose bodies are Haskell.
const QUASIQUOTE_RE = /^\[([A-Za-z_][A-Za-z0-9_'.]*)\|/;
const TH_QUOTE_NAMES = new Set(['e', 't', 'd', 'p']);

const isIdentStart = (c) => /[A-Za-z_]/.test(c);
const isIdentChar = (c) => /[A-Za-z0-9_']/.test(c);

/**
 * Yields `{ kind: 'op' | 'syntax' | 'backtick', name }` tokens.
 * 'op' is a symbolic operator (`<$>`), 'syntax' is reserved punctuation
 * (`->`), 'backtick' is an infix-applied function (`div` in `a \`div\` b`).
 */
export function* lexInfix(text) {
  const n = text.length;
  let i = 0;
  let bol = true; // only whitespace seen so far on this line

  while (i < n) {
    const c = text[i];

    if (c === '\n') {
      i += 1;
      bol = true;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
      i += 1;
      continue;
    }

    // CPP directive: skip the line, honoring backslash continuations.
    if (bol && c === '#') {
      while (i < n) {
        let eol = text.indexOf('\n', i);
        if (eol === -1) {
          i = n;
          break;
        }
        let k = eol - 1;
        while (k >= 0 && text[k] === '\r') k -= 1;
        if (text[k] === '\\') {
          i = eol + 1;
        } else {
          i = eol;
          break;
        }
      }
      continue;
    }
    bol = false;

    // Nested block comment (also covers pragmas).
    if (c === '{' && text[i + 1] === '-') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (text[i] === '{' && text[i + 1] === '-') {
          depth += 1;
          i += 2;
        } else if (text[i] === '-' && text[i + 1] === '}') {
          depth -= 1;
          i += 2;
        } else {
          i += 1;
        }
      }
      continue;
    }

    // String literal. Skipping the char after every backslash also handles
    // string gaps (`\   \`) well enough for our purposes.
    if (c === '"') {
      i += 1;
      while (i < n) {
        if (text[i] === '\\') {
          i += 2;
        } else if (text[i] === '"') {
          i += 1;
          break;
        } else {
          i += 1;
        }
      }
      continue;
    }

    // Char literal vs. Template Haskell name quote ('foo, ''Ty).
    if (c === "'") {
      const m = CHAR_LIT_RE.exec(text.slice(i, i + 16));
      i += m ? m[0].length : 1;
      continue;
    }

    // Backtick-quoted (possibly qualified) function used infix.
    if (c === '`') {
      const m = BACKTICK_RE.exec(text.slice(i, i + 256));
      if (m) {
        yield { kind: 'backtick', name: m[1].split('.').pop() };
        i += m[0].length;
      } else {
        i += 1;
      }
      continue;
    }

    // Quasiquote body: foreign text (SQL, HTML templates, ...), skip it.
    if (c === '[') {
      const m = QUASIQUOTE_RE.exec(text.slice(i, i + 256));
      if (m && !TH_QUOTE_NAMES.has(m[1].split('.').pop())) {
        const close = text.indexOf('|]', i + m[0].length);
        if (close !== -1) {
          i = close + 2;
          continue;
        }
      }
      i += 1;
      continue;
    }

    // Identifier; for module-qualified names, chase the dots so `Map.!`
    // attributes the `!` and `Prelude.foldr` doesn't emit a `.`.
    if (isIdentStart(c)) {
      const conid = /[A-Z]/.test(c);
      let j = i + 1;
      while (j < n && isIdentChar(text[j])) j += 1;
      if (conid && text[j] === '.' && j + 1 < n) {
        const after = text[j + 1];
        if (isIdentStart(after)) {
          i = j + 1; // qualified name: continue lexing the next segment
          continue;
        }
        if (SYMBOL_CHARS.has(after) && after !== '.') {
          i = j + 1; // qualified operator: drop the dot, lex the operator
          continue;
        }
      }
      i = j;
      continue;
    }

    // Numeric literal (so `1..10` and `1e3` don't shed bogus operators).
    if (c >= '0' && c <= '9') {
      const m = NUMBER_RE.exec(text.slice(i, i + 64));
      i += m[0].length;
      continue;
    }

    // Symbol run: a maximal sequence of operator characters is one token.
    if (SYMBOL_CHARS.has(c)) {
      let j = i;
      while (j < n && SYMBOL_CHARS.has(text[j])) j += 1;
      const run = text.slice(i, j);

      // Dashes-only runs of length >= 2 start a line comment.
      if (/^--+$/.test(run)) {
        const eol = text.indexOf('\n', j);
        i = eol === -1 ? n : eol;
        continue;
      }

      // MagicHash / unboxed tuples: `Int#`, `foo##`, `(# x #)`.
      if (/^#+$/.test(run)) {
        const before = i > 0 ? text[i - 1] : '';
        if (isIdentChar(before) || before === ')' || before === '(' || text[j] === ')') {
          i = j;
          continue;
        }
      }

      if (RESERVED_SYNTAX.has(run)) {
        yield { kind: 'syntax', name: run };
        i = j;
        continue;
      }

      // Prefix occurrences are not infix uses: bang patterns and strictness
      // annotations (`f !x`, `data T = T !Int`), negation (`-1`), Template
      // Haskell splices (`$(...)`). GHC >= 9.0 uses the same whitespace rule
      // (loose before, tight after), and like GHC we apply it only to the
      // operators where a prefix form exists — `(+1)` stays a section.
      if (run === '!' || run === '$' || run === '$$' || run === '-') {
        const before = i > 0 ? text[i - 1] : '\n';
        const after = j < n ? text[j] : '\n';
        const prefixContext = /[\s([{,;]/.test(before);
        const tightAfter = !/[\s)\]},;]/.test(after);
        if (prefixContext && tightAfter) {
          i = j;
          continue;
        }
      }
      yield { kind: 'op', name: run };
      i = j;
      continue;
    }

    i += 1; // brackets, commas, semicolons, unicode, ...
  }
}
