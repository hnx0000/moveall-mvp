import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createCourseApi } from './course-api.mjs';

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 8095);
const host = process.env.HOST || "127.0.0.1";
const courseApi = createCourseApi(new URL('./.data/', import.meta.url));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || host}`);
    if (await courseApi(request, response, requestUrl)) return;
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    if (decodedPath.split('/').some(part => part.startsWith('.'))) { response.writeHead(403); response.end('Forbidden'); return; }
    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
    const candidate = normalize(join(root, relativePath));

    if (!candidate.startsWith(root)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(candidate);
    const filePath = fileStat.isDirectory() ? join(candidate, "index.html") : candidate;
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`GROOV Korea 2.5D Map MVP: http://${host}:${port}/`);
});
