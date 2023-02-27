import { join } from "path";
import type { Plugin, UserConfig } from "vite";

import type { PluginOptions } from "./types";

import { name as pkgName } from "../package.json";
import {
  createFederationJson,
  federationDiscoverScript,
  isCssSource,
  joinLoose,
} from "./util";

const devNodeModuleRegexp = /\/node_modules\/.vite\/deps\/(.+)\.js\?v=[\d\w]+/;

// turn the normalised module name into the original module name
// e.g.: react -> react
// e.g.: react-dom -> react-dom
// e.g.: react_jsx-dev-runtime -> react/jsx-dev-runtime
// e.g.: @ant-design_icons -> @ant-design/icons
const deNormaliseModuleName = (path: string) => {
  return path.replace(/_/g, "/");
};

export const devPlugin = ({
  fileName = "federation.json",
  app: { name, remotes = {}, shared = [], exposes = {} },
}: PluginOptions): Plugin => {
  let userConfig: UserConfig;
  const cssImportingModules = new Map<string, Set<string>>();
  const imports = new Map<string, string>(
    Object.entries(exposes).map(([key, path]) => [join(name, key), path])
  );

  const getFederationJsonPath = () => {
    return join(userConfig.base || "/", fileName);
  };

  const remoteKeys = Object.keys(remotes);

  return {
    name: `${pkgName}:dev`,
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === "GET" && req.url === getFederationJsonPath()) {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(
            createFederationJson(
              name,
              userConfig.base,
              remotes,
              Object.fromEntries(imports.entries())
            )
          );
        } else {
          return next();
        }
      });
    },
    configResolved(resolvedConfig) {
      if (remoteKeys.length) {
        const re = new RegExp(`/@id/(${remoteKeys.join("|")})`, "g");
        // @ts-expect-error this is in fact not a readonly array
        resolvedConfig.plugins.push({
          name: `${pkgName}:dev:transform-remote-id`,
          enforce: "pre",
          transform(code) {
            return code.replace(re, (_, p1) => {
              return p1;
            });
          },
        });
      }
      if (shared.length) {
        // deps are in the form of /base-path(optional)/node_modules/.vite/deps/(dep name).js?v=xxx

        // remove trailing slash
        const base = userConfig.base?.replace(/\/$/, "") ?? "";
        const re = new RegExp(
          `${base}/node_modules/.vite/deps/(${shared.join(
            "|"
          )})\\.js\\?v=[\\d\\w]+`,
          "g"
        );
        // @ts-expect-error this is in fact not a readonly array
        resolvedConfig.plugins.push({
          name: `${pkgName}:dev:transform-shared-deps`,
          enforce: "pre",
          transform(code) {
            return code.replace(re, (match, p1) => {
              return deNormaliseModuleName(p1);
            });
          },
        });
      }
    },
    config(baseConfig) {
      userConfig = baseConfig;

      baseConfig.build = {
        ...baseConfig.build,
        target: "esnext",
        cssCodeSplit: true,
      };
    },
    resolveId(source, importer) {
      if (isCssSource(source)) {
        if (!cssImportingModules.has(importer)) {
          cssImportingModules.set(importer, new Set([source]));
        } else {
          cssImportingModules.get(importer)?.add(source);
        }
      }
      const match = source.match(devNodeModuleRegexp);
      if (match) {
        const moduleName = deNormaliseModuleName(match[1]);
        if (shared.includes(moduleName)) {
          imports.set(moduleName, joinLoose(userConfig.base, source));
        }
      }

      if (remotes[source.split("/")[0]]) {
        return { id: source, external: true };
      }
    },
    async transformIndexHtml() {
      // here, discover script is injected as the first child of head
      return [
        {
          tag: "script",
          attrs: { id: "__esm_federation_discover" },
          children: federationDiscoverScript(
            name,
            userConfig.base || "/",
            fileName
          ),
        },
      ];
    },
  };
};
