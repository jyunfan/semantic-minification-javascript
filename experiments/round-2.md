# Round 2 Experiment: Real Minifier Benchmark Artifacts

## Goal

Move beyond toy fixtures by evaluating the semantic-rewrite-plus-Terser pipeline on pinned real-world artifacts from `privatenumber/minification-benchmarks`.

## Corpus

Round 2 uses the same package/file choices as the external benchmark suite:

- `react@17.0.2`: `cjs/react.development.js`
- `moment@2.29.1`: `moment.js`
- `jquery@3.5.1`: `dist/jquery.js`
- `vue@2.6.12`: `dist/vue.js`
- `lodash@4.17.21`: `lodash.js`
- `d3@6.3.1`: `dist/d3.js`
- `terser@5.30.3`: `dist/bundle.min.js`
- `three@0.124.0`: `build/three.js`
- `victory@35.8.4`: `dist/victory.js`
- `echarts@5.1.1`: `dist/echarts.js`
- `antd@4.16.1`: `dist/antd.js`

Artifacts are fetched with:

```sh
npm run fetch:round2
```

## Comparison

For each artifact:

```text
baseline = Terser(original)
candidate = Terser(semantic_rewrite(original))
```

The experiment records raw bytes, gzip bytes, Brotli bytes, generated candidate count, accepted candidate count, and latency.

## Rewrite Policy

Round 2 uses only conservative AST rewrites:

- `cond ? true : false -> !!cond`
- `cond ? false : true -> !cond`
- `if (...) return ...; else return ...; -> return ... ? ... : ...`
- `if (...) x = ...; else x = ...; -> x = ... ? ... : ...`

The earlier `x === true -> x` rewrite is intentionally excluded because it is not semantics-preserving for arbitrary non-boolean values.

## Validation Status

This round verifies that rewritten artifacts parse and can be minified by Terser. Full behavioral validation using the upstream benchmark's artifact tests is future work.

## First Run

Command:

```sh
npm run experiment:round2
```

Results are written to `results/round2.json` and `results/round2.md`.

Initial raw-byte wins over Terser-only:

- `moment`: 11 bytes smaller.
- `react`: 5 bytes smaller.
- `three`: 73 bytes smaller.
- `vue`: 51 bytes smaller.

Gzip results are mixed: `moment`, `react`, and `three` improve slightly, while `vue` becomes 8 gzip bytes larger. This suggests raw-byte improvement should not be treated as sufficient evidence for deployed transfer-size improvement.

## Experiment Log

- Date: 2026-04-30.
- Command: `npm run experiment:round2`.
- Corpus: eleven pinned artifacts from `privatenumber/minification-benchmarks`.
- Candidate generator: conservative deterministic AST rules in `scripts/semantic-rewriter.js`.
- Validator: Babel parseability after Terser minification.
- Selector: smallest raw Terser output among syntax-valid candidates.

## Observations

- Aggregate size moved from 5,692,119 Terser bytes to 5,691,979 semantic bytes, a 140-byte raw win.
- Aggregate gzip moved from 1,439,916 bytes to 1,439,901 bytes, a 15-byte win.
- Aggregate Brotli moved from 1,162,495 bytes to 1,162,377 bytes, a 118-byte win.
- Only four artifacts produced selected wins: `moment`, `react`, `three`, and `vue`.
- Several large artifacts either generated no candidates or generated candidates that Terser already normalized back to the baseline.

## Diagnostics

- `results/round2.json` records rewrite errors for `echarts`, `jquery`, `lodash`, and `terser`; the markdown table does not expose that field.
- The errors are caused by converting bare `return;` statements into conditional expressions with missing branches.
- The `if-assignment` rule is not always order-preserving for member-expression assignment targets because JavaScript evaluates the left-hand reference before the right-hand side.

## Limitations

- Full upstream behavioral validation was not run.
- The selector optimized raw minified bytes even though gzip and Brotli are the deployment-relevant metrics.
- The rule set mostly overlaps with transformations Terser can already perform.

## Next Action

Treat local deterministic rules as a baseline, then try LLM-generated direct rewrites on small real-project regions while keeping deterministic validation and compressed-size scoring.
