# Most-used Haskell operators (top 30 Hackage packages)

Generated 2026-06-10 by `src/haskell/cli.js`.

Corpus: the 30 most-downloaded packages on Hackage (30-day downloads, via `/packages/top`). 4,134 unique `.hs` files, 59.6 MiB, 236,508 symbolic-operator uses and 25,614 backtick-infix uses (test/bench/example directories excluded).

Packages: git-annex, pandoc, texmath, hakyll, sbv, yesod-core, tidal, ghc-lib, hlint, wai-extra, persistent, vulkan, persistent-sqlite, futhark, hspec, haskoin-store, shelly, egison, yesod-auth, warp, purescript, brick, hledger, rattletrap, lens, http-conduit, yesod-bin, tls, yesod, shake.

Meaning and fixity are harvested from the defining package’s source on Hackage — the `-- |` Haddock comment and `infix[lr] n op` declaration that Hackage’s rendered docs are generated from. When an operator’s uses are concentrated in a few packages, the definition from its heaviest user wins (a DSL’s `.==`); otherwise the canonical definition from ghc-internal, base, ghc-prim, containers, bytestring, text, filepath, transformers, mtl, pretty, aeson, lens, vector is preferred.

## Symbolic operators (top 40 of 432)

"Share" is of all symbolic-operator uses; "Pkgs" is how many corpus packages use it.

