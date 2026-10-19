import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const designAssets = fileURLToPath(new URL("../Design/assets", import.meta.url));
const designDirectory = fileURLToPath(new URL("../Design", import.meta.url));
const canonicalPageTitles = Object.fromEntries(
  readdirSync(designDirectory)
    .filter((fileName) => fileName.endsWith(".html"))
    .map((fileName) => [
      fileName,
      readFileSync(resolve(designDirectory, fileName), "utf8").match(
        /<title>([^<]+)<\/title>/,
      )?.[1] || "Raccoon",
    ]),
);

function canonicalDesignAssets(): Plugin {
  return {
    name: "canonical-design-assets",
    configureServer(server) {
      server.middlewares.use("/assets", (request, response, next) => {
        const requestedPath = (request.url || "/").split("?")[0];
        const assetPath = resolve(designAssets, `.${requestedPath}`);
        if (
          !assetPath.startsWith(designAssets + sep) ||
          !existsSync(assetPath) ||
          !statSync(assetPath).isFile()
        ) {
          next();
          return;
        }
        const contentType = assetPath.endsWith(".svg")
          ? "image/svg+xml"
          : assetPath.endsWith(".json")
            ? "application/json"
            : "font/woff2";
        response.setHeader("Content-Type", contentType);
        createReadStream(assetPath).pipe(response);
      });
    },
    generateBundle() {
      for (const entry of readdirSync(designAssets, { recursive: true, withFileTypes: true })) {
        if (entry.isFile()) {
          const absolutePath = resolve(entry.parentPath, entry.name);
          const relativePath = absolutePath.slice(designAssets.length + 1).replaceAll("\\", "/");
          this.emitFile({
            type: "asset",
            fileName: `assets/${relativePath}`,
            source: readFileSync(absolutePath),
          });
        }
      }
    },
  };
}

// What the About page reports as this interface's version and build. The version is the package's own;
// the build moment is when this configuration was evaluated — the bundle's build, or the dev server's start.
const interfacePackage = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

export default defineConfig(({ command }) => ({
  define: {
    __CANONICAL_PAGE_TITLES__: JSON.stringify(canonicalPageTitles),
    __RACCOON_BUILD__: JSON.stringify({
      version: interfacePackage.version,
      builtAt: new Date().toISOString(),
      kind: command === "build" ? "bundle" : "development",
    }),
  },
  plugins: [tailwindcss(), react(), canonicalDesignAssets()],
  resolve: {
    // @jmouse/codemirror and @jmouse/markdown are linked from jmouse-ui and would otherwise resolve these through its own
    // node_modules: the same version in two places is two modules, an extension built against one copy
    // is not an instanceof the other's, and CodeMirror refuses the editor ("multiple instances of
    // @codemirror/state"). One copy each, ours.
    dedupe: ["react", "react-dom", "@codemirror/state", "@codemirror/view", "@codemirror/language", "@lezer/common", "@lezer/highlight"],
  },
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(new URL("../Design", import.meta.url)),
        // The linked code package serves its stylesheet from its own directory.
        fileURLToPath(new URL("../../../jmouse-ui/packages/codemirror", import.meta.url)),
        // The linked Markdown renderer, and the dependencies it resolves from the jmouse-ui workspace.
        fileURLToPath(new URL("../../../jmouse-ui/packages/markdown", import.meta.url)),
        // The Library's explorer, the kit it is drawn with, and the decisions about files both of them read.
        fileURLToPath(new URL("../../../jmouse-ui/packages/explorer", import.meta.url)),
        fileURLToPath(new URL("../../../jmouse-ui/packages/ui-kit", import.meta.url)),
        fileURLToPath(new URL("../../../jmouse-ui/packages/file-handling", import.meta.url)),
        fileURLToPath(new URL("../../../jmouse-ui/node_modules", import.meta.url)),
      ],
    },
    // ⚠️ Every interface, not 127.0.0.1: Caddy runs in Docker and reaches this machine through
    // host.docker.internal, which is not loopback — bound to 127.0.0.1 the public name gets "connection refused".
    host: "0.0.0.0",
    // The public name Caddy serves. localhost and IP addresses stay allowed regardless; this only adds.
    allowedHosts: ["raccoon.jmouse.org"],
    port: 5100,
    strictPort: true,
    proxy: {
      "/v1": { target: "http://localhost:8150", changeOrigin: true },
      // The jMouse AI management controllers mount under their own prefix, outside /v1.
      "/jmouse-ai": { target: "http://localhost:8150", changeOrigin: true },
      // ⚠️ The Model Context Protocol's authorization flow, and it has to come through HERE rather than be
      // reached on 8150 directly: the consent screen must run on the SAME ORIGIN as this interface, because
      // that is the only way it can read the session this interface put in localStorage. It cannot live
      // under /jmouse-ai either — AiHttpBoundaryFilter closes that prefix behind system:read/system:write,
      // and /register and /token are reached by a client that holds nothing yet.
      "/api/agents/authorization": { target: "http://localhost:8150", changeOrigin: true },
      // The two discovery documents sit at the site root by specification, not under a prefix.
      "/.well-known": { target: "http://localhost:8150", changeOrigin: true },
    },
  },
  preview: { host: "127.0.0.1", port: 5101, strictPort: true },
}));
