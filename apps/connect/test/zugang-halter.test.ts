// Halter der Freigaben von JM Connect (Anmeldung Teil 2, Task 11). Rein: kein Electron, keine Datei. npm run selftest -w @jm/connect
process.env.TZ = 'Europe/Berlin';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FreigabeErgebnis } from '@jm/app-runtime/freigabe';
import type { ProxyKeySource } from '../src/shared/types';

const { erzeugeZugangsHalter } = await import('../src/main/zugang/halter');
type ConnectZweck = import('../src/main/zugang/regeln').ConnectZweck;
type GehalteneFreigaben = import('../src/main/zugang/regeln').GehalteneFreigaben;
type ConnectFreigabe = import('../src/main/zugang/regeln').ConnectFreigabe;

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const read = (p: string): string => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

const T = new Date(2026, 10, 20, 9, 0).getTime();
const H = 3_600_000;
const KONTO = { name: 'Test Person', stufe: 'kollege' as const };

type Antwort = (a: { appId: string; zweck: string; ziel: string }, n: number) => FreigabeErgebnis | Promise<FreigabeErgebnis>;
const ok = (token: string, bis = T + 72 * H): Antwort => () => ({ ok: true, freigabe: token, bis, konto: KONTO });
const nein = (grund: Extract<FreigabeErgebnis, { ok: false }>['grund'], detail?: string): Antwort => () => ({ ok: false, grund, ...(detail ? { detail } : {}) });

interface Opt {
  antwort: Antwort;
  jetzt: number;
  gehalten: GehalteneFreigaben;
  raumAlt: { wert: string | null; herkunft: ProxyKeySource };
  sdkAlt: { wert: string | null; herkunft: ProxyKeySource };
}
const halter = (o: Partial<Opt> = {}) => {
  const aufrufe: unknown[] = [];
  const gespeichert: GehalteneFreigaben[] = [];
  const logs: string[] = [];
  const loeschungen = { raum: 0, sdk: 0 };
  const uhr = { t: o.jetzt ?? T };
  const alt = {
    raum: { ...(o.raumAlt ?? { wert: null, herkunft: 'none' as ProxyKeySource }) },
    sdk: { ...(o.sdkAlt ?? { wert: null, herkunft: 'none' as ProxyKeySource }) },
  };
  let geaendert = 0;
  const antwort = o.antwort ?? ok('jm1.test-raum');
  const h = erzeugeZugangsHalter({
    holeFreigabe: async (a) => { aufrufe.push(a); return antwort(a, aufrufe.length); },
    gehalten: o.gehalten ?? {},
    speichern: (g) => { gespeichert.push(JSON.parse(JSON.stringify(g))); },
    alt: {
      'connect-raum': { lesen: () => ({ ...alt.raum }), loeschen: () => { loeschungen.raum++; alt.raum = { wert: null, herkunft: 'none' }; return true; } },
      'zoom-sdk': { lesen: () => ({ ...alt.sdk }), loeschen: () => { loeschungen.sdk++; alt.sdk = { wert: null, herkunft: 'none' }; return true; } },
    },
    jetzt: () => uhr.t,
    log: (z) => { logs.push(z); },
    geaendert: () => { geaendert++; },
  });
  return { h, aufrufe, gespeichert, logs, loeschungen, uhr, alt, geaendert: () => geaendert };
};
const frei = (zweck: ConnectZweck, ziel: string, token: string, bis = T + 72 * H): ConnectFreigabe => ({ zweck, token, bis, ziel, konto: KONTO });

{
  const h = halter({ antwort: ok('jm1.test-raum') });
  const [a, b, c] = await Promise.all([h.h.zugang('connect-raum', 'cop31-tag1'), h.h.zugang('connect-raum', 'cop31-tag1'), h.h.zugang('connect-raum', 'cop31-tag1')]);
  ck('T11 RF2: drei gleichzeitige Bedarfe → genau ein holeFreigabe (jm-connect, connect-raum, cop31-tag1), alle bekommen die Freigabe',
    h.aufrufe.length === 1 && JSON.stringify(h.aufrufe[0]) === '{"appId":"jm-connect","zweck":"connect-raum","ziel":"cop31-tag1"}' && [a, b, c].every((w) => w.art === 'freigabe'));
  ck('T11 6.3: zweiter Bedarf ohne Launcher, gespeichert wird nur die Freigabe',
    (await h.h.zugang('connect-raum', 'cop31-tag1')).art === 'freigabe' && h.aufrufe.length === 1 && JSON.stringify(Object.keys(h.gespeichert.at(-1) ?? {})) === '["connect-raum"]');
}

