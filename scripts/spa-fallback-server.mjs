import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "index.html");
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function safePathname(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  return normalized === "/" ? "/index.html" : normalized;
}

createServer(async (req, res) => {
  const pathname = safePathname(req.url || "/");
  const target = path.join(root, pathname);
  try {
    const file = await stat(target);
    if (file.isFile()) {
      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      res.end(await readFile(target));
      return;
    }
  } catch {}

  const ext = path.extname(pathname).toLowerCase();
  if (ext) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(await readFile(indexPath));
}).listen(port, "127.0.0.1", () => {
  console.log(`SPA fallback server listening at http://127.0.0.1:${port}/`);
});
