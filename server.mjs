import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { cwd } from "node:process";

const root = cwd();
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function developmentHeaders(contentType) {
  return {
    "cache-control": "no-store, max-age=0",
    "content-type": contentType,
  };
}

function resolvePaths(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const relativePath = cleanPath.replace(/^[/\\]+/, "");
  const paths = [
    normalize(join(root, relativePath)),
    normalize(join(root, "public", relativePath)),
  ];
  if (paths.some((filePath) => !filePath.startsWith(root))) {
    throw new Error("Forbidden");
  }
  return paths;
}

const server = createServer(async (req, res) => {
  try {
    const candidates = resolvePaths(req.url || "/");
    let filePath = candidates[0];
    let data = null;
    for (const candidate of candidates) {
      try {
        data = await readFile(candidate);
        filePath = candidate;
        break;
      } catch {}
    }
    if (!data) throw new Error("Not found");
    res.writeHead(
      200,
      developmentHeaders(
        mimeTypes[extname(filePath)] || "text/plain; charset=utf-8",
      ),
    );
    res.end(data);
  } catch {
    try {
      const fallback = await readFile(join(root, "index.html"));
      res.writeHead(
        200,
        developmentHeaders("text/html; charset=utf-8"),
      );
      res.end(fallback);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  }
});

server.listen(port, () => {
  console.log(`CuanSync running at http://localhost:${port}`);
});
