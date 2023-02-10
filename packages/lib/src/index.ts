import { type Plugin } from "vite";
import MagicString from "magic-string";
import { init, parse } from "es-module-lexer";
import * as path from "path";
import { isAbsolute, relative } from "path";

import { hash } from "./hash";

export type PluginOptions = {
  splitCommonModules?: boolean;
  app: AppConfig;
};

export type AppConfig = {
  name: string;
  shared?: string[];
  exposes?: { [name: string]: string };
  remotes?: { [name: string]: string };
};

export type RemoteConfig = AppConfig & {
  expose: { [name: string]: string };
};

const markShared = (name: string) => `__esm_shared_${name}`;
const sharedModuleRegex = /(\.?\.\/)*__esm_shared_(.+)-[\d\w]+\.js/;

const markExposed = (name: string) => `__esm_exposed_${name}`;
const exposedModuleRegex = /(\.?\.\/)*__esm_exposed_(.+)-[\d\w]+\.js/;

const sharedOrExposedModuleRegex =
  /(\.?\.\/)*(?:__esm_shared_|__esm_exposed_)(.+)-[\d\w]+\.js/;

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

const helperScriptPathResolved = `${helperScriptPath}-${hash(helperScript)}.js`;

const createCssImport = (urls: string[]) => {
  return `import { ${LOAD_CSS} } from "${helperScriptPath}";${LOAD_CSS}(import.meta.url, [${urls
    .map((url) => JSON.stringify(url))
    .join(",")}]);`;
};

// This script gets injected into the top of the head in the HTML page of the host app.
// It takes the remotes defined in the host app's config and fetches each remote's config.
// For every manifest, it recurses through the remotes and merges their configs into a single object.
// This object is then iterated over and each remote's shared modules are added to the import map.
// The resolution for each shared module is based on whether another module already shares that module
// if it is already shared, we resolve that module to the shared module
// if it isn't, we resolve it to the module provided by the remote
const federationDiscoverScript = (name: string) => `(() => {
  const syncFetch = (url) => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send();
    return JSON.parse(xhr.responseText);
  };

  const discover = (name, path, modules = {}) => {
    const manifest = syncFetch(path + "/federation.json");
    modules[name] = manifest;
    manifest.path = path;
    Object.entries(manifest.remotes).forEach(([name, path]) => {
      discover(name, path, modules);
    });
    return modules;
  };

  const modules = discover("${name}", window.location.origin);

  const importMap = {
    imports: {},
  };

  Object.keys(modules).forEach((name) => {
    const manifest = modules[name];
    Object.entries(manifest.imports).forEach(([dep, path]) => {
      if (!importMap.imports[dep]) {
        importMap.imports[dep] = \`\${manifest.path}/\${path}\`;
      }
    });
  });

  const importMapScript = document.createElement("script");
  importMapScript.type = "importmap";
  importMapScript.innerHTML = JSON.stringify(importMap);
  document.head.appendChild(importMapScript);
})()`;

type FederationJson = {
  name: string;
  imports: Record<string, string>;
  remotes: Record<string, string>;
};

const createFederationJson = (
  name: string,
  remotes: Record<string, string>,
  imports: Record<string, string>
) => {
  return JSON.stringify({
    name,
    remotes,
    imports,
  } satisfies FederationJson);
};

const isCssSource = (source: string) => {
  return source.split("?")[0].endsWith(".css");
};

export const esmFederation = ({
  app: { name, exposes = {}, shared = [], remotes = {} },
  splitCommonModules = false,
}: PluginOptions): Plugin => {
  const cssImportingModules = new Map<string, Set<string>>();
  return {
    name: "esm-federation",
    enforce: "pre",
    resolveId(source, importer) {
      if (isCssSource(source)) {
        if (!cssImportingModules.has(importer)) {
          cssImportingModules.set(importer, new Set([source]));
        } else {
          cssImportingModules.get(importer)?.add(source);
        }
      }
    },
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head><script>${federationDiscoverScript(name)}</script>`
      );
    },
    async config(baseConfig) {
      await init;

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
      const sharedModules = new Map<string, string>();
      const exposedModules = new Map<string, string>();

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
        fileName: `${helperScriptPath}-${hash(helperScript)}.js`,
        source: helperScript,
      });
      this.emitFile({
        type: "asset",
        fileName: "federation.json",
        source: createFederationJson(
          name,
          remotes,
          Object.fromEntries([
            ...sharedModules.entries(),
            ...[...exposedModules.entries()].map(([e, v]) => [
              `${name}/${e}`,
              v,
            ]),
            [helperScriptPath, helperScriptPathResolved],
          ])
        ),
      });
    },
  };
};
