# Round 5 Results

Corpus: one deterministically selected source window from each pinned Round 2 artifact.

Windows: benchmarks/round5/windows.json
Candidate source: benchmarks/round5/llm-candidates.json
Candidate generation mode: manual-cache-from-codex-session
Candidate model: codex-session

Execution mode: cached LLM-generated window rewrites; each response is spliced into the original artifact, minified by Terser, syntax-checked, scored by Brotli first, then compared with Round 3.

Validation note: this round validates source-window hash, Terser minifiability, and post-minify syntax. It does not run upstream behavioral tests.

Generated at 2026-04-30T18:12:30.166Z.

## Summary

- Artifacts: 11
- Model candidates: 11
- Syntax-valid candidates: 11
- Accepted by Brotli vs Terser: 2
- Beat Round 3 by Brotli: 3
- Aggregate delta vs Terser: raw -103, gzip -19, Brotli -113
- Aggregate delta vs Round 3: raw 37, gzip -4, Brotli 5

## Artifact Comparison

| benchmark | version | windowScore | sourceWindowBytes | features | round3Rule | bestCandidate | acceptedByBrotliVsTerser | beatsRound3Brotli | deltaBytesVsTerser | deltaGzipVsTerser | deltaBrotliVsTerser | deltaBytesVsRound3 | deltaGzipVsRound3 | deltaBrotliVsRound3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| antd | 4.16.1 | 53 | 588 | if+return+conditional | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| d3 | 6.3.1 | 68 | 640 | if+return+conditional+else+logical | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| echarts | 5.1.1 | 39 | 389 | if+return+else | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| jquery | 3.5.1 | 48 | 353 | if+return | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| lodash | 4.17.21 | 49 | 658 | if+return+logical | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| moment | 2.29.1 | 34 | 471 | if+return+else+logical | if-assignment | array-fast-path | true | true | -17 | -2 | -76 | -6 | 4 | -13 |
| react | 17.0.2 | 23 | 348 | if+return+logical | if-assignment | terser | false | false | 0 | 0 | 0 | 5 | 2 | 5 |
| terser | 5.30.3 | 68 | 618 | if+return+else+logical | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| three | 0.124.0 | 53 | 459 | if+return+else | if-assignment | terser | false | false | 0 | 0 | 0 | 73 | 15 | 99 |
| victory | 35.8.4 | 60 | 700 | if+return+else | terser | merge-valueof-loops | true | true | -86 | -17 | -37 | -86 | -17 | -37 |
| vue | 2.6.12 | 48 | 673 | if+return+else+logical | combined:if-return+if-assignment | terser | false | true | 0 | 0 | 0 | 51 | -8 | -49 |
