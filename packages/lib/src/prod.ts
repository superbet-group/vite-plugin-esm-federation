import type { Plugin, UserConfig } from "vite";
import MagicString from "magic-string";
import { init, parse } from "es-module-lexer";
import * as path from "path";
import { isAbsolute, join, relative } from "path";

import { hash } from "./hash";
import type { PluginOptions } from "./types";
import {
  createFederationJson,
  exposedModuleRegex,
  federationDiscoverScript,
  isCssSource,
  markExposed,
  markShared,
  sharedModuleRegex,
  sharedOrExposedModuleRegex,
} from "./util";

import { name as pkgName } from "../package.json";

// Helper script can be used by host or all remotes to load assets, such as CSS
// we can keep this as a singleton via making it a module and that allows for caching
const LOAD_CSS = "__esm_loadCss";

const helperScript = `const __esm__cssCache = new Set();
export const ${LOAD_CSS} = (base, urls) => {
  if (!base) return;
  const curUrl = new URL(base);
  curUrl.pathname = curUrl.pathname.split("/").slice(0, -1).join("/");
  urls.forEach((url) => {
    if (__esm__cssCache.has(url)) return;
    __esm__cssCache.add(url);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(url, curUrl).href;
    document.head.appendChild(link);
  });
};
`;

const helperScriptPath = "__esm_federation_helpers";

const helperScriptPathResolved = join(
  "assets",
  `${helperScriptPath}-${hash(helperScript)}.js`
);

const createCssImport = (urls: string[]) => {
  return `import { ${LOAD_CSS} } from "${helperScriptPath}";${LOAD_CSS}(import.meta.url, [${urls
    .map((url) => JSON.stringify(url))
    .join(",")}]);`;
};

const createImportMap = (imports: Record<string, string>) => {
  return JSON.stringify({
    imports,
  });
};