{
  // QR2: anderer Raum → neuer Versuch; gleicher Raum erst unter 24 h Rest; Fehlschlag höchstens alle 30 s
  const h = halter({ antwort: (a) => ({ ok: true, freigabe: `jm1.test-${a.ziel}`, bis: T + 72 * H, konto: KONTO }) });
  await h.h.zugang('connect-raum', 'raum-eins');
  const w2 = await h.h.zugang('connect-raum', 'raum-zwei');
  ck('T11 QR2: anderer Raum → neuer Versuch; gleicher Raum erst unter 24 h Rest; Fehlschlag höchstens alle 30 s', h.aufrufe.length === 2 && w2.art === 'freigabe' && w2.f.ziel === 'raum-zwei');
  h.uhr.t = T + 47 * H;
  await h.h.zugang('connect-raum', 'raum-zwei');
  ck('T11 QR2: gleicher Raum mit 25 h Rest → kein Versuch', h.aufrufe.length === 2);
  h.uhr.t = T + 49 * H;
  await h.h.zugang('connect-raum', 'raum-zwei');
  ck('T11 QR2: gleicher Raum mit 23 h Rest → Versuch', h.aufrufe.length === 3);

  const f = halter({ antwort: nein('kein-launcher') });
  await f.h.zugang('connect-raum', 'raum-eins');
  await f.h.zugang('connect-raum', 'raum-eins');
  f.uhr.t = T + 29_000;
  await f.h.zugang('connect-raum', 'raum-eins');
  const nach29 = f.aufrufe.length;
  f.uhr.t = T + 30_000;
  await f.h.zugang('connect-raum', 'raum-eins');
  ck('T11 QR2: Fehlschlag → höchstens alle 30 s (1 Versuch bis 29 s, der zweite bei 30 s)', nach29 === 1 && f.aufrufe.length === 2);
  const l = f.h.lage('connect-raum');
  ck('T11 QR2: Misserfolg steht in der Lage (kein-launcher, versucht, keine Freigabe)', l.letzterGrund === 'kein-launcher' && l.versucht && l.wahl === 'keiner' && l.bis === null);
}

{
  // 6.3: Neustart mit gehaltener Freigabe
  const g: GehalteneFreigaben = { 'connect-raum': frei('connect-raum', 'cop31-tag1', 'jm1.test-gehalten') };
  const h = halter({ gehalten: g, antwort: nein('kein-launcher') });
  const w = await h.h.zugang('connect-raum', 'cop31-tag1');
  const l = h.h.lage('connect-raum');
  ck('T11 6.3: Neustart mit gehaltener Freigabe (gehalten aus der Datei) → Bearer ohne holeFreigabe',
    w.art === 'freigabe' && w.f.token === 'jm1.test-gehalten' && h.aufrufe.length === 0 && l.wahl === 'freigabe' && l.konto?.name === 'Test Person' && l.bis === T + 72 * H);
}

{
  // OT10
  const mit = halter({ antwort: nein('unbekannter-zweck'), raumAlt: { wert: 'test-alt', herkunft: 'stored' } });
  const w = await mit.h.zugang('connect-raum', 'cop31-tag1');
  const ohne = halter({ antwort: nein('unbekannter-zweck') });
  const w2 = await ohne.h.zugang('connect-raum', 'cop31-tag1');
  ck('T11 OT10: Launcher 0.18.0 (unbekannter-zweck) mit altem Key → alter-key, lage.letzterGrund unbekannter-zweck; ohne alten Key → keiner',
    w.art === 'alter-key' && w.key === 'test-alt' && mit.h.lage('connect-raum').letzterGrund === 'unbekannter-zweck' && mit.loeschungen.raum === 0
      && w2.art === 'keiner' && ohne.h.lage('connect-raum').letzterGrund === 'unbekannter-zweck');
}

