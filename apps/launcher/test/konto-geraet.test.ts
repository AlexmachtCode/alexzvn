// Anmeldung im Launcher (Teil 1) · P8: Geräteschlüssel (src/main/konto/geraet.ts) — ohne Electron, ohne Netz (tsx).
// Der Verschlüsseler ist eine Attrappe für safeStorage (umkehrbar, aber nie der Klartext). Der Beweis wird mit der
// Prüfung des Workers gegengeprüft (services/release-proxy/konto-krypto.js, Block A Task 2).
import { readFileSync } from 'node:fs';
import { beweisText, geraetIdAus, ladeOderErzeugeGeraet, type Verschluesseler } from '../src/main/konto/geraet';
import { geraetIdAus as geraetIdAusWorker, pruefeGeraeteBeweis } from '../../../services/release-proxy/konto-krypto.js';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

/** safeStorage-Attrappe: umkehrbar, aber nie der Klartext (jedes Zeichen verschoben, mit Präfix). */
function verschluesseler(o: { verfuegbar?: boolean; wirft?: boolean } = {}): Verschluesseler & { aufrufe: number } {
  const v = {
    aufrufe: 0,
    verfuegbar: () => o.verfuegbar !== false,
    verschluesseln(klar: string): string {
      v.aufrufe++;
      if (o.wirft) throw new Error('Schlüsselbund gesperrt');
      return 'enc1:' + Buffer.from([...Buffer.from(klar, 'utf8')].map((b) => (b + 7) % 256)).toString('base64');
    },
    entschluesseln(b64: string): string {
      if (!b64.startsWith('enc1:')) throw new Error('fremdes Profil');
      return Buffer.from([...Buffer.from(b64.slice(5), 'base64')].map((b) => (b + 249) % 256)).toString('utf8');
    },
  };
  return v;
}
function ablage(start?: string): { lies(): string | undefined; schreib(b64: string): void; wert: string | undefined; schreibvorgaenge: number } {
  const a = {
    wert: start,
    schreibvorgaenge: 0,
    lies: () => a.wert,
    schreib(b64: string) { a.schreibvorgaenge++; a.wert = b64; },
  };
  return a;
}
const JETZT = Date.UTC(2026, 9, 21, 10, 0, 0);

// --- P8 7: erzeugen, verschlüsselt ablegen, wieder laden -------------------------------------------------------------
{
  const v = verschluesseler();
  const a = ablage();
  const erst = await ladeOderErzeugeGeraet(v, a);
  const gespeichert = a.wert ?? '';
  let klar = '';
  try {
    klar = v.entschluesseln(gespeichert);
  } catch {
    klar = ''; // nicht von dieser Attrappe verschlüsselt: die Prüfung unten wird rot, der Lauf bricht nicht ab
  }
  const zweit = await ladeOderErzeugeGeraet(v, a);
  ck('P8 7: erzeugt beim ersten Mal (neu), legt nur verschlüsselt ab, zweiter Aufruf liest dasselbe Gerät (gleiche gid, nichts neu geschrieben)',
    erst.art === 'ok' && erst.neu === true && a.schreibvorgaenge === 1 && gespeichert.startsWith('enc1:')
    && !gespeichert.includes(klar) && Buffer.from(klar, 'base64').length > 100
    && zweit.art === 'ok' && zweit.neu === false && zweit.geraet.gid === erst.geraet.gid && a.schreibvorgaenge === 1
    && /^[A-Za-z0-9_-]{22}$/.test(erst.geraet.gid));
}

// --- P8 7, G6: ohne Schlüsselspeicher kein Gerät und nichts geschrieben ---------------------------------------------
{
  const ohne = verschluesseler({ verfuegbar: false });
  const a1 = ablage();
  const r1 = await ladeOderErzeugeGeraet(ohne, a1);
  const wirft = verschluesseler({ wirft: true });
  const a2 = ablage();
  const r2 = await ladeOderErzeugeGeraet(wirft, a2);
  ck('P8 7: ohne Schlüsselspeicher kein Gerät und nichts geschrieben, auch wenn das Verschlüsseln scheitert (kein Klartext-Rückfall)',
    r1.art === 'kein-schluesselspeicher' && a1.schreibvorgaenge === 0 && a1.wert === undefined && ohne.aufrufe === 0
    && r2.art === 'kein-schluesselspeicher' && a2.schreibvorgaenge === 0 && a2.wert === undefined);
}

