// Tokenize a source file with the TypeScript compiler.
//
// We do a full parse and walk the concrete syntax tree down to its token
// leaves rather than running the scanner directly: the scanner alone cannot
// distinguish division from a regex literal (or `<` from JSX) without parser
// context, and mis-lexing one regex can corrupt everything after it. The
// parse also gives us an AST-node count for free, which is the number you
// want when sizing *parser* SoA vecs.

import ts from 'typescript';

export const CATEGORIES = [
  'identifier',
  'keyword',
  'punctuation',
  'string',
  'template',
  'number',
  'regex',
  'jsxText',
  'other',
];

const S = ts.SyntaxKind;

function categorize(kind) {
  if (kind === S.Identifier || kind === S.PrivateIdentifier) return 'identifier';
  if (kind >= S.FirstKeyword && kind <= S.LastKeyword) return 'keyword';
  if (kind >= S.FirstPunctuation && kind <= S.LastPunctuation) return 'punctuation';
  if (kind === S.StringLiteral) return 'string';
  if (
    kind === S.NoSubstitutionTemplateLiteral ||
    kind === S.TemplateHead ||
    kind === S.TemplateMiddle ||
    kind === S.TemplateTail
  ) {
    return 'template';
  }
  if (kind === S.NumericLiteral || kind === S.BigIntLiteral) return 'number';
  if (kind === S.RegularExpressionLiteral) return 'regex';
  if (kind === S.JsxText || kind === S.JsxTextAllWhiteSpaces) return 'jsxText';
  return 'other';
}

function scriptKindFor(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (lower.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(ts|mts|cts)$/.test(lower)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

// The SyntaxKind reverse map can return a First*/Last* alias for these.
const KIND_NAME_OVERRIDES = {
  [S.NumericLiteral]: 'NumericLiteral',
  [S.BigIntLiteral]: 'BigIntLiteral',
  [S.RegularExpressionLiteral]: 'RegularExpressionLiteral',
  [S.NoSubstitutionTemplateLiteral]: 'NoSubstitutionTemplateLiteral',
  [S.TemplateHead]: 'TemplateHead',
  [S.TemplateTail]: 'TemplateTail',
  [S.JsxText]: 'JsxText',
};

export function kindName(kind) {
  return KIND_NAME_OVERRIDES[kind] ?? ts.tokenToString(kind) ?? S[kind];
}

/**
 * Returns token statistics for one file:
 * `{ tokens, nodes, chars, categories, kinds, comments, whitespace }` where
 * `categories` maps category name to `{ count, chars }`, `kinds` maps
 * SyntaxKind to count, `comments`/`whitespace` are `{ count, chars }` trivia
 * tallies, and `chars` are UTF-16 code units (≈ bytes for the mostly-ASCII
 * corpus).
 */
export function tokenizeFile(filePath, text) {
  const scriptKind = scriptKindFor(filePath);
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  );

  const categories = Object.fromEntries(CATEGORIES.map((c) => [c, { count: 0, chars: 0 }]));
  const kinds = new Map();
  let tokens = 0;
  let nodes = 0;
  let tokenChars = 0;
  const comments = { count: 0, chars: 0 };
  const whitespace = { count: 0, chars: 0 };

  const stack = [sourceFile];
  while (stack.length > 0) {
    const node = stack.pop();
    const kind = node.kind;
    // JSDoc subtrees re-parse comment text into pseudo-tokens; the whole
    // comment is already counted as trivia of the host token, so skip them
    // without descending into their children.
    if (kind >= S.FirstJSDocNode && kind <= S.LastJSDocNode) continue;

    if (kind < S.FirstNode) {
      // A token leaf (including the end-of-file token). Its leading trivia is
      // the gap the parser already separated from real code, so it is pure
      // whitespace and comments — classify it here. We deliberately do not run
      // a standalone scanner over the file: without parser context it mis-reads
      // template-literal types and regex-vs-division and swallows trivia into
      // bogus string tokens (badly, on files like lib.dom.d.ts).
      addLeadingTrivia(text, node.getFullStart(), node.getStart(sourceFile), comments, whitespace);
      if (kind === S.EndOfFileToken) continue; // trailing trivia only, not a token
      tokens += 1;
      const width = node.end - node.getStart(sourceFile);
      tokenChars += width;
      const cat = categories[categorize(kind)];
      cat.count += 1;
      cat.chars += width;
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    } else {
      if (kind !== S.SyntaxList && kind !== S.SourceFile) nodes += 1;
      stack.push(...node.getChildren(sourceFile));
    }
  }

  return {
    tokens,
    nodes,
    chars: text.length,
    tokenChars,
    categories,
    kinds,
    comments,
    whitespace,
  };
}

const SLASH = 47; // /
const STAR = 42; // *
const LF = 10; // \n
const CR = 13; // \r

// Classify the leading-trivia span `[fullStart, start)` of a token. Because the
// parser has already separated this span from real code, it contains only
// whitespace and comments, and every `/` in it begins a comment — so we can
// walk it directly rather than re-scanning the file (a standalone scanner lacks
// parser context and the TS comment-range helpers mis-handle same-line "//"
// comments). Counting granularity matches the trivia model of the target parser
// this corpus sizes vecs for: a *comment piece* is one line (a K-line block
// comment counts as K, like K line comments), and a *whitespace piece* is one
// maximal contiguous run of spaces/tabs/newlines, which a comment splits.
// `count` is pieces; `chars` is UTF-16 code units.
function addLeadingTrivia(text, fullStart, start, comments, whitespace) {
  let i = fullStart;
  let runStart = -1; // start of the current whitespace run, or -1 if not in one
  const flushRun = (end) => {
    if (runStart >= 0) {
      whitespace.count += 1;
      whitespace.chars += end - runStart;
      runStart = -1;
    }
  };

  while (i < start) {
    if (text.charCodeAt(i) === SLASH && i + 1 < start) {
      const next = text.charCodeAt(i + 1);
      if (next === SLASH) {
        flushRun(i);
        let j = i + 2;
        while (j < start && text.charCodeAt(j) !== LF && text.charCodeAt(j) !== CR) j += 1;
        comments.count += 1; // a line comment is one line
        comments.chars += j - i;
        i = j;
        continue;
      }
      if (next === STAR) {
        flushRun(i);
        let j = i + 2;
        let lines = 1;
        while (j < start) {
          const c = text.charCodeAt(j);
          if (c === STAR && j + 1 < start && text.charCodeAt(j + 1) === SLASH) {
            j += 2;
            break;
          }
          if (c === LF) lines += 1;
          j += 1;
        }
        comments.count += lines; // one comment piece per line of the block
        comments.chars += j - i;
        i = j;
        continue;
      }
    }
    if (runStart < 0) runStart = i; // whitespace char extends/starts a run
    i += 1;
  }
  flushRun(start);
}
