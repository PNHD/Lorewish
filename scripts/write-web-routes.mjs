import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const redirects = [
  "/play/:runId/characters/:characterId /play/[runId]/characters/[characterId].html 200",
  "/play/:runId/characters /play/[runId]/characters.html 200",
  "/play/:runId /play/[runId].html 200",
  "",
].join("\n");

writeFileSync(resolve("dist/_redirects"), redirects, "utf8");
