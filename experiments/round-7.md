# Round 7 Experiment: Fully Populated Cached LLM Candidates

## Goal

Run the Round 6 hybrid scorer with a fully populated candidate cache: at least three cached responses for every one of the 55 selected windows, plus Codex-session rewrite candidates for selected windows.

## Method

Round 7 reuses `benchmarks/round6/windows.json`:

- 11 artifacts.
- 5 windows per artifact.
- 55 total windows.

`scripts/seed-round7-candidates.js` creates `benchmarks/round7/llm-candidates.json` with at least three responses per window. Because no live model API key is configured in this environment, the cache is labeled as Codex-session generated rather than live API generated.

`scripts/run-round7-experiment.js` uses the same hybrid objective as Round 6:

```text
best of Terser, Round 3 deterministic semantic output, and LLM-window candidates
```

Selection is Brotli-first, then gzip, then raw bytes.

## Validation Status

LLM-window candidates validate source-window hash, Terser minifiability, and post-minify syntax. Upstream behavioral tests are still future work.

## Commands

```sh
npm run seed:round7
npm run experiment:round7
```

## First Run

- Date: 2026-05-01.
- Artifacts: 11.
- Windows: 55.
- Cached model candidates: 173.
- Syntax-valid model candidates: 173.
- Rejected model candidates: 0.
- Beat Terser by Brotli: 4 artifacts.
- Beat Round 3 by Brotli: 3 artifacts.

Aggregate Round 7 hybrid deltas:

- Versus Terser: raw -181 bytes, gzip -36 bytes, Brotli -217 bytes.
- Versus Round 3: raw -41 bytes, gzip -21 bytes, Brotli -99 bytes.

## Observations

- Round 7 reproduced the Round 6 best hybrid result with a more populated candidate cache.
- The best LLM-window candidates remained `moment-window-1:array-fast-path` and `victory-window-1:merge-valueof-loops`.
- Additional cached candidates did not improve the aggregate result beyond Round 6.
- The generated report includes before/after samples for the accepted LLM rewrites.
- The result reinforces that candidate count only helps when the added candidates are meaningfully diverse and compress better after Terser.

## Conclusion

The hybrid scorer is stable, and the report now exposes concrete examples of useful model-style rewrites. However, this round still falls short of a true live model sweep because the cache was produced in-session and many responses are conservative controls. The next measurable improvement requires live or offline batch generation of genuinely diverse candidates for every window.

## Next Action

Add an OpenAI-compatible candidate generation script that fills `benchmarks/round7/llm-candidates.json` from a real model when `OPENAI_API_KEY` is available, while preserving the same cache schema and hybrid scorer.
