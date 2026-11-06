// Minimaler Typ-Shim für selfsigned (kein @types-Paket nötig). Nur was wir nutzen.
declare module 'selfsigned' {
  interface Attr {
    name?: string;
    value?: string;
  }
  interface Options { days?: number; keySize?: number; algorithm?: string; notBeforeDate?: Date; }
  interface Pems {
    private: string;
    public: string;
    cert: string;
  }
  export function generate(attrs?: Attr[], opts?: Options): Pems;
  const _default: { generate: typeof generate };
  export default _default;
}
