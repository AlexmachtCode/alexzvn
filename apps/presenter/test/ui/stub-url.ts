// Ersatz für Vite-Importe mit `?url` im Testlauf (UX Welle 2b, Presenter b): lib/pdf.ts holt die Adresse des pdf.js-Workers
// über `pdfjs-dist/build/pdf.worker.min.mjs?url`, das kennt nur Vite. Der Lade-Hook in test/ui/selftest.ts bildet jeden
// Bezeichner mit `?url` hierher ab; im Test gibt es keinen Worker, die Adresse bleibt leer.
export default '';
