import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const benchmarkDir = "benchmarks/round2";
const windowsPath = "benchmarks/round6/windows.json";
const round5CandidatePath = "benchmarks/round5/llm-candidates.json";
const outputPath = "benchmarks/round6/llm-candidates.json";

async function loadWindowSource(window) {
  const code = await readFile(join(benchmarkDir, `${window.artifact}.js`), "utf8");
  return code.slice(window.start, window.end);
}

async function main() {
  const windowsPayload = JSON.parse(await readFile(windowsPath, "utf8"));
  const round5Candidates = JSON.parse(await readFile(round5CandidatePath, "utf8"));
  const round5ByArtifact = new Map(round5Candidates.candidates.map((entry) => [entry.windowId.replace(/-window-\d+$/, ""), entry.responses ?? []]));
  const candidates = [];

  for (const window of windowsPayload.windows) {
    const source = await loadWindowSource(window);
    const responses = [
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
    ];

    if (window.rank === 1 && round5ByArtifact.has(window.artifact)) {
      for (const response of round5ByArtifact.get(window.artifact)) {
        responses.push({
          ...response,
          name: `round5-${response.name}`,
          kind: "cached-codex-rewrite",
        });
      }
    }

    candidates.push({
      windowId: window.id,
      sourceSha256: window.sourceSha256,
      responses,
    });
  }

  const payload = {
    description: "Round 6 cached candidate set. Each selected window has multiple cached responses; most are conservative copy controls because no live model API key is configured. Rank-1 windows also carry forward the Codex-generated Round 5 rewrites when available.",
    generationMode: "seeded-cache-from-round5-and-controls",
    model: "codex-session",
    generatedAt: new Date().toISOString(),
    windowsPath,
    candidates,
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${outputPath} with ${candidates.length} windows`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
