/// <reference types="vite/client" />

declare module "@app-copy" {
  export const COPY: {
    lede: string;
    phases: {
      spec: string;
      plan: string;
      implementation: string;
      verification: string;
      review: string;
    };
    architecture: string;
    limits: readonly string[];
  };
}

interface ImportMetaEnv {
  readonly VITE_STATIC_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