{
  // OT9 connect-raum
  const h = halter({ antwort: ok('jm1.test-raum'), raumAlt: { wert: 'test-alt', herkunft: 'stored' } });
  await h.h.zugang('connect-raum', 'cop31-tag1');
  h.uhr.t = T + 49 * H;
  await h.h.zugang('connect-raum', 'cop31-tag1');
  const l = h.h.lage('connect-raum');
  const e = halter({ antwort: ok('jm1.test-raum'), raumAlt: { wert: 'test-env', herkunft: 'env' } });
  await e.h.zugang('connect-raum', 'cop31-tag1');
  const le = e.h.lage('connect-raum');
  ck('T11 OT9: erste connect-raum-Freigabe löscht den gespeicherten Proxy-Key genau einmal, lage.geloescht; aus der Umgebung nie',
    h.loeschungen.raum === 1 && l.geloescht && h.aufrufe.length === 2
      && e.loeschungen.raum === 0 && !le.geloescht && le.altHerkunft === 'env'
      && h.logs.filter((z) => z === `[connect] Zugang: alter Proxy-Key gelöscht, Freigabe vom Launcher bis ${new Date(T + 72 * H).toISOString()}`).length === 1);
  const s = halter({ antwort: ok('jm1.test-raum'), raumAlt: { wert: 'test-sitzung', herkunft: 'session' } });
  await s.h.zugang('connect-raum', 'cop31-tag1');
  ck('T11 OT9: auch ein Sitzungs-Key fällt', s.loeschungen.raum === 1 && s.h.lage('connect-raum').geloescht);
}

{
  // OT9 zoom-sdk
  const h = halter({ antwort: ok('jm1.test-sdk'), sdkAlt: { wert: 'test-sdk-alt', herkunft: 'stored' } });
  const w = await h.h.zugang('zoom-sdk', 'win-x64');
  const nachErhalt = h.loeschungen.sdk;
  const erst = h.h.bestaetigt('zoom-sdk', w);
  const zweit = h.h.bestaetigt('zoom-sdk', w);
  ck('T11 OT9: zoom-sdk: Altlast fällt erst mit bestaetigt() (true genau einmal), nicht beim Erhalt',
    w.art === 'freigabe' && nachErhalt === 0 && erst === true && zweit === false && h.loeschungen.sdk === 1 && h.h.lage('zoom-sdk').geloescht);
  const e = halter({ antwort: ok('jm1.test-sdk'), sdkAlt: { wert: 'test-env', herkunft: 'env' } });
  const we = await e.h.zugang('zoom-sdk', 'win-x64');
  ck('T11 OT9: zoom-sdk: bestaetigt() nie für env, nie für alter-key/keiner, nie für andere Zwecke',
    e.h.bestaetigt('zoom-sdk', we) === false && e.loeschungen.sdk === 0
      && h.h.bestaetigt('zoom-sdk', { art: 'keiner' }) === false && h.h.bestaetigt('zoom-jwt', w) === false && h.h.bestaetigt('connect-raum', w) === false);
}

{
  // QR5
  const h = halter({ antwort: (_a, n) => ({ ok: true, freigabe: `jm1.test-n${n}`, bis: T + 72 * H, konto: KONTO }) });
  const w = await h.h.zugang('connect-raum', 'cop31-tag1');
  h.h.antwort('connect-raum', w, 403, 'kein-recht');
  const verworfen = h.h.lage('connect-raum').wahl === 'keiner' && JSON.stringify(h.gespeichert.at(-1)) === '{}';
  const w2 = await h.h.zugang('connect-raum', 'cop31-tag1');
  ck('T11 QR5: 403 auf eine Freigabe → verworfen, nächster zugang() holt sofort neu (gespeichert leer, gleiche Sekunde)',
    verworfen && h.aufrufe.length === 2 && w2.art === 'freigabe' && w2.f.token === 'jm1.test-n2');
  h.h.antwort('connect-raum', w, 401, 'nicht-angemeldet');
  ck('T11 QR5: eine späte Ablehnung der alten Freigabe verwirft die neue nicht', h.h.lage('connect-raum').wahl === 'freigabe');
  h.h.antwort('connect-raum', w2, 403, 'raum-vergeben');
  ck('T11 QR5: 403 raum-vergeben behält die Freigabe', h.h.lage('connect-raum').wahl === 'freigabe');
}

