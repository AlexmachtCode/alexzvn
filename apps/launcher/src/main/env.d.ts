// Build-Zeit-Konstanten, die electron-vite via `define` ersetzt (siehe
// electron.vite.config.ts). In Dev/CI ohne Secret = leerer String.
declare const __JMPS_PROXY_KEY__: string;

// Minimaler Typ-Shim für selfsigned (kein @types-Paket nötig). Nur was wir nutzen.
declare module 'selfsigned' {
  interface Attr {
    name?: string;
    value?: string;
  }
  interface Options {
    days?: number;
    keySize?: number;
    algorithm?: string;
  }
  interface Pems {
    private: string;
    public: string;
    cert: string;
  }
  export function generate(attrs?: Attr[], opts?: Options): Pems;
  const _default: { generate: typeof generate };
  export default _default;
}
