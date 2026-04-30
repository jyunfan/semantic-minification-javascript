# Round 3 Results

Corpus: pinned artifacts from privatenumber/minification-benchmarks.

Prompt policy: PROMPT.md
Prompt SHA-256: 101a11f1e658d160c405967c95f5a1df7b83badf0a2dcfbba130d198adb5605f

Execution mode: local deterministic semantic rewrites derived from PROMPT.md; no API or LLM call.

Validation note: this round verifies parseability/minifiability of rewritten artifacts. Full upstream artifact tests are future work.

Generated at 2026-04-30T17:34:22.469Z.

| benchmark | version | terserBytes | bestSemanticRule | bestSemanticBytes | deltaBytesVsTerser | improvementPct | terserGzipBytes | bestSemanticGzipBytes | deltaGzipVsTerser | gzipImprovementPct | candidates | syntaxValidCandidates | totalLatencyMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| antd | 4.16.1 | 2244767 | terser | 2244767 | 0 | 0 | 460373 | 460373 | 0 | 0 | 3 | 3 | 23841.34 |
| d3 | 6.3.1 | 267417 | terser | 267417 | 0 | 0 | 88292 | 88292 | 0 | 0 | 0 | 0 | 2457.7 |
| echarts | 5.1.1 | 998457 | terser | 998457 | 0 | 0 | 322345 | 322345 | 0 | 0 | 0 | 0 | 7928.27 |
| jquery | 3.5.1 | 89244 | terser | 89244 | 0 | 0 | 30938 | 30938 | 0 | 0 | 0 | 0 | 697.9 |
| lodash | 4.17.21 | 70788 | terser | 70788 | 0 | 0 | 25228 | 25228 | 0 | 0 | 0 | 0 | 915.17 |
| moment | 2.29.1 | 59010 | if-assignment | 58999 | -11 | 0.0186 | 18745 | 18739 | -6 | 0.032 | 3 | 3 | 721.58 |
| react | 17.0.2 | 23052 | if-assignment | 23047 | -5 | 0.0217 | 8259 | 8257 | -2 | 0.0242 | 3 | 3 | 265.65 |
| terser | 5.30.3 | 456625 | terser | 456625 | 0 | 0 | 123721 | 123721 | 0 | 0 | 0 | 0 | 2478.22 |
| three | 0.124.0 | 653273 | if-assignment | 653200 | -73 | 0.0112 | 159746 | 159731 | -15 | 0.0094 | 4 | 4 | 7134.63 |
| victory | 35.8.4 | 712882 | terser | 712882 | 0 | 0 | 159314 | 159314 | 0 | 0 | 4 | 4 | 9864.78 |
| vue | 2.6.12 | 116604 | combined:if-return+if-assignment | 116553 | -51 | 0.0437 | 42955 | 42963 | 8 | -0.0186 | 3 | 3 | 1666.12 |
