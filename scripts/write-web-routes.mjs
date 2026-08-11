import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const routeShells = [
  { source: "dist/play/[runId].html", target: "dist/__route-shells/story/index.html" },
  { source: "dist/play/[runId]/characters.html", target: "dist/__route-shells/characters/index.html" },
  { source: "dist/play/[runId]/characters/[characterId].html", target: "dist/__route-shells/character-chat/index.html" },
];

for (const shell of routeShells) {
  const target = resolve(shell.target);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(shell.source), target);
}

const redirects = [
  "/play/:runId/characters/:characterId /__route-shells/character-chat/ 200",
  "/play/:runId/characters /__route-shells/characters/ 200",
  "/play/:runId /__route-shells/story/ 200",
  "",
].join("\n");

writeFileSync(resolve("dist/_redirects"), redirects, "utf8");
