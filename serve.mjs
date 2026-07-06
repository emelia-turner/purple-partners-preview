import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = join(import.meta.dirname, "dist");
const PORT = process.env.PORT || 4173;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".webp": "image/webp", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split("?")[0]);
  if (path === "/") path = "/index.html";
  let filePath = join(ROOT, path);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    filePath += ".html"; // allow /tools instead of /tools.html
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": TYPES[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found: " + path);
  }
}).listen(PORT, () => console.log(`Serving dist/ at http://localhost:${PORT}`));