| # | Operator | Uses | Share | Pkgs | Fixity | Defined in | Meaning (per Hackage docs) |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | `$` | 88,913 | 37.59% | 29 | infixr 0 | ghc-internal `GHC.Internal.Base` | `($) :: forall repa repb (a :: TYPE repa) (b :: TYPE repb). (a -> b) -> a -> b` — `($)` is the function application operator. |
| 2 | `.` | 23,549 | 9.96% | 29 | infixr 9 | ghc-internal `GHC.Internal.Base` | `(.) :: (b -> c) -> (a -> b) -> a -> c` — Right to left function composition. |
| 3 | `<>` | 17,018 | 7.20% | 28 | infixr 6 ‡ | ghc-internal `GHC.Internal.Base` | `(<>) :: a -> a -> a` — An associative operation. |
| 4 | `++` | 14,079 | 5.95% | 28 | infixr 5 | ghc-internal `GHC.Internal.Base` | `(++) :: [a] -> [a] -> [a]` — `(++)` appends two lists. |
| 5 | `<$>` | 11,250 | 4.76% | 29 | infixl 4 | ghc-internal `GHC.Internal.Data.Functor` | `(<$>) :: Functor f => (a -> b) -> f a -> f b` — An infix synonym for fmap. |
| 6 | `:` | 10,987 | 4.65% | 29 | infixr 5 | ghc-prim `GHC.Types` | `(:) :: a -> [a] -> [a]` — The list constructor: prepends an element to a list (cons). |
| 7 | `==` | 7,521 | 3.18% | 29 | infix 4 | ghc-internal `GHC.Internal.Classes` | `(==), (/=) :: a -> a -> Bool` — (method of class Eq) The Eq class defines equality (`==`) and inequality (`/=`). |
| 8 | `<+>` | 4,310 | 1.82% | 8 | infixr 6 ‡ | futhark `Futhark.Fmt.Monad` | `(<+>) :: Fmt -> Fmt -> Fmt` — Concatenate with a space between. |
| 9 | `+` | 3,802 | 1.61% | 25 | infixl 6 ‡ | ghc-internal `GHC.Internal.Num` | `(+), (-), (*) :: a -> a -> a` — (method of class Num) Basic numeric class. |
| 10 | `<*>` | 3,241 | 1.37% | 25 | infixl 4 | ghc-internal `GHC.Internal.Base` | `(<*>) :: f (a -> b) -> f a -> f b` — Sequential application. |
| 11 | `:::` | 3,213 | 1.36% | 1 | infixl 9 † | — | *(no signature found — possibly a data constructor or generated code)* |
| 12 | `*` | 3,029 | 1.28% | 27 | infixl 7 | ghc-internal `GHC.Internal.Num` | `(+), (-), (*) :: a -> a -> a` — (method of class Num) Basic numeric class. |
| 13 | `>>=` | 2,929 | 1.24% | 27 | infixl 1 | ghc-internal `GHC.Internal.Base` | `(>>=) :: forall a b. m a -> (a -> m b) -> m b` — Sequentially compose two actions, passing any value produced by the first as an argument to the second. |
| 14 | `&&` | 2,666 | 1.13% | 24 | infixr 3 | ghc-internal `GHC.Internal.Classes` | `(&&) :: Bool -> Bool -> Bool` — Boolean "and", lazy in the second argument |
| 15 | `-` | 2,659 | 1.12% | 25 | infixl 6 | ghc-internal `GHC.Internal.Num` | `(+), (-), (*) :: a -> a -> a` — (method of class Num) Basic numeric class. |
| 16 | `\|\|` | 2,029 | 0.86% | 26 | infixr 2 | ghc-internal `GHC.Internal.Classes` | `(\|\|) :: Bool -> Bool -> Bool` — Boolean "or", lazy in the second argument |
| 17 | `/=` | 2,026 | 0.86% | 29 | infix 4 | ghc-internal `GHC.Internal.Classes` | `(==), (/=) :: a -> a -> Bool` — (method of class Eq) The Eq class defines equality (`==`) and inequality (`/=`). |
| 18 | `<\|>` | 2,018 | 0.85% | 22 | infixl 3 ‡ | ghc-internal `GHC.Internal.Base` | `(<\|>) :: f a -> f a -> f a` — An associative binary operation |
| 19 | `=<<` | 1,885 | 0.80% | 21 | infixr 1 | ghc-internal `GHC.Internal.Base` | `(=<<) :: Monad m => (a -> m b) -> m a -> m b` — Same as `>>=`, but with the arguments interchanged. |
| 20 | `.==` | 1,850 | 0.78% | 1 | infix 4 | sbv `Data.SBV.Core.Data` | `(.==) :: a -> a -> SBool` — Symbolic equality. |
| 21 | `$$` | 1,592 | 0.67% | 3 | infixl 5 | pretty `Text.PrettyPrint.HughesPJ` | `($$) :: Doc -> Doc -> Doc` — Above, except that if the last line of the first argument stops at least one position before the first line of the second begins, these two lines are overlapped. |
| 22 | `>>` | 1,328 | 0.56% | 26 | infixl 1 | ghc-internal `GHC.Internal.Base` | `(>>) :: forall a b. m a -> m b -> m b` — Sequentially compose two actions, discarding any value produced by the first, like sequencing operators (such as the semicolon) in imperative languages. |
| 23 | `</>` | 1,241 | 0.52% | 16 | infixr 5 ‡ | filepath `System.FilePath` | `(</>) :: FILEPATH -> FILEPATH -> FILEPATH` — Combine two paths with a path separator. If the second path starts with a path separator or a drive letter, then it returns the second. |
| 24 | `=:` | 1,223 | 0.52% | 1 | infixr 1 | sbv `Data.SBV.TP.TP` | `(=:) :: ChainStep a (ChainsTo a) => a -> ChainsTo a -> ChainsTo a` — Chain steps in a calculational proof. |
| 25 | `<` | 1,057 | 0.45% | 24 | infix 4 | ghc-internal `GHC.Internal.Classes` | `(<), (<=), (>), (>=) :: a -> a -> Bool` — (method of class Ord) The Ord class is used for totally ordered datatypes. |
| 26 | `>` | 848 | 0.36% | 22 | infix 4 | ghc-internal `GHC.Internal.Classes` | `(<), (<=), (>), (>=) :: a -> a -> Bool` — (method of class Ord) The Ord class is used for totally ordered datatypes. |
| 27 | `\|=` | 786 | 0.33% | 1 | infixl 9 † | — | *(no signature found — possibly a data constructor or generated code)* |
| 28 | `.:` | 718 | 0.30% | 10 | infixr 5 | aeson `Data.Aeson.Types.FromJSON` | `(.:) :: (FromJSON a) => Object -> Key -> Parser a` — Retrieve the value associated with the given key of an Object. The result is empty if the key is not present or the value cannot be converted to the desired type. |
| 29 | `<*` | 693 | 0.29% | 14 | infixl 4 | ghc-internal `GHC.Internal.Base` | `(<*) :: f a -> f b -> f a` — Sequence actions, discarding the value of the second argument. |
| 30 | `*>` | 678 | 0.29% | 16 | infixl 4 | ghc-internal `GHC.Internal.Base` | `(*>) :: f a -> f b -> f b` — Sequence actions, discarding the value of the first argument. |
| 31 | `>=` | 649 | 0.27% | 24 | infix 4 | ghc-internal `GHC.Internal.Classes` | `(<), (<=), (>), (>=) :: a -> a -> Bool` — (method of class Ord) The Ord class is used for totally ordered datatypes. |
| 32 | `??` | 648 | 0.27% | 2 | infixl 2 ‡ | sbv `Data.SBV.TP.TP` | `(??) :: HintsTo a b => a -> b -> Hinted a` — Attaching a hint |
| 33 | `<=` | 609 | 0.26% | 23 | infix 4 | ghc-internal `GHC.Internal.Classes` | `(<), (<=), (>), (>=) :: a -> a -> Bool` — (method of class Ord) The Ord class is used for totally ordered datatypes. |
| 34 | `^.` | 596 | 0.25% | 7 | infixl 8 | sbv `Data.SBV.Tuple` | `(^.) :: a -> (a -> b) -> b` — Field access, inspired by the lens library. |
| 35 | `<$` | 586 | 0.25% | 14 | infixl 4 | ghc-internal `GHC.Internal.Base` | `(<$) :: a -> f b -> f a` — Replace all locations in the input with the same value. The default definition is `fmap . const`, but this may be overridden with a more efficient version. |
| 36 | `.=` | 566 | 0.24% | 13 | infix 4 ‡ | lens `Control.Lens.Setter` | `(.=) :: MonadState s m => ASetter s s a b -> b -> m ()` — Replace the target of a Lens or all of the targets of a Setter or Traversal in our monadic state with a new value, irrespective of the old. |
| 37 | `&` | 551 | 0.23% | 8 | infixl 1 | ghc-internal `GHC.Internal.Data.Function` | `(&) :: forall r a (b :: TYPE r). a -> (a -> b) -> b` — `&` is a reverse application operator. This provides notational convenience. |
| 38 | `.&&` | 497 | 0.21% | 1 | infixr 3 | sbv `Data.SBV.Core.Data` | `(.&&) :: SBool -> SBool -> SBool` — *(no Haddock comment at definition)* |
| 39 | `/` | 458 | 0.19% | 20 | infixl 7 | ghc-internal `GHC.Internal.Real` | `(/) :: a -> a -> a` — Fractional division. |
| 40 | `!` | 446 | 0.19% | 13 | infixl 9 | ghc-internal `GHC.Internal.Arr` | `(!) :: Ix i => Array i e -> i -> e` — The value at the given index in an array. |

