# Round 1 Experiment: Verified Semantic Micro-Rewrites

## Goal

Build the first executable version of the semantic JavaScript minification pipeline described in `PROJECT.md` and measure whether semantics-preserving rewrites can reduce size beyond a standard Terser baseline on small programs.

## First Minifier Version

Version `v0` is intentionally conservative:

1. Parse each benchmark with Babel.
2. Generate a set of semantic rewrite candidates.
3. Minify each candidate with Terser.
4. Differentially execute original and candidate code in Node's VM.
5. Keep the smallest candidate that passes all tests.

This substitutes deterministic rewrite rules for the LLM in the first round. The LLM integration should later fill the same candidate-generation interface.

## Rewrite Rules

- Boolean comparison simplification: `x === true -> x`, `x === false -> !x`, and symmetric variants.
- Ternary boolean simplification: `cond ? true : false -> !!cond`, `cond ? false : true -> !cond`.
- If-return conversion: `if (cond) return a; return b; -> return cond ? a : b;`.
- If-assignment conversion: `if (cond) x = a; else x = b; -> x = cond ? a : b;`.

## Benchmarks

Round 1 uses local fixtures in `benchmarks/round1/`. Each fixture exports functions through CommonJS and includes a JSON test corpus.

## Metrics

- Raw byte size.
- Brotli byte size.
- Terser byte size.
- Best verified semantic byte size.
- Number of generated candidates.
- Number of candidates passing differential tests.
- Runtime latency in milliseconds.

## Success Criteria

The experiment is successful if:

- the harness rejects incorrect candidates,
- every selected semantic minification passes all differential tests,
- at least one benchmark improves over Terser, or the failure mode is clear enough to guide the next rewrite/LLM prompt design.

## First Run

Command:

```sh
npm run experiment
```

Results are written to `results/round1.json` and `results/round1.md`.

Initial outcome:

- `assignment-choice`: 10 bytes smaller than Terser.
- `boolean-normalize`: 13 bytes smaller than Terser.
- `score-label`: tied with Terser.

This is enough to validate the experimental harness and justify the next iteration: add LLM-generated candidate rewrites behind the same validation interface, then broaden the benchmark corpus.

## Experiment Log

- Date: 2026-04-30.
- Command: `npm run experiment`.
- Corpus: three hand-written CommonJS fixtures with JSON test cases.
- Candidate generator: deterministic AST rewrite rules standing in for a future LLM.
- Validator: differential execution of original and candidate exports in Node's VM.
- Selector: smallest Terser output among verified candidates.

## Observations

- The harness correctly accepted only candidates that preserved the fixture-level behavior.
- Two fixtures improved over Terser: `assignment-choice` by 10 raw bytes and `boolean-normalize` by 13 raw bytes.
- Aggregate size moved from 476 Terser bytes to 453 semantic bytes, a 23-byte raw win.
- Aggregate Brotli moved from 308 bytes to 293 bytes, a 15-byte win.

## Limitations

- The corpus was intentionally tiny and shaped around the rewrite rules.
- The original `boolean-comparison` rewrite is not semantics-preserving for arbitrary JavaScript values, so it cannot be used on real projects without type proof.
- The result validates the pipeline architecture more than it validates semantic compression on production code.

## Next Action

Move to pinned real-world artifacts and remove rules that need stronger type assumptions.
