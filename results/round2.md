# Round 2 Results

Corpus: pinned artifacts from privatenumber/minification-benchmarks.

Validation note: this round verifies parseability/minifiability of rewritten artifacts. Full upstream artifact tests are future work.

Generated at 2026-04-30T17:10:45.265Z.

| benchmark | version | originalBytes | terserBytes | bestSemanticRule | bestSemanticBytes | deltaBytesVsTerser | terserGzipBytes | bestSemanticGzipBytes | deltaGzipVsTerser | candidates | syntaxValidCandidates | totalLatencyMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| antd | 4.16.1 | 6686316 | 2244767 | terser | 2244767 | 0 | 460373 | 460373 | 0 | 3 | 3 | 24799.5 |
| d3 | 6.3.1 | 555767 | 267417 | terser | 267417 | 0 | 88292 | 88292 | 0 | 0 | 0 | 2546.13 |
| echarts | 5.1.1 | 3196331 | 998457 | terser | 998457 | 0 | 322345 | 322345 | 0 | 0 | 0 | 8430.55 |
| jquery | 3.5.1 | 287630 | 89244 | terser | 89244 | 0 | 30938 | 30938 | 0 | 0 | 0 | 724.6 |
| lodash | 4.17.21 | 544098 | 70788 | terser | 70788 | 0 | 25228 | 25228 | 0 | 0 | 0 | 976.1 |
| moment | 2.29.1 | 173902 | 59010 | if-assignment | 58999 | -11 | 18745 | 18739 | -6 | 3 | 3 | 782.78 |
| react | 17.0.2 | 72141 | 23052 | if-assignment | 23047 | -5 | 8259 | 8257 | -2 | 3 | 3 | 309.62 |
| terser | 5.30.3 | 1009635 | 456625 | terser | 456625 | 0 | 123721 | 123721 | 0 | 0 | 0 | 2624.34 |
| three | 0.124.0 | 1247235 | 653273 | if-assignment | 653200 | -73 | 159746 | 159731 | -15 | 4 | 4 | 7701.17 |
| victory | 35.8.4 | 2135330 | 712882 | terser | 712882 | 0 | 159314 | 159314 | 0 | 4 | 4 | 10597.93 |
| vue | 2.6.12 | 342147 | 116604 | combined:if-return+if-assignment | 116553 | -51 | 42955 | 42963 | 8 | 3 | 3 | 1808.26 |