† no fixity declaration found: Haskell defaults to `infixl 9`.
‡ different packages declare different fixities for this name; the defining package’s is shown.

## Backtick infix functions (top 15)

Ordinary functions applied infix, as in ``x `div` y``. Counts cover only infix uses, not prefix calls, so these rank far below the symbolic operators.

| # | Operator | Uses | Share | Pkgs | Fixity | Defined in | Meaning (per Hackage docs) |
| ---: | --- | ---: | ---: | ---: | --- | --- | --- |
| 1 | `plusPtr` | 13,630 | 53.21% | 4 | infixl 9 † | ghc-internal `GHC.Internal.Ptr` | `plusPtr :: Ptr a -> Int -> Ptr b` — Advances the given address by the given offset in bytes. |
| 2 | `elem` | 1,136 | 4.44% | 22 | infix 4 | ghc-internal `GHC.Internal.List` | `elem :: (Eq a) => a -> [a] -> Bool` — elem is the list membership predicate, usually written in infix form, e.g., `x \elem\ xs`. |
| 3 | `snocOL` | 680 | 2.65% | 1 | infixl 9 † | — | *(no signature found — possibly a data constructor or generated code)* |
| 4 | `appOL` | 674 | 2.63% | 1 | infixl 9 † | — | *(no signature found — possibly a data constructor or generated code)* |
| 5 | `isPrefixOf` | 396 | 1.55% | 19 | infixl 9 † | ghc-internal `GHC.Internal.Data.OldList` | `isPrefixOf :: (Eq a) => [a] -> [a] -> Bool` — O(min(m,n)). The isPrefixOf function takes two lists and returns True iff the first list is a prefix of the second. |
| 6 | `advancePtrBytes` | 377 | 1.47% | 1 | infixl 9 † | vulkan `Vulkan.CStruct.Utils` | `advancePtrBytes :: Ptr a -> Int -> Ptr a` — A type restricted plusPtr |
| 7 | `at` | 377 | 1.47% | 1 | infixl 9 † | sbv `Data.SBV.TP.TP` | `at :: Proof a -> IArgs a -> Proof Bool` — Apply a universal proof to some arguments, creating a boolean expression guaranteed to be true |
| 8 | `member` | 276 | 1.08% | 18 | infixl 9 † | containers `Data.Map.Internal` | `member :: Ord k => k -> Map k a -> Bool` — O(log n). Is the key a member of the map? See also notMember. |
| 9 | `notElem` | 248 | 0.97% | 18 | infix 4 | ghc-internal `GHC.Internal.List` | `notElem :: (Eq a) => a -> [a] -> Bool` — notElem is the negation of elem. |
| 10 | `mappend` | 208 | 0.81% | 18 | infixl 9 † | ghc-internal `GHC.Internal.Base` | `mappend :: a -> a -> a` — An associative operation |
| 11 | `seq` | 196 | 0.77% | 11 | infixr 0 | ghc-prim `GHC.Prim` | `seq :: a -> b -> b` — Evaluates its first argument to weak head normal form, and then returns its second argument as the result. |
| 12 | `op` | 193 | 0.75% | 4 | infixl 9 † | lens `Control.Lens.Wrapped` | `op :: Wrapped s => (Unwrapped s -> s) -> s -> Unwrapped s` — Given the constructor for a Wrapped type, return a deconstructor that is its inverse. |
| 13 | `sEMod` | 178 | 0.69% | 1 | infixl 9 † | sbv `Data.SBV.Core.Model` | `sEMod :: SInteger -> SInteger -> SInteger` — Euclidian modulus. Note that unlike regular modulus, Euclidian division by `0` is unconstrained. i.e., it can take any value whatsoever. |
| 14 | `div` | 176 | 0.69% | 12 | infixl 7 | ghc-internal `GHC.Internal.Real` | `div :: a -> a -> a` — Integer division truncated toward negative infinity. |
| 15 | `lookup` | 153 | 0.60% | 12 | infixl 9 † | ghc-internal `GHC.Internal.List` | `lookup :: (Eq a) => a -> [(a,b)] -> Maybe b` — O(n). lookup `key assocs` looks up a key in an association list. For the result to be Nothing, the list must be finite. |

