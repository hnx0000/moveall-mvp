import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const media = path.resolve(root, "../../apps/mobile/assets/images");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    try {
      const url = new URL(req.url, "http://localhost");
      const mediaRequest = url.pathname.startsWith("/media/");
      const base = mediaRequest ? media : root;
      const name = decodeURIComponent(
        mediaRequest
          ? url.pathname.slice(7)
          : url.pathname === "/"
            ? "index.html"
            : url.pathname.slice(1),
      );
      const file = path.resolve(base, name);
      if (!file.startsWith(base + path.sep) || !types[path.extname(file)]) {
        res.writeHead(404).end();
        return;
      }
      const content = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(8092, "127.0.0.1", () => console.log("GROOV Tab Lab → http://localhost:8092"));