export const prodPlugin = ({
  app: { name, remotes = {}, shared = [], exposes = {} },
  fileName = "federation.json",
  splitCommonModules,
}: PluginOptions): Plugin => {
  const cssImportingModules = new Map<string, Set<string>>();
  let userConfig: UserConfig;
  const sharedModules = new Map<string, string>();
  const exposedModules = new Map<string, string>();

  const getImports = () => {
    return Object.fromEntries([
      ...sharedModules.entries(),
      ...[...exposedModules.entries()].map(([e, v]) => [join(name, e), v]),
      [helperScriptPath, helperScriptPathResolved],
    ]);
  };

  return {
    name: `${pkgName}:prod`,
    enforce: "pre",
    resolveId(source, importer) {
      if (isCssSource(source)) {
        if (!cssImportingModules.has(importer)) {
          cssImportingModules.set(importer, new Set([source]));
        } else {
          cssImportingModules.get(importer)?.add(source);
        }
      }

      const match = source.match(sharedModuleRegex);
      if (match) {
        return {
          id: source,
          moduleSideEffects: "no-treeshake",
        };
      }
    },
    transformIndexHtml(html) {
      // discover script is injected before the first module script
      return html.replace(
        '<script type="module"',
        `<script>${federationDiscoverScript(
          name,
          userConfig.base || "/",
          fileName
        )}</script><script type="module"`
      );
    },
    async config(baseConfig) {
      await init;
      userConfig = baseConfig;

      const external = (id: string) => {
        if (remotes[id.split("/")[0]]) {
          return true;
        }
      };
      return {
        ...baseConfig,
        build: {
          target: "esnext",
          cssCodeSplit: true,
          rollupOptions: {
            external,
            ...baseConfig.build?.rollupOptions,
            output: {
              ...baseConfig.build?.rollupOptions?.output,
              manualChunks(id, { getModuleInfo }) {
                for (let index = 0; index < shared.length; index += 1) {
                  const dep = shared[index];
                  if (
                    id.match(new RegExp(`node_modules[/\\\\]${dep}[/\\\\]`))
                  ) {
                    return markShared(dep);
                  }
                  if (splitCommonModules) {
                    const info = getModuleInfo(id);
                    if (!info) {
                      return;
                    }
                    const { importers, dynamicImporters } = info;
                    const importersSet = new Set([
                      ...importers,
                      ...dynamicImporters,
                    ]);
                    for (const importer of importersSet) {
                      const match = importer.match(
                        /node_modules[/\\\\]([\w-_]+)[/\\\\]/
                      );
                      if (match) {
                        return markShared(match[1]);
                      }
                    }
                  }
                  const exposed = Object.entries(exposes).find(
                    ([, exposed]) => {
                      const rel = relative(id, exposed);
                      const isSubDir =
                        !rel.startsWith("..") && !isAbsolute(rel);
                      return isSubDir;
                    }
                  );

                  if (exposed) {
                    return markExposed(exposed[0]);
                  }
                }
              },
              minifyInternalExports: false,
            },
          },
        },
      };
    },
    async renderChunk(code, chunk) {
      const s = new MagicString(code);
      if (chunk.fileName.includes("__commonjsHelpers__")) {
        const [imports] = parse(code);
        for (const { ss: start, se: end } of imports) {
          s.remove(start, end);
        }
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        };
      }
      return {
        code: code,
        map: chunk["map"] || s.generateMap({ hires: true }),
      };
    },
    async generateBundle(_options, bundle) {
      for (const key in bundle) {
        const chunk = bundle[key];

        if (chunk.type === "chunk") {
          const importsShared = chunk.imports.some((id) =>
            sharedModuleRegex.test(id)
          );

          if (importsShared) {
            const s = new MagicString(chunk.code);
            const [imports] = parse(chunk.code);
            for (const { ss: start, se: end } of imports) {
              const importStatement = chunk.code.substring(start, end);
              const match = importStatement.match(sharedModuleRegex);
              if (match) {
                const [, _relative, moduleName] = match;
                const replacement = importStatement.replace(
                  sharedModuleRegex,
                  moduleName
                );
                s.overwrite(start, end, replacement);
              }
            }
            chunk.code = s.toString();
            chunk.map = s.generateMap({ hires: true });
          }

          const isExposed = path
            .parse(chunk.fileName)
            .name.startsWith("__esm_exposed_");

          const isShared = path
            .parse(chunk.fileName)
            .name.startsWith("__esm_shared_");

          const s = new MagicString(chunk.code);

          if (isShared || isExposed) {
            if (isShared) {
              const [, dep] = chunk.name.match(/__esm_shared_(.+)/);
              sharedModules.set(dep, chunk.fileName);
            }
            if (isExposed) {
              const [, dep] = chunk.name.match(/__esm_exposed_(.+)/);
              exposedModules.set(dep, chunk.fileName);
            }

            const [imports] = parse(chunk.code);
            for (const { ss: start, se: end } of imports) {
              const importStatement = chunk.code.substring(start, end);
              const exposedMatch = importStatement.match(exposedModuleRegex);
              const sharedMatch = importStatement.match(sharedModuleRegex);
              if (sharedMatch) {
                const [, _relative, moduleName] = sharedMatch;
                const replacement = importStatement.replace(
                  sharedOrExposedModuleRegex,
                  moduleName
                );
                s.overwrite(start, end, replacement);
              }
              if (exposedMatch) {
                const [, _relative, moduleName] = exposedMatch;
                const replacement = importStatement.replace(
                  sharedOrExposedModuleRegex,
                  `${name}/${moduleName}`
                );
                s.overwrite(start, end, replacement);
              }
            }
          }

          // get the CSS imports
          if (chunk.viteMetadata.importedCss.size) {
            // insert the CSS imports at the beginning of the file
            s.prepend(
              createCssImport(Array.from(chunk.viteMetadata.importedCss))
            );
          }
          chunk.code = s.toString();
          chunk.map = s.generateMap({ hires: true });
        }
      }

      this.emitFile({
        type: "asset",
        fileName: helperScriptPathResolved,
        source: helperScript,
      });
      this.emitFile({
        type: "asset",
        fileName,
        source: createFederationJson(
          name,
          userConfig.base,
          remotes,
          getImports()
        ),
      });
    },
  };
};
