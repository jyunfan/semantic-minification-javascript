# Round 6 Experiment: Hybrid Brotli-First Selection

## Goal

Test the hybrid strategy suggested by Round 5: sample multiple windows per artifact, evaluate cached model candidates, and choose the best output among Terser, deterministic semantic rewrites from Round 3, and LLM-window rewrites using Brotli-first scoring.

## Method

Round 6 uses:

- `scripts/select-round6-windows.js` to select five function windows per artifact.
- `scripts/seed-round6-candidates.js` to seed multiple cached responses for each selected window.
- `scripts/run-round6-experiment.js` to compare Terser, Round 3, and LLM-window candidates.

The window selector uses the same scoring policy as Round 5 but keeps the top five windows per artifact.

Because no live model API key is configured, most seeded responses are conservative copy controls. Rank-1 windows also carry forward the Codex-generated Round 5 rewrites where available. This lets the hybrid scorer be tested without pretending that a full live model generation pass occurred.

## Validation Status

LLM-window candidates validate source-window hash, Terser minifiability, and post-minify syntax. Round 3 metrics are imported from `results/round3.json`. Upstream behavioral tests are still future work.

## Commands

```sh
npm run select:round6
npm run seed:round6
npm run experiment:round6
```

## First Run

- Date: 2026-05-01.
- Artifacts: 11.
- Selected windows: 55.
- Cached model candidates: 121.
- Syntax-valid model candidates: 121.
- Rejected model candidates: 0.
- Beat Terser by Brotli: 4 artifacts.
- Beat Round 3 by Brotli: 3 artifacts.

Aggregate Round 6 hybrid deltas:

- Versus Terser: raw -181 bytes, gzip -36 bytes, Brotli -217 bytes.
- Versus Round 3: raw -41 bytes, gzip -21 bytes, Brotli -99 bytes.

## Observations

- The hybrid selector chose LLM-window candidates for `moment` and `victory`.
- It preserved Round 3 deterministic wins for `react` and `three`.
- It chose plain Terser for `vue` because Round 3's raw-byte win made Brotli 49 bytes worse.
- This is the first round that beats Round 3 in aggregate across raw, gzip, and Brotli.
- Most Round 6 cached responses are copy controls, so the improvement comes from hybrid selection plus the carried-forward Codex rewrites, not from a broad fresh model-generation sweep.

## Conclusion

The useful architecture is hybrid, not LLM-only. Round 6 confirms that the selector should compare Terser, deterministic semantic rewrites, and model-generated local rewrites under the same compressed-size objective. It also confirms that the objective should be Brotli-first, because choosing raw-byte wins alone can hurt deployed size.

## Next Action

Replace the seeded copy-control cache with a live or fully generated model cache: multiple real rewrite candidates for all 55 selected windows, then rerun the same hybrid scorer with behavioral validation.
