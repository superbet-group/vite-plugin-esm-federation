import type { Plugin } from "vite";

import { PluginOptions } from "./types";

import { name } from "../package.json";
import { devPlugin } from "./dev";
import { prodPlugin } from "./prod";

export const esmFederation = (pluginOptions: PluginOptions): Plugin => {
  const dev = devPlugin(pluginOptions);
  const prod = prodPlugin(pluginOptions);

  let selectedPlugin: Plugin;

  const combinedPlugin = {
    ...dev,
    ...prod,
  };
  const allPluginKeys = Object.keys(combinedPlugin).filter(
    (key) => typeof combinedPlugin[key] === "function"
  );

  const generatedPlugin = Object.fromEntries(
    Array.from(allPluginKeys).map((key) => [
      key,
      function hook(...args) {
        return selectedPlugin?.[key]?.apply(this, args);
      },
    ])
  );

  const { config: _, ...rest } = generatedPlugin;

  return {
    name,
    enforce: "pre",
    config(config, env) {
      selectedPlugin = env.mode === "production" ? prod : dev;
      return generatedPlugin.config?.call(this, config, env);
    },
    ...rest,
  };
};