{
  // OE5, OT8
  const h = halter({ antwort: nein('kein-launcher'), raumAlt: { wert: 'test-alt', herkunft: 'stored' }, sdkAlt: { wert: 'test-sdk-alt', herkunft: 'stored' } });
  const w = await h.h.zugang('connect-raum', 'cop31-tag1');
  h.h.antwort('connect-raum', w, 401, 'alter-key-abgelaufen');
  const l = h.h.lage('connect-raum');
  const w2 = await h.h.zugang('connect-raum', 'cop31-tag1');
  ck('T11 OE5, OT8: 401 alter-key-abgelaufen auf den alten Key → altAbgelehnt, Key gelöscht, danach keiner (kein Rückfall)',
    w.art === 'alter-key' && l.altAbgelehnt && h.loeschungen.raum === 1 && w2.art === 'keiner' && h.h.lage('connect-raum').altAbgelehnt);
  ck('T11 OT8: die Ablehnung des Proxy-Keys trifft den SDK-Schlüssel nicht (je Wert getrennt)',
    !h.h.lage('zoom-sdk').altAbgelehnt && h.loeschungen.sdk === 0 && h.h.lage('zoom-sdk').wahl === 'alter-key');
  const s = await h.h.zugang('zoom-sdk', 'win-x64');
  h.h.antwort('zoom-sdk', s, 401, 'nicht-angemeldet');
  ck('T11 OT8: umgekehrt: SDK-Schlüssel abgelehnt und gelöscht, Proxy-Key-Zustand unberührt',
    s.art === 'alter-key' && h.h.lage('zoom-sdk').altAbgelehnt && h.loeschungen.sdk === 1 && h.loeschungen.raum === 1);
  const e = halter({ antwort: nein('kein-launcher'), raumAlt: { wert: 'test-env', herkunft: 'env' } });
  const we = await e.h.zugang('connect-raum', 'cop31-tag1');
  e.h.antwort('connect-raum', we, 401, 'nicht-angemeldet');
  ck('T11 OE5: aus der Umgebung abgelehnt → altAbgelehnt, aber nicht gelöscht', e.h.lage('connect-raum').altAbgelehnt && e.loeschungen.raum === 0);
  const sonst = halter({ antwort: nein('kein-launcher'), raumAlt: { wert: 'test-alt', herkunft: 'stored' } });
  const ws = await sonst.h.zugang('connect-raum', 'cop31-tag1');
  sonst.h.antwort('connect-raum', ws, 403, 'kein-recht');
  ck('T11 OT8: ein 403 trifft den alten Key nie', !sonst.h.lage('connect-raum').altAbgelehnt && sonst.loeschungen.raum === 0);
}

{
  // Fix-Runde 1: nur der abgelehnte Key fällt, ein anderer gilt wieder
  const h = halter({ antwort: nein('kein-launcher'), raumAlt: { wert: 'test-k1', herkunft: 'stored' } });
  const w1 = await h.h.zugang('connect-raum', 'cop31-tag1');
  h.h.antwort('connect-raum', w1, 401, 'nicht-angemeldet');
  h.alt.raum = { wert: 'test-k2', herkunft: 'stored' };
  const w2 = await h.h.zugang('connect-raum', 'cop31-tag1');
  ck('T11 Fix1: Key K1 abgelehnt, danach K2 eingetragen → alter-key mit K2, nicht mehr abgelehnt',
    w1.art === 'alter-key' && w2.art === 'alter-key' && w2.key === 'test-k2' && !h.h.lage('connect-raum').altAbgelehnt);
  h.h.antwort('connect-raum', w1, 401, 'nicht-angemeldet');
  ck('T11 Fix1: späte 401 für K1, nachdem K2 gesetzt ist → K2 bleibt (nicht gelöscht, weiter alter-key)',
    h.loeschungen.raum === 1 && h.alt.raum.wert === 'test-k2' && (await h.h.zugang('connect-raum', 'cop31-tag1')).art === 'alter-key');
  const e = halter({ antwort: nein('kein-launcher'), raumAlt: { wert: 'test-env', herkunft: 'env' } });
  const we = await e.h.zugang('connect-raum', 'cop31-tag1');
  e.h.antwort('connect-raum', we, 401, 'nicht-angemeldet');
  ck('T11 Fix1: Key aus der Umgebung abgelehnt → wahl keiner, nicht gelöscht', (await e.h.zugang('connect-raum', 'cop31-tag1')).art === 'keiner' && e.loeschungen.raum === 0);
}

