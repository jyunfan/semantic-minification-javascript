# Round 5 Experiment: Full-Corpus LLM Window Sampling

## Goal

Make the LLM-window experiment comparable with Round 3 by sampling at least one rewrite window from every real-project artifact in the pinned corpus.

## Method

Round 5 uses a deterministic window selector:

1. Parse each Round 2 artifact with Babel.
2. Visit complete function nodes.
3. Keep windows between 120 and 700 characters that contain branch syntax.
4. Reject windows containing `eval`, `with`, `Function`, `super`, `yield`, or `await`.
5. Score by branch/return/conditional density.
6. Select the top-ranked window per artifact.

The selected windows are written to `benchmarks/round5/windows.json`.

Cached LLM responses are stored in `benchmarks/round5/llm-candidates.json`. Each response is spliced into the original full artifact, minified with Terser, syntax-checked, scored by Brotli first, and compared with both Terser-only and Round 3.

## Validation Status

This round validates source-window hash, Terser minifiability, and post-minify syntax. It does not run upstream behavioral tests, so accepted candidates are compression signals only.

## Commands

```sh
npm run select:round5
npm run experiment:round5
```

## First Run

- Date: 2026-05-01.
- Artifacts: 11.
- Selected windows: 1 per artifact.
- Cached model candidates: 11.
- Syntax-valid candidates: 11.
- Accepted by Brotli vs Terser: 2.
- Beat Round 3 by Brotli: 3.

Aggregate Round 5 deltas:

- Versus Terser: raw -103 bytes, gzip -19 bytes, Brotli -113 bytes.
- Versus Round 3: raw +37 bytes, gzip -4 bytes, Brotli +5 bytes.

## Observations

- The full-corpus LLM-window pass found real Brotli wins for `moment` and `victory`.
- The `moment` candidate beat Round 3 by 13 Brotli bytes despite being only 17 raw bytes smaller than Terser.
- The `victory` candidate found an 86 raw byte, 17 gzip byte, and 37 Brotli byte win where Round 3 had no deterministic-rule improvement.
- Several candidates rewrote code into shapes that Terser normalized back to the baseline exactly.
- Some raw/gzip-looking wins were rejected because they made Brotli worse, confirming that Brotli-first selection matters.
- `vue` beat Round 3 by Brotli while selecting `terser`, because Round 3 selected a raw-byte semantic win that worsened compressed size.

## Conclusion

Round 5 gives stronger evidence than Round 4 that LLM direct rewrites can add value on real-project code, but one sampled window per artifact is not enough to beat the deterministic Round 3 baseline in aggregate. The best path is a hybrid selector that considers Terser, deterministic semantic rewrites, and multiple LLM windows per artifact under the same Brotli-first objective.

## Next Action

Increase the deterministic sample to 5-10 windows per artifact, cache multiple model candidates per window, and report a hybrid best-of-all result against Round 3.
