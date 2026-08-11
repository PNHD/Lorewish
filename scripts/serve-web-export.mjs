import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT ?? 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function resolveRequestPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const candidate = join(root, relative);
  if (!candidate.startsWith(root)) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) return join(candidate, "index.html");
  if (existsSync(candidate)) return candidate;
  const htmlCandidate = `${candidate}.html`;
  if (existsSync(htmlCandidate)) return htmlCandidate;
  const dynamicRoutes = [
    { pattern: /^play\/[^/]+\/characters\/[^/]+\/?$/, file: "play/[runId]/characters/[characterId].html" },
    { pattern: /^play\/[^/]+\/characters\/?$/, file: "play/[runId]/characters.html" },
    { pattern: /^play\/[^/]+\/?$/, file: "play/[runId].html" },
  ];
  const dynamic = dynamicRoutes.find((route) => route.pattern.test(relative.replace(/\\/g, "/")));
  if (!dynamic) return null;
  const dynamicPath = join(root, dynamic.file);
  return existsSync(dynamicPath) ? dynamicPath : null;
}

createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
  const filePath = resolveRequestPath(pathname);
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Serving ${root} at http://127.0.0.1:${port}\n`);
});
