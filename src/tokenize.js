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
 * `{ tokens, nodes, chars, categories, kinds, comments }` where `categories`
 * maps category name to `{ count, chars }`, `kinds` maps SyntaxKind to count,
 * and `chars` are UTF-16 code units (≈ bytes for the mostly-ASCII corpus).
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

  const stack = [sourceFile];
  while (stack.length > 0) {
    const node = stack.pop();
    const kind = node.kind;
    if (kind === S.EndOfFileToken) continue;
    // JSDoc subtrees re-parse comment text into pseudo-tokens; the whole
    // comment is already accounted for as trivia.
    if (kind >= S.FirstJSDocNode && kind <= S.LastJSDocNode) continue;

    if (kind < S.FirstNode) {
      // A token leaf.
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
    comments: countComments(text, scriptKind),
  };
}

// Comments and whitespace are trivia and never show up as CST tokens, so we
// make a second, scanner-only pass to measure them. The scanner's
// regex-vs-division ambiguity can very occasionally misread a comment inside
// what is really a regex literal; the error is negligible at corpus scale.
function countComments(text, scriptKind) {
  const variant =
    scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX
      ? ts.LanguageVariant.JSX
      : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ false, variant, text);
  let count = 0;
  let chars = 0;
  let kind;
  while ((kind = scanner.scan()) !== S.EndOfFileToken) {
    if (kind === S.SingleLineCommentTrivia || kind === S.MultiLineCommentTrivia) {
      count += 1;
      chars += scanner.getTokenText().length;
    }
  }
  return { count, chars };
}
