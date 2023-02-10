# ES Module Federation Plugin for Vite

> NOTE: this plugin is most likely not for you! It is a low-level tool for specific use cases, that won't suit the majority of users. There are alternatives in this space to consider, such as [@originjs/vite-plugin-federation](https://github.com/originjs/vite-plugin-federation), which works with both Rollup and Vite and has a different architecture.

## How it works?

This plugin leverages the native EcmaScript Module system in modern browsers to implement a federated module system, such as microfrontends. It relies on a synchronously created module graph, resolved via a JSON file that gets created by the built process. The more modules you load, the more synchronous requests are made, which will halt your application at the beginning. This is a limitation of the ES Module system and more specifically import maps, as once a module is loaded, newly added import maps will no longer be considered. Therefore we have to build the module graph before any ES Modules are loaded.

## Installation

```bash
npm install --save-dev @happening/vite-plugin-esm-federation
```

## Usage

```js
// vite.config.js
import { defineConfig } from "vite";
import esmFederation from "@happening/vite-plugin-esm-federation";

export default defineConfig({
  plugins: [
    esmFederation({
      name: "name-of-your-app", // required
      shared: ["react", "react-dom"], // these dependencies will be shared with other apps
      remotes: {
        "name-of-remote-app": "https://remote-app.com/", // federation file will be loaded from https://remote-app.com/federation.json
      },
      exposes: {
        Button: "./src/components/Button", // ./src/components/Button will be exposed as name-of-your-app/Button
      },
    }),
  ],
});
```

You can both expose and consume modules within the same app and the plugin will handle the correct order of loading.

## Options

### `name`

Type: `string`

Required: `true`

The name of your app. This will be used to generate the federation file.

### `shared`

Type: `string[]`

Required: `false`

An array of dependencies that should be shared with other apps. This will be used to generate the federation file.

### `remotes`

Type: `Record<string, string>`

Required: `false`

An object of remote apps that should be consumed. The key is the name of the remote app and the value is the URL where the federation file can be found.

### `exposes`

Type: `Record<string, string>`

Required: `false`

An object of modules that should be exposed. The key is the name of the exposed module and the value is the path to the module.

## Known limitations

Dealing with shared modules is always difficult, especially within the `vite`/`rollup` ecosystem. The following limitations are known:

- Treeshaking will affect your shared dependencies, so even though you share a given dependency, it might not necessarily come with the same code as the remote app expects. This is because if the host app doesn't use a particular import from the shared dependency, it will be removed from the bundle. We don't know at build time what exports the remote app will require. To work around this, you can try explicitly importing and using exports that are removed by treeshaking. This will force the dependency to be included in the bundle.
- It is your responsibility to make sure that dependencies are up to date and in sync between the host app and the remote app. This is especially important for shared dependencies. If you use a shared dependency that is not up to date, you might get unexpected results, but you should expect your code to fail at runtime.

To get around limitations, you should share as little dependencies as you can. It's best for each federated module to own as much of its code as possible, even if it produces larger bundle sizes.

## License

MIT © [Happening](https://happening.xyz)
