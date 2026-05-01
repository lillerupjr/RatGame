/// <reference types="vite/client" />
/// <reference types="node" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "pngjs" {
  export const PNG: {
    sync: {
      read(data: Uint8Array): {
        width: number;
        height: number;
        data: Uint8Array;
      };
    };
  };
}