// --- P8 7, G6: ohne Schlüsselspeicher bleibt ein vorhandener Eintrag unberührt ---------------------------------------
{
  const ohne = verschluesseler({ verfuegbar: false });
  const a = ablage('enc:alt');
  const r = await ladeOderErzeugeGeraet(ohne, a);
  ck('P8 7: ohne Schlüsselspeicher bleibt ein vorhandener Eintrag unberührt (nichts überschrieben, nichts geschrieben)',
    r.art === 'kein-schluesselspeicher' && a.wert === 'enc:alt' && a.schreibvorgaenge === 0 && ohne.aufrufe === 0);
}

// --- P8 7: unlesbarer Schlüssel → neues Gerät -----------------------------------------------------------------------
{
  const v = verschluesseler();
  const a = ablage();
  const alt = await ladeOderErzeugeGeraet(v, a);
  const fremd = ablage('dpapi:anderes-profil');
  const r1 = await ladeOderErzeugeGeraet(v, fremd);
  const kaputt = ablage(v.verschluesseln('kein-pkcs8'));
  const r2 = await ladeOderErzeugeGeraet(v, kaputt);
  ck('P8 7: gespeicherter Schlüssel unlesbar (fremdes Profil, kein PKCS8) → neu-wegen-unlesbar, neues Gerät verschlüsselt abgelegt',
    alt.art === 'ok' && r1.art === 'neu-wegen-unlesbar' && fremd.schreibvorgaenge === 1 && (fremd.wert ?? '').startsWith('enc1:')
    && r1.geraet.gid !== alt.geraet.gid && r2.art === 'neu-wegen-unlesbar' && kaputt.schreibvorgaenge === 1);
}

// --- P8 7: Beweis und Kennung wie der Worker ------------------------------------------------------------------------
{
  const r = await ladeOderErzeugeGeraet(verschluesseler(), ablage());
  if (r.art === 'kein-schluesselspeicher') {
    ck('P8 7: Beweis besteht die Prüfung des Workers (abholen, erneuern) und gid wie geraetIdAus des Workers', false);
  } else {
    const g = r.geraet;
    const b1 = await g.beweis('abholen', 'vorgang-1', JETZT);
    const b2 = await g.beweis('erneuern', 'kid-1', JETZT);
    const ok1 = await pruefeGeraeteBeweis(g.publicJwk, b1, 'abholen', 'vorgang-1', JETZT + 60_000);
    const ok2 = await pruefeGeraeteBeweis(g.publicJwk, b2, 'erneuern', 'kid-1', JETZT);
    const falscherZweck = await pruefeGeraeteBeweis(g.publicJwk, b1, 'erneuern', 'vorgang-1', JETZT);
    const falscherBezug = await pruefeGeraeteBeweis(g.publicJwk, b2, 'erneuern', 'kid-2', JETZT);
    const gidWorker = await geraetIdAusWorker(g.publicJwk);
    ck('P8 7: Beweis besteht die Prüfung des Workers (abholen, erneuern) und gid wie geraetIdAus des Workers',
      ok1 === true && ok2 === true && falscherZweck === false && falscherBezug === false && gidWorker === g.gid
      && (await geraetIdAus(g.publicJwk)) === g.gid && b1.gid === g.gid && b1.ts === JETZT && /^[A-Za-z0-9_-]{86}$/.test(b1.sig));
    ck('P8 7: publicJwk ohne privaten Anteil (nur kty, crv, x, y)',
      JSON.stringify(Object.keys(g.publicJwk).sort()) === JSON.stringify(['crv', 'kty', 'x', 'y'])
      && g.publicJwk.kty === 'EC' && g.publicJwk.crv === 'P-256');
    ck('P8 7: beweisText wie der Worker (jm-geraet|zweck|bezug|ts)',
      beweisText('abholen', 'v-9', 123) === 'jm-geraet|abholen|v-9|123');
  }
}

// --- P8 G9: kein Electron ----------------------------------------------------------------------------------------------
{
  const quelle = readFileSync(new URL('../src/main/konto/geraet.ts', import.meta.url), 'utf8');
  ck('P8 G9: geraet.ts ohne electron-Import und ohne Konsole', !/from 'electron'|require\('electron'\)/.test(quelle) && !/console\./.test(quelle));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
