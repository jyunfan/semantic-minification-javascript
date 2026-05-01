# Round 7 Results

Corpus: the 55 Round 6 windows, now with at least three cached responses per window.

Windows: benchmarks/round6/windows.json
Candidate source: benchmarks/round7/llm-candidates.json
Candidate generation mode: fully-populated-codex-session-cache
Candidate model: codex-session

Execution mode: hybrid Brotli-first selection among Terser, Round 3 deterministic semantic output, and fully populated cached LLM-window candidates.

Validation note: LLM-window candidates validate source-window hash, Terser minifiability, and post-minify syntax. Upstream behavioral tests are not run.

Generated at 2026-04-30T18:49:34.064Z.

## Summary

- Artifacts: 11
- Windows: 55
- Model candidates: 173
- Syntax-valid model candidates: 173
- Rejected model candidates: 0
- Beat Terser by Brotli: 4
- Beat Round 3 by Brotli: 3
- Aggregate delta vs Terser: raw -181, gzip -36, Brotli -217
- Aggregate delta vs Round 3: raw -41, gzip -21, Brotli -99

## Hybrid Comparison

| benchmark | version | windows | modelCandidates | syntaxValidCandidates | round3Rule | bestLlmCandidate | bestLlmDeltaBrotliVsTerser | bestHybridSource | bestHybridCandidate | beatsTerserBrotli | beatsRound3Brotli | deltaBytesVsTerser | deltaGzipVsTerser | deltaBrotliVsTerser | deltaBytesVsRound3 | deltaGzipVsRound3 | deltaBrotliVsRound3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| antd | 4.16.1 | 5 | 15 | 15 | terser | antd-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| d3 | 6.3.1 | 5 | 15 | 15 | terser | d3-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| echarts | 5.1.1 | 5 | 15 | 15 | terser | echarts-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| jquery | 3.5.1 | 5 | 15 | 15 | terser | jquery-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| lodash | 4.17.21 | 5 | 15 | 15 | terser | lodash-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| moment | 2.29.1 | 5 | 18 | 18 | if-assignment | moment-window-1:array-fast-path | -76 | llm-window | moment-window-1:array-fast-path | true | true | -17 | -2 | -76 | -6 | 4 | -13 |
| react | 17.0.2 | 5 | 16 | 16 | if-assignment | react-window-1:copy-original | 0 | round3 | if-assignment | true | false | -5 | -2 | -5 | 0 | 0 | 0 |
| terser | 5.30.3 | 5 | 15 | 15 | terser | terser-window-1:copy-original | 0 | terser | terser | false | false | 0 | 0 | 0 | 0 | 0 | 0 |
| three | 0.124.0 | 5 | 15 | 15 | if-assignment | three-window-1:copy-original | 0 | round3 | if-assignment | true | false | -73 | -15 | -99 | 0 | 0 | 0 |
| victory | 35.8.4 | 5 | 17 | 17 | terser | victory-window-1:merge-valueof-loops | -37 | llm-window | victory-window-1:merge-valueof-loops | true | true | -86 | -17 | -37 | -86 | -17 | -37 |
| vue | 2.6.12 | 5 | 17 | 17 | combined:if-return+if-assignment | vue-window-1:copy-original | 0 | terser | terser | false | true | 0 | 0 | 0 | 51 | -8 | -49 |

## Improved LLM Rewrite Samples

### moment-window-1:array-fast-path

Brotli delta vs Terser: -76. Brotli delta vs Round 3: -13.

Before:

```js
function getLocale(key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }
```

After:

```js
function getLocale(key) {
  var locale;
  if (key && key._locale && key._locale._abbr) key = key._locale._abbr;
  if (!key) return globalLocale;
  if (isArray(key)) return chooseLocale(key);
  return (locale = loadLocale(key)) ? locale : chooseLocale([key]);
}
```

### victory-window-1:merge-valueof-loops

Brotli delta vs Terser: -37. Brotli delta vs Round 3: -37.

Before:

```js
function(values, valueof) {
  let min;
  let max;
  if (valueof === undefined) {
    for (const value of values) {
      if (value != null) {
        if (min === undefined) {
          if (value >= value) min = max = value;
        } else {
          if (min > value) min = value;
          if (max < value) max = value;
        }
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null) {
        if (min === undefined) {
          if (value >= value) min = max = value;
        } else {
          if (min > value) min = value;
          if (max < value) max = value;
        }
      }
    }
  }
  return [min, max];
}
```

After:

```js
function (values, valueof) {
  let min, max, index = -1;
  for (let value of values) {
    if (valueof !== undefined) value = valueof(value, ++index, values);
    if (value != null) {
      if (min === undefined) {
        if (value >= value) min = max = value;
      } else {
        if (min > value) min = value;
        if (max < value) max = value;
      }
    }
  }
  return [min, max];
}
```

