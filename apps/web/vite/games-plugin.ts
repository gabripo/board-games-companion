import { createReadStream, existsSync, statSync } from "node:fs";
import { cp } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { Connect, Plugin } from "vite";

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Serves the generated game bundles at `<base>games/*` in dev/preview and copies them into the
 * build output. `content` selects dist/games (real, from `pnpm validate`) or
 * dist/fixture-games (synthetic archetypes, from `pnpm fixtures`).
 */
export function gamesPlugin(repoRoot: string, content: "games" | "fixtures"): Plugin {
  const sourceDir = resolve(repoRoot, content === "fixtures" ? "dist/fixture-games" : "dist/games");
  let outDir = "";
  let base = "/";

  const middleware = (
    req: Connect.IncomingMessage,
    res: ServerResponse,
    next: Connect.NextFunction,
  ) => {
    const prefix = `${base}games/`;
    const url = req.url?.split("?")[0];
    if (!url?.startsWith(prefix)) return next();
    const file = normalize(join(sourceDir, decodeURIComponent(url.slice(prefix.length))));
    if (!file.startsWith(sourceDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    createReadStream(file).pipe(res);
  };

  return {
    name: "bgc-games",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    buildStart() {
      if (!existsSync(join(sourceDir, "index.json"))) {
        this.warn(
          `No game bundles in ${sourceDir}. Run \`pnpm ${content === "fixtures" ? "fixtures" : "validate"}\`.`,
        );
      }
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    async closeBundle() {
      if (existsSync(sourceDir)) await cp(sourceDir, join(outDir, "games"), { recursive: true });
    },
  };
}
