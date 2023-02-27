export type PluginOptions = {
  splitCommonModules?: boolean;
  fileName?: string;
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
