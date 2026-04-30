import { mkdir, cp, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

export const round2Artifacts = [
  { name: "react", version: "17.0.2", filePath: "cjs/react.development.js" },
  { name: "moment", version: "2.29.1", filePath: "moment.js" },
  { name: "jquery", version: "3.5.1", filePath: "dist/jquery.js" },
  { name: "vue", version: "2.6.12", filePath: "dist/vue.js" },
  { name: "lodash", version: "4.17.21", filePath: "lodash.js" },
  { name: "d3", version: "6.3.1", filePath: "dist/d3.js" },
  { name: "terser", version: "5.30.3", filePath: "dist/bundle.min.js" },
  { name: "three", version: "0.124.0", filePath: "build/three.js" },
  { name: "victory", version: "35.8.4", filePath: "dist/victory.js" },
  { name: "echarts", version: "5.1.1", filePath: "dist/echarts.js" },
  { name: "antd", version: "4.16.1", filePath: "dist/antd.js" },
];

const cacheDir = "benchmark-cache/round2";
const sourceDir = join(cacheDir, "node_modules");
const artifactDir = "benchmarks/round2";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function main() {
  await mkdir(cacheDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });

  const packages = round2Artifacts.map(({ name, version }) => `${name}@${version}`);
  await run("npm", [
    "install",
    "--prefix",
    cacheDir,
    "--ignore-scripts",
    "--legacy-peer-deps",
    "--no-audit",
    "--no-fund",
    ...packages,
  ]);

  for (const artifact of round2Artifacts) {
    const source = join(sourceDir, artifact.name, artifact.filePath);
    const target = join(artifactDir, `${artifact.name}.js`);
    await rm(target, { force: true });
    await cp(source, target);
  }

  console.log(`Fetched ${round2Artifacts.length} artifacts into ${artifactDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
