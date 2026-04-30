# Round 6 Results

Corpus: five deterministically selected source windows from each pinned Round 2 artifact.

Windows: benchmarks/round6/windows.json
Candidate source: benchmarks/round6/llm-candidates.json
Candidate generation mode: seeded-cache-from-round5-and-controls
Candidate model: codex-session

Execution mode: hybrid Brotli-first selection among Terser, Round 3 deterministic semantic output, and cached LLM-window candidates.

Validation note: LLM-window candidates validate source-window hash, Terser minifiability, and post-minify syntax. Round 3 metrics are imported from `results/round3.json`.

Generated at 2026-04-30T18:31:10.918Z.

## Summary

- Artifacts: 11
- Windows: 55
- Model candidates: 121
- Syntax-valid model candidates: 121
- Rejected model candidates: 0
- Beat Terser by Brotli: 4
- Beat Round 3 by Brotli: 3
- Aggregate delta vs Terser: raw -181, gzip -36, Brotli -217
- Aggregate delta vs Round 3: raw -41, gzip -21, Brotli -99

## Hybrid Comparison

| benchmark | version | windows | modelCandidates | syntaxValidCandidates | round3Rule | bestLlmCandidate | bestLlmDeltaBrotliVsTerser | bestHybridSource | bestHybridCandidate | beatsTerserBrotli | beatsRound3Brotli | deltaBytesVsTerser | deltaGzipVsTerser | deltaBrotliVsTerser | deltaBytesVsRound3 | deltaGzipVsRound3 | deltaBrotliVsRound3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| antd | 4.16.1 | 5 | 11 | 11 | terser | antd-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| d3 | 6.3.1 | 5 | 11 | 11 | terser | d3-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| echarts | 5.1.1 | 5 | 11 | 11 | terser | echarts-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| jquery | 3.5.1 | 5 | 11 | 11 | terser | jquery-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| lodash | 4.17.21 | 5 | 11 | 11 | terser | lodash-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| moment | 2.29.1 | 5 | 11 | 11 | if-assignment | moment-window-1:round5-array-fast-path | -76 | llm-window | moment-window-1:round5-array-fast-path | true | true | -17 | -2 | -76 | -6 | 4 | -13 |
| react | 17.0.2 | 5 | 11 | 11 | if-assignment | react-window-1:copy-original | 0 | round3 | if-assignment | true | false | -5 | -2 | -5 | 0 | 0 | 0 |
| terser | 5.30.3 | 5 | 11 | 11 | terser | terser-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| three | 0.124.0 | 5 | 11 | 11 | if-assignment | three-window-1:copy-original | 0 | round3 | if-assignment | true | false | -73 | -15 | -99 | 0 | 0 | 0 |
| victory | 35.8.4 | 5 | 11 | 11 | terser | victory-window-1:round5-merge-valueof-loops | -37 | llm-window | victory-window-1:round5-merge-valueof-loops | true | true | -86 | -17 | -37 | -86 | -17 | -37 |
| vue | 2.6.12 | 5 | 11 | 11 | combined:if-return+if-assignment | vue-window-1:copy-original | 0 | terser | terser | false | true | 0 | 0 | 0 | 51 | -8 | -49 |
