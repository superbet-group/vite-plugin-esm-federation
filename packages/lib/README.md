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
import { esmFederation } from "@happening/vite-plugin-esm-federation";

export default defineConfig({
  plugins: [
    esmFederation({
      fileName: "federation.json", // this is the default, but you can customise it
      app: {
        name: "name-of-your-app", // required
        shared: ["react", "react-dom"], // these dependencies will be shared with other apps
        remotes: {
          "name-of-remote-app": "https://remote-app.com/federation.json", // the URI of the JSON file
        },
        exposes: {
          Button: "./src/components/Button", // ./src/components/Button will be exposed as name-of-your-app/Button
        },
      },
    }),
  ],
});
```

In your app code:

```js
import { someFeature } from "name-of-remote-app/some-feature";
```

Your remote app config should look something like this:

```js
import { defineConfig } from "vite";
import { esmFederation } from "@happening/vite-plugin-esm-federation";

export default defineConfig({
  plugins: [
    esmFederation({
      app: {
        name: "name-of-remote-app",
        shared: ["react", "react-dom"],
        exposes: {
          "some-feature": "./src/some-feature.js",
        },
      },
    }),
  ],
});
```

## Using expressions to resolve remotes

You can use expressions to resolve the remote app's URL. This is useful if you want to use the same config for multiple environments. For example, you can use some property on `window` to determine the URL of the remote app. You can even make HTTP requests, but they need to be synchronous so as to not start loading modules before the module graph is resolved.

```js
// vite.config.js
import { defineConfig } from "vite";
import { esmFederation } from "@happening/vite-plugin-esm-federation";

export default defineConfig({
  plugins: [
    esmFederation({
      app: {
        name: "name-of-your-app",
        remotes: {
          "name-of-remote-app": "exp:window.env.REMOTE_APP_URL",
          "fetched-remote":
            // this performs a `GET` request to `https://my-env-service.com/name-of-your-app`
            // you could also use a custom implementation of `fetch` here
            'exp:syncFetch("https://my-env-service.com/name-of-your-app").REMOTE_APP_URL',
        },
      },
    }),
  ],
});
```

You can even implement a custom fetcher function that abstracts away you fetch logic. This will then be evaluated while building the dependency graph.

```js
// vite.config.js
import { defineConfig } from "vite";
import { esmFederation } from "@happening/vite-plugin-esm-federation";

const customFetch = (url) => `(() => {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "${url}", false);
  // add headers
  xhr.setRequestHeader("x-requested-by", "custom-fetcher");
  xhr.send();
  return JSON.parse(xhr.responseText);
})()`;

export default defineConfig({
  plugins: [
    esmFederation({
      app: {
        name: "name-of-your-app",
        remotes: {
          "custom-fetched-remote": customFetch(
            "https://url-of-custom-remote.com/federation.json"
          ),
        },
      },
    }),
  ],
});
```

Keep in mind that each of these fetch calls are and need to be blocking, to make sure that the first module only loads after the graph is resolved. When browsers start adding support for dynamic import maps, this limitation can go away.

You can both expose and consume modules within the same app and the plugin will handle the correct order of loading.

## Options

### `fileName`

Type: `string`

Default: `federation.json`

Required: `false`

The name of the JSON file that will be generated. This file will be used to resolve the module graph.

## Options `.app`

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
- Dev mode is tricky. Some frameworks will run just fine and vanilla JS will work, however React has an entirely different runtime in development and production mode, which means it's impossible to consolidate between them. Development runtime paired with another development runtime should technically be possible, however it won't work as one would expect, because of React Refresh and its dependecy on locality.

To get around limitations, you should share as little dependencies as you can. It's best for each federated module to own as much of its code as possible, even if it produces larger bundle sizes.

## License

MIT © [Happening](https://happening.xyz)
