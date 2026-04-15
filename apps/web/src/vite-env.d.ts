/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GIT_SHA?: string;
  readonly VITE_BUILD_TIME_UTC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __FESA_WEB_BUILD__: {
  readonly commit: string;
  readonly builtAt: string;
};
