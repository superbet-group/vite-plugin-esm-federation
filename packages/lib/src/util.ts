import { join } from "path";

export const joinLoose = (...args: string[]) => join(...args.filter(Boolean));

export const isCssSource = (source: string) => {
  return source.split("?")[0].endsWith(".css");
};

export type FederationJson = {
  name: string;
  imports: Record<string, string>;
  remotes: Record<string, string>;
};

export const createFederationJson = (
  name: string,
  base: string | undefined,
  remotes: Record<string, string>,
  imports: Record<string, string>
) => {
  return JSON.stringify({
    name,
    remotes,
    imports: Object.fromEntries(
      Object.entries(imports).map(([key, value]) => [
        key,
        join(...[base, value].filter(Boolean)),
      ])
    ),
  } satisfies FederationJson);
};

export const markShared = (name: string) => `__esm_shared_${name}`;
export const sharedModuleRegex = /(\.?\.\/)*__esm_shared_(.+)-[\d\w]+\.js/;

export const markExposed = (name: string) => `__esm_exposed_${name}`;
export const exposedModuleRegex = /(\.?\.\/)*__esm_exposed_(.+)-[\d\w]+\.js/;

export const sharedOrExposedModuleRegex =
  /(\.?\.\/)*(?:__esm_shared_|__esm_exposed_)(.+)-[\d\w]+\.js/;

// This script gets injected into the top of the head in the HTML page of the host app.
// It takes the remotes defined in the host app's config and fetches each remote's config.
// For every manifest, it recurses through the remotes and merges their configs into a single object.
// This object is then iterated over and each remote's shared modules are added to the import map.
// The resolution for each shared module is based on whether another module already shares that module
// if it is already shared, we resolve that module to the shared module
// if it isn't, we resolve it to the module provided by the remote
export const federationDiscoverScript = (
  name: string,
  base: string,
  fileName: string
) => `(() => {
  const stripLeadingAndTrailingSlashes = (str) => str.replace(/^\\/+|\\/+$/g, "");
  const join = (...paths) => paths.filter(Boolean).map(stripLeadingAndTrailingSlashes).join("/");

  const syncFetch = (url) => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send();
    return JSON.parse(xhr.responseText);
  };

  function discover(name, path, modules = {}) {
    try {
      const manifest = syncFetch(path);
      modules[name] = manifest;
      manifest.path = path;
      Object.entries(manifest.remotes).forEach(([name, path]) => {
        if (path.startsWith("exp:")) {
          path = eval(path.slice(4));
        }
        discover(name, path, modules);
      });
      return modules;
    } catch(e) {
      console.warn("Failed to discover federation modules", e);
      return modules;
    }
  };

  const modules = discover("${name}", window.location.origin + "${joinLoose(
  base,
  fileName
)}");

  const importMap = {
    imports: {},
  };

  Object.keys(modules).forEach((name) => {
    const manifest = modules[name];
    Object.entries(manifest.imports).forEach(([dep, path]) => {
      if (!importMap.imports[dep]) {
        importMap.imports[dep] = join(new URL(manifest.path).origin, path);
      }
    });
  });

  const importMapScript = document.createElement("script");
  importMapScript.type = "importmap";
  importMapScript.innerHTML = JSON.stringify(importMap);
  document.currentScript.after(importMapScript);
})()`;
