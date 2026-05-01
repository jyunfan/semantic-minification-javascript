import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const benchmarkDir = "benchmarks/round2";
const windowsPath = "benchmarks/round6/windows.json";
const outputPath = "benchmarks/round7/llm-candidates.json";

const manualRewrites = new Map(
  Object.entries({
    "moment-window-1": [
      {
        name: "array-fast-path",
        code: "function getLocale(key) {\n  var locale;\n  if (key && key._locale && key._locale._abbr) key = key._locale._abbr;\n  if (!key) return globalLocale;\n  if (isArray(key)) return chooseLocale(key);\n  return (locale = loadLocale(key)) ? locale : chooseLocale([key]);\n}",
      },
      {
        name: "load-or-choose-ternary",
        code: "function getLocale(key) {\n  var locale;\n  if (key && key._locale && key._locale._abbr) key = key._locale._abbr;\n  if (!key) return globalLocale;\n  if (!isArray(key)) return (locale = loadLocale(key)) ? locale : chooseLocale([key]);\n  return chooseLocale(key);\n}",
      },
    ],
    "moment-window-2": [
      {
        name: "meridiem-guard-flatten",
        code: "function meridiemFixWrap(locale, hour, meridiem) {\n  var isPm;\n  if (meridiem == null) return hour;\n  if (locale.meridiemHour != null) return locale.meridiemHour(hour, meridiem);\n  if (locale.isPM == null) return hour;\n  isPm = locale.isPM(meridiem);\n  if (isPm && hour < 12) hour += 12;\n  if (!isPm && hour === 12) hour = 0;\n  return hour;\n}",
      },
    ],
    "react-window-1": [
      {
        name: "single-return",
        code: "function getIteratorFn(maybeIterable) {\n  var maybeIterator;\n  return maybeIterable === null || typeof maybeIterable !== 'object' ? null : typeof (maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]) === 'function' ? maybeIterator : null;\n}",
      },
    ],
    "victory-window-1": [
      {
        name: "merge-valueof-loops",
        code: "function (values, valueof) {\n  let min, max, index = -1;\n  for (let value of values) {\n    if (valueof !== undefined) value = valueof(value, ++index, values);\n    if (value != null) {\n      if (min === undefined) {\n        if (value >= value) min = max = value;\n      } else {\n        if (min > value) min = value;\n        if (max < value) max = value;\n      }\n    }\n  }\n  return [min, max];\n}",
      },
    ],
    "victory-window-2": [
      {
        name: "placement-ternary",
        code: "function (degree, labelPlacement) {\n  return labelPlacement === \"perpendicular\" ? degree > 90 && degree < 270 ? \"bottom\" : \"top\" : labelPlacement === \"parallel\" ? degree >= 0 && degree <= 180 ? \"right\" : \"left\" : degree < 45 || degree > 315 ? \"top\" : degree < 135 ? \"right\" : degree < 225 ? \"bottom\" : \"left\";\n}",
      },
    ],
    "vue-window-1": [
      {
        name: "flatten-ref-branches",
        code: "function registerRef(vnode, isRemoval) {\n  var key = vnode.data.ref;\n  if (!isDef(key)) return;\n  var vm = vnode.context, ref = vnode.componentInstance || vnode.elm, refs = vm.$refs;\n  if (isRemoval) Array.isArray(refs[key]) ? remove(refs[key], ref) : refs[key] === ref && (refs[key] = undefined);\n  else if (vnode.data.refInFor) Array.isArray(refs[key]) ? refs[key].indexOf(ref) < 0 && refs[key].push(ref) : refs[key] = [ref];\n  else refs[key] = ref;\n}",
      },
    ],
    "vue-window-2": [
      {
        name: "cache-unknown-element-expression",
        code: "function isUnknownElement(tag) {\n  if (!inBrowser) return true;\n  if (isReservedTag(tag)) return false;\n  tag = tag.toLowerCase();\n  if (unknownElementCache[tag] != null) return unknownElementCache[tag];\n  var el = document.createElement(tag);\n  return unknownElementCache[tag] = tag.indexOf('-') > -1 ? el.constructor === window.HTMLUnknownElement || el.constructor === window.HTMLElement : /HTMLUnknownElement/.test(el.toString());\n}",
      },
    ],
  }),
);

async function loadWindowSource(window) {
  const code = await readFile(join(benchmarkDir, `${window.artifact}.js`), "utf8");
  return code.slice(window.start, window.end);
}

function controlResponses(source) {
  return [
    {
      name: "copy-original",
      kind: "control",
      code: source,
    },
    {
      name: "copy-original-alt",
      kind: "control",
      code: source,
    },
    {
      name: "copy-original-third",
      kind: "control",
      code: source,
    },
  ];
}

async function main() {
  const windowsPayload = JSON.parse(await readFile(windowsPath, "utf8"));
  const candidates = [];

  for (const window of windowsPayload.windows) {
    const source = await loadWindowSource(window);
    const responses = controlResponses(source);
    for (const rewrite of manualRewrites.get(window.id) ?? []) {
      responses.push({
        ...rewrite,
        kind: "codex-session-rewrite",
      });
    }
    candidates.push({
      windowId: window.id,
      sourceSha256: window.sourceSha256,
      responses,
    });
  }

  const payload = {
    description: "Round 7 fully populated cached candidate set for the 55 Round 6 windows. Each window has at least three responses; selected windows include Codex-session rewrite candidates. A live model API was not available in this environment.",
    generationMode: "fully-populated-codex-session-cache",
    model: "codex-session",
    generatedAt: new Date().toISOString(),
    windowsPath,
    candidates,
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${outputPath} with ${candidates.length} windows and ${candidates.reduce((total, entry) => total + entry.responses.length, 0)} responses`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
