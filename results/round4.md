# Round 4 Results

Corpus: selected source windows from pinned real-project artifacts used in Round 2.

Candidate source: benchmarks/round4/llm-candidates.json
Candidate generation mode: manual-cache-from-codex-session
Candidate model: codex-session

Execution mode: cached LLM-generated direct JavaScript rewrites; each response is spliced into the original artifact, minified by Terser, syntax-checked, and scored by Brotli first.

Validation note: this round does not run upstream behavioral test suites. It validates source-window hash, Terser minifiability, and post-minify syntax only.

Generated at 2026-04-30T17:48:08.839Z.

## Summary

- Windows: 6
- Model candidates: 6
- Syntax-valid candidates: 6
- Accepted by Brotli: 3
- Aggregate raw delta vs Terser baselines: -21
- Aggregate gzip delta vs Terser baselines: -4
- Aggregate Brotli delta vs Terser baselines: -68

## Candidate Windows

| id | benchmark | version | sourceWindowBytes | modelCandidates | syntaxValidCandidates | bestCandidate | acceptedByBrotli | deltaBytesVsTerser | deltaGzipVsTerser | deltaBrotliVsTerser | latencyMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| react-getIteratorFn-single-return | react | 17.0.2 | 348 | 1 | 1 | terser | false | 0 | 0 | 0 | 199.73 |
| react-stack-conditional-concat | react | 17.0.2 | 368 | 1 | 1 | conditional-concat | true | -17 | -6 | -5 | 62.85 |
| moment-isObjectEmpty-early-fallback | moment | 2.29.1 | 350 | 1 | 1 | early-fallback | true | -2 | 2 | -57 | 354.56 |
| vue-makeMap-shared-return | vue | 2.6.12 | 331 | 1 | 1 | terser | false | 0 | 0 | 0 | 726.21 |
| vue-remove-flat | vue | 2.6.12 | 166 | 1 | 1 | flat-index-test | true | -2 | 0 | -6 | 319.98 |
| vue-looseIndexOf-one-line | vue | 2.6.12 | 149 | 1 | 1 | terser | false | 0 | 0 | 0 | 341.48 |