{
  // G4
  const g: GehalteneFreigaben = { 'zoom-jwt': frei('zoom-jwt', 'meeting-sdk', 'jm1.test-jwt') };
  const h = halter({ gehalten: g, antwort: (a) => ({ ok: true, freigabe: `jm1.test-${a.zweck}`, bis: T + 72 * H, konto: KONTO }), raumAlt: { wert: 'test-alt', herkunft: 'stored' } });
  await h.h.zugang('connect-raum', 'cop31-tag1');
  await h.h.zugang('zoom-sdk', 'win-x64');
  const t = h.h.tokens();
  const f = halter({ antwort: nein('fehler', 'jm1.test-detail-ohne-token'), raumAlt: { wert: 'test-alt', herkunft: 'stored' } });
  await f.h.zugang('connect-raum', 'cop31-tag1');
  const alle = [...h.logs, ...f.logs];
  ck('T11 G4: tokens() nennt alle gehaltenen Freigaben; keine Logzeile enthält jm1.',
    t.length === 3 && t.includes('jm1.test-connect-raum') && t.includes('jm1.test-zoom-sdk') && t.includes('jm1.test-jwt')
      && alle.length >= 2 && alle.every((z) => !z.includes('jm1.') && !z.includes('test-alt')));
}

{
  // Fehlerwege
  const w = halter({ antwort: () => { throw new Error('boom jm1.test-leck'); } });
  const wahl = await w.h.zugang('connect-raum', 'cop31-tag1');
  ck('T11: wirft holeFreigabe, wird daraus ein Grund fehler (kein Absturz, kein Wurftext im Log)',
    wahl.art === 'keiner' && w.h.lage('connect-raum').letzterGrund === 'fehler' && w.logs.every((z) => !z.includes('jm1.')));
  const u = halter({ antwort: () => ({ ok: true, freigabe: 'kein gueltiges token', bis: T + 72 * H, konto: KONTO }) });
  const wu = await u.h.zugang('connect-raum', 'cop31-tag1');
  ck('T11: unbrauchbare Freigabe-Antwort → nicht gehalten, nicht gespeichert, Grund fehler',
    wu.art === 'keiner' && u.gespeichert.length === 0 && u.h.lage('connect-raum').letzterGrund === 'fehler');
  const z = halter({ antwort: ok('jm1.test-raum') });
  const wz = await z.h.zugang('connect-raum', '');
  ck('T11: ohne Ziel kein Versuch (nichts zu holen)', z.aufrufe.length === 0 && wz.art === 'keiner');
  const g = halter({ antwort: ok('jm1.test-raum') });
  const n0 = g.geaendert();
  await g.h.zugang('connect-raum', 'cop31-tag1');
  ck('T11: jede Änderung ruft geaendert()', n0 === 0 && g.geaendert() >= 1);
}

{
  // Je Zweck ein eigener Versuch
  const h = halter({ antwort: async (a) => { await new Promise((r) => setTimeout(r, 5)); return { ok: true, freigabe: `jm1.test-${a.zweck}`, bis: T + 72 * H, konto: KONTO }; } });
  const [r, s, j] = await Promise.all([h.h.zugang('connect-raum', 'cop31-tag1'), h.h.zugang('zoom-sdk', 'win-x64'), h.h.zugang('zoom-jwt', 'meeting-sdk')]);
  ck('T11: drei Zwecke gleichzeitig → je ein Versuch, jeder bekommt seine Freigabe',
    h.aufrufe.length === 3 && r.art === 'freigabe' && r.f.zweck === 'connect-raum' && s.art === 'freigabe' && s.f.zweck === 'zoom-sdk' && j.art === 'freigabe' && j.f.zweck === 'zoom-jwt');
}

{
  const hs = read('src/main/zugang/halter.ts');
  const hue = read('src/main/zugang/huelle.ts');
  ck('T11 G9: halter.ts importiert zur Laufzeit nur aus ./regeln, nie electron; huelle.ts schreibt nur die Ausgabe von geheimnisDatei',
    hs.split('\n').filter((l) => /^import (?!type)/.test(l)).every((l) => l.includes("from './regeln'"))
      && !hs.includes("'electron'")
      && hue.includes('geheimnisDatei(') && !/writeFileSync\([^)]*JSON\.stringify/.test(hue));
  ck('T11 G9: huelle.ts schreibt atomar (.tmp, renameSync) mit 0o600', hue.includes('renameSync(') && hue.includes('.tmp') && hue.includes('0o600'));
  ck('T11 G9: huelle.ts nennt die Logzeile für die unlesbare Datei wörtlich',
    hue.includes('[connect] Zugang: gehaltene Freigaben nicht lesbar, Connect holt neue beim Launcher') && hue.includes('connect-zugang.bin') && hue.includes('0o600'));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
