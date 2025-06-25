import { join } from "path";
import type { Plugin, UserConfig } from "vite";

import type { PluginOptions } from "./types";

import { name as pkgName } from "../package.json";
import { createFederationJson, federationDiscoverScript, isCssSource, joinLoose } from "./util";

export const devPlugin = ({
    fileName = "federation.json",
    app: { name, remotes = {}, shared = [], exposes = {} },
}: PluginOptions): Plugin => {
    let userConfig: UserConfig;
    const cssImportingModules = new Map<string, Set<string>>();
    const imports = new Map<string, string>(Object.entries(exposes).map(([key, path]) => [join(name, key), path]));

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
                        createFederationJson(name, userConfig.base, remotes, Object.fromEntries(imports.entries()))
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

            if (shared.includes(source)) {
                return null;
            }

            if (remotes[source.split("/")[0]]) {
                return { id: source, external: true };
            }

            return null;
        },
        async transformIndexHtml() {
            return [
                {
                    tag: "script",
                    children: `window.__ESM_FEDERATION_SHARED = ${JSON.stringify(shared)};`,
                },
                {
                    tag: "script",
                    attrs: { id: "__esm_federation_discover" },
                    children: federationDiscoverScript(name, userConfig.base || "/", fileName),
                },
            ];
        },
    };
};