† no fixity declaration found: Haskell defaults to `infixl 9`.

## Reserved syntax (for scale)

These are reserved punctuation, not operators — they have no fixity and cannot be redefined — but they share the same lexical grammar, so here are their counts for comparison.

| Token | Uses | Share | Meaning |
| --- | ---: | ---: | --- |
| `=` | 226,891 | 35.83% | definition / binding |
| `->` | 170,922 | 26.99% | function arrow: types, lambdas, and `case` alternatives |
| `::` | 85,492 | 13.50% | type annotation ("has type") |
| `<-` | 54,171 | 8.55% | bind in `do`-notation, list comprehensions, and pattern guards |
| `\|` | 29,497 | 4.66% | guards, `data` alternatives, comprehension separator |
| `\` | 19,620 | 3.10% | lambda abstraction |
| `@` | 15,767 | 2.49% | as-patterns; visible type application |
| `..` | 14,773 | 2.33% | arithmetic ranges, record wildcards, `(..)` exports |
| `=>` | 13,658 | 2.16% | class-constraint arrow |
| `~` | 2,461 | 0.39% | irrefutable (lazy) patterns; type-equality constraints |

## Caveats

- Counts are raw token occurrences: export lists, fixity declarations, and
  definition sites count alongside ordinary uses.
- Prefix occurrences of `!`, `-`, and `$` are excluded using GHC’s whitespace
  rule (loose before, tight after): bang patterns and strictness annotations,
  negation, and Template Haskell splices don’t count as infix uses.
- `.` conflates function composition, `OverloadedRecordDot` field access,
  and the dot in `forall a. t`; module qualifiers (`Map.!`) are *not* counted.
- Identically-named operators from different packages are merged (`.=` is both
  aeson’s pair builder and lens’s state setter); the meaning shown is the
  highest-preference definition found, so check "Defined in".
- Skipped: `.lhs`/`.hsc` files, CPP lines, quasiquote bodies, and
  files over 2,000,000 bytes.
