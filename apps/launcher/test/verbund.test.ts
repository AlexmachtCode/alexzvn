// Verbund-Rollen des Launchers OHNE Electron (tsx): npm run selftest:verbund -w @jm/launcher
// Master und Slaves laufen in EINEM Prozess mit getrennten appData-/userData-Ordnern auf 127.0.0.1.
// Auch der Kern hinter verbund/index.ts (verbund/kern.ts: Kette, Schreibsperre, Rollenstart) läuft hier ohne Electron.
import { X509Certificate } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { connect, createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  fingerprintVonPem, leseMasterLinkDatei, masterLinkPfad, MasterLinkClient, pruefeIdentitaet, schreibeMasterLinkDatei,
  type BonjourFabrik, type Lesen, type MasterLinkDatei, type NetzwerkInterfaces, type SucheLike,
} from '@jm/master-link';
import { erzeugeVerbundKern, type VerbundKernDeps } from '../src/main/verbund/kern';
import { fehlerCode } from '../src/main/verbund/fehlercode';
import { MasterRolle, type MasterAbhaengigkeiten } from '../src/main/verbund/master';
import { koppelText, SlaveRolle, teileAdresse, type SlaveAbhaengigkeiten } from '../src/main/verbund/slave';
import { beobachte, kartenLage, leseBisLesbar } from '../src/main/verbund/wache';
import { erzeugeMasterIdentitaet } from '../src/main/verbund/zertifikat';
import { kopfanzeige, kopfEingang } from '../src/renderer/src/lib/kopfanzeige';
import type { VerbundStand } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function bis(f: () => boolean, maxMs = 3000): Promise<boolean> {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) { if (f()) return true; await warte(20); }
  return f();
}
async function freierPort(): Promise<number> {
  const s = createServer();
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const p = (s.address() as AddressInfo).port;
  await new Promise<void>((r) => s.close(() => r()));
  return p;
}
const verweigert = (port: number, host = '127.0.0.1') => new Promise<boolean>((r) => {
  const s = connect(port, host);
  s.on('connect', () => { s.destroy(); r(false); });
  s.on('error', () => r(true));
});

const KURZ = {
  dateiPruefMs: 50, rueckzugBasisMs: 50, rueckzugMaxMs: 200, tcpMs: 300, tlsHalloMs: 500, angemeldetMs: 500,
  stilleMs: 800, pulsMs: 200, zertifikatWiederholMs: 300, kartenPruefMs: 200, gesehenSchreibMs: 100,
};
const log = () => {};
/** Log mit Mitschrift: für Tests, die das Logverhalten prüfen. */
function logMitschrift(): { log: (stufe: 'info' | 'warn', text: string) => void; zeilen: string[] } {
  const zeilen: string[] = [];
  return { log: (stufe, text) => { zeilen.push(`${stufe}: ${text}`); }, zeilen };
}
const gesperrtMit = (code: string): Error => Object.assign(new Error('gesperrt'), { code });

// Temp-Ordner (jmvb-*) räumt der Test am Ende selbst auf — auch bei Abbruch (exit-Ereignis, synchron).
const tempOrdner: string[] = [];
function temp(prefix: string): string {
  const p = mkdtempSync(join(tmpdir(), prefix));
  tempOrdner.push(p);
  return p;
}
process.on('exit', () => {
  for (const p of tempOrdner) {
    try { rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch { /* Ordner bleibt: nächster Lauf räumt nicht — Windows hält ihn noch */ }
  }
});

function rechner(rolle: MasterLinkDatei['rolle'], name: string) {
  const appData = temp('jmvb-app-');
  const speicherDir = join(temp('jmvb-user-'), 'master-link');
  const pfad = masterLinkPfad(appData);
  let datei: MasterLinkDatei = { version: 1, rolle, rechner: { id: `${name}-id`, name }, netzwerk: { karte: null }, kopplung: null };
  return {
    pfad, speicherDir,
    lies: () => datei,
    schreibe: (d: MasterLinkDatei) => { datei = d; schreibeMasterLinkDatei(pfad, d); },
  };
}

function neuerMaster(A: ReturnType<typeof rechner>, port: number, extra: Partial<MasterAbhaengigkeiten> = {}) {
  return new MasterRolle({
    speicherDir: A.speicherDir, suiteVersion: '0.12.0', datei: A.lies, schreibeDatei: A.schreibe,
    beiAenderung: () => {}, log, port, fristen: KURZ, netzwerkKarten: () => ({}), mdnsFabrik: null,
    lauschAdressen: ['127.0.0.1'], ...extra,
  });
}
function neuerSlave(B: ReturnType<typeof rechner>, extra: Partial<SlaveAbhaengigkeiten> = {}) {
  return new SlaveRolle({
    dateiPfad: B.pfad, suiteVersion: '0.12.0', datei: B.lies, schreibeDatei: B.schreibe,
    beiAenderung: () => {}, log, fristen: KURZ, netzwerkKarten: () => ({}), suche: null, listenSuche: null, ...extra,
  });
}

// --- Hilfen -------------------------------------------------------------------
ck('teileAdresse: IP ohne Port -> 8738', JSON.stringify(teileAdresse('10.0.0.110')) === JSON.stringify({ host: '10.0.0.110', port: 8738 }));
ck('teileAdresse: mit Port', teileAdresse('127.0.0.1:18738')?.port === 18738);
ck('teileAdresse: leer -> null', teileAdresse('  ') === null);
ck('koppelText code-falsch nennt Restversuche', koppelText({ ok: false, art: 'abgelehnt', grund: 'code-falsch', rest: 3 }, 'Regie-PC', '10.0.0.1') === 'Code stimmt nicht, noch 3 Versuche.');
ck('koppelText Frist', koppelText({ ok: false, art: 'frist' }, 'Regie-PC', '10.0.0.1') === 'Der Master hat nicht rechtzeitig bestätigt. Nichts gespeichert.');

ck('fehlerCode: nur der Code, nie der Text; ohne Code „UNBEKANNT“', fehlerCode(gesperrtMit('EPERM')) === 'EPERM' && fehlerCode(new Error('x')) === 'UNBEKANNT'
  && fehlerCode(null) === 'UNBEKANNT' && fehlerCode('text') === 'UNBEKANNT' && fehlerCode({ code: 5 }) === 'UNBEKANNT');

// --- Identität: ein Zertifikat, das OpenSSL ablehnt, wird nie geschrieben (Spec 3.5, 7.2) -----
{
  // GEMESSEN: selfsigned 2.4.1/node-forge 1.4.0 macht aus den Zufallsbytes 80 00 12 … die Seriennummer 00 00 12 …
  // (nicht minimal kodiert, ≈1/65536) → ERR_OSSL_ASN1_ILLEGAL_PADDING. Der Master startete nie, schrieb aber identitaet.json.
  const req = createRequire(import.meta.url);
  const forge = req(req.resolve('node-forge', { paths: [dirname(req.resolve('selfsigned'))] }));
  const echt = forge.random.getBytesSync;
  let wuerfe = 0;
  let unbrauchbar = 1; // so viele Seriennummern (9 Zufallsbytes) werden erzwungen
  forge.random.getBytesSync = (n: number): string =>
    (n === 9 && wuerfe++ < unbrauchbar ? '\x80\x00\x12\x34\x56\x78\x9a\xbc\xde' : echt(n));
  try {
    const neu = erzeugeMasterIdentitaet('Regie-PC');
    ck('Seriennummer 00 00 xx: neu erzeugt, die Identität besteht pruefeIdentitaet', wuerfe === 2 && pruefeIdentitaet(neu) !== null);
    wuerfe = 0;
    unbrauchbar = Infinity;
    let geworfen = false;
    try { erzeugeMasterIdentitaet('Regie-PC'); } catch { geworfen = true; }
    ck('nie brauchbar: Wurf nach 5 Versuchen statt einer unbrauchbaren Identität', geworfen && wuerfe === 5);
  } finally {
    forge.random.getBytesSync = echt;
  }
}

// --- Master: Start, Selbstkopplung, eigenes Tool ------------------------------
const port = await freierPort();
const A = rechner('master', 'Regie-PC');
const master = neuerMaster(A, port);
await master.starte();
ck('Master läuft', master.stand().zustand === 'laeuft');
const zweiter = neuerMaster(rechner('master', 'Zweit-PC'), port);
await zweiter.starte();
ck('zweiter Master auf belegtem Port → „port-belegt“', zweiter.stand().zustand === 'port-belegt' && zweiter.stand().fehlerCode === 'EADDRINUSE');
await zweiter.stoppe();
const id = pruefeIdentitaet(JSON.parse(readFileSync(join(A.speicherDir, 'identitaet.json'), 'utf8')));
ck('Identität erzeugt und gespeichert', id !== null);
const zert = new X509Certificate(id!.zertifikat);
ck('Zertifikat RSA-2048, SHA-256, ein Jahr zurückdatiert (Spec 3.5)',
  zert.publicKey.asymmetricKeyDetails?.modulusLength === 2048
  && zert.raw.includes(Buffer.from('2a864886f70d01010b', 'hex'))
  && Date.now() - Date.parse(zert.validFrom) > 360 * 24 * 3600 * 1000);
const kA = A.lies().kopplung;
ck('Selbstkopplung in master-link.json (Port, Fingerprint)', kA !== null && kA.port === port && kA.fingerprint === fingerprintVonPem(id!.zertifikat));
ck('„dieser Rechner“ im Verbund', master.stand().rechner.some((r) => r.dieserRechner && r.rechnerId === 'Regie-PC-id'));

const timerA = new MasterLinkClient({ dateiPfad: A.pfad, teilnehmer: { art: 'tool', appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1 }, fristen: KURZ, suche: null });
timerA.starte();
await bis(() => timerA.zustand().art === 'verbunden');
ck('Tool am Master-Rechner verbindet über 127.0.0.1', timerA.zustand().art === 'verbunden');
await bis(() => master.stand().rechner.find((r) => r.dieserRechner)?.tools.some((t) => t.appId === 'jm-timer') === true);
ck('Master zeigt das eigene Tool unter „dieser Rechner“', master.stand().rechner.find((r) => r.dieserRechner)!.tools.some((t) => t.appId === 'jm-timer'));

// --- Slave B koppelt ------------------------------------------------------------
const B = rechner('slave', 'Regie-Laptop 2');
const slaveB = neuerSlave(B);
slaveB.starte();
master.oeffneKopplung();
const code = master.stand().kopplung.code!;
const falsch = await slaveB.koppele(`127.0.0.1:${port}`, code === '2222222222' ? '3333333333' : '2222222222');
ck('falscher Code: Text mit Restversuchen', !falsch.ok && falsch.text === 'Code stimmt nicht, noch 4 Versuche.');
const restVorher = master.stand().kopplung.rest;
const oZeichen = await slaveB.koppele(`127.0.0.1:${port}`, 'K7QXO3PRTH');
ck('fremdes Zeichen wird lokal gemeldet', !oZeichen.ok && oZeichen.text === 'Das Zeichen O kommt im Code nicht vor.');
ck('… ohne Verbindung, kein Fehlversuch am Master (Spec 3.2, 11.1 Nr. 1)', master.stand().kopplung.rest === restVorher);
const gutLaeuft = slaveB.koppele(`127.0.0.1:${port}`, code);
const beimKoppeln: VerbundStand = {
  rolle: 'slave', rechnerName: 'Regie-Laptop 2', karten: [], gewaehlteKarte: null, karteFehlt: false, dateiFehler: null,
  master: null, slave: slaveB.stand(),
};
ck('erstes Koppeln: Kopf „Koppeln mit ⟨Name⟩…“ nennt das Ziel (Spec 5.4)', kopfanzeige(kopfEingang(beimKoppeln)).text === 'Koppeln mit 127.0.0.1…');
const gut = await gutLaeuft;
ck('richtiger Code: gekoppelt', gut.ok);
ck('Kopplungsverbindung sofort übernommen (nicht erst über die Dateiprüfung)', ['verbindet', 'verbunden'].includes(slaveB.stand().client.art));
ck('„koppelt gerade“ danach wieder aus', !slaveB.stand().koppeltGerade);
ck('Slave-Datei hat die Kopplung', B.lies().kopplung?.fingerprint === kA!.fingerprint);
ck('von Hand eingetragene Adresse wird feste Adresse (Spec 4.5)', B.lies().kopplung?.festeAdresse === '127.0.0.1');
const vbText = readFileSync(join(A.speicherDir, 'verbund.json'), 'utf8');
ck('verbund.json: B mit öffentlichem Schlüssel, KEIN privater Schlüssel in der Datei (Spec 11.1 Nr. 4)',
  vbText.includes(B.lies().kopplung!.schluessel.oeffentlich)
  && !vbText.includes(B.lies().kopplung!.schluessel.privat) && !vbText.includes(A.lies().kopplung!.schluessel.privat));
await bis(() => slaveB.stand().client.art === 'verbunden');
ck('Slave-Launcher verbunden (übernommene Verbindung)', slaveB.stand().client.art === 'verbunden');
await bis(() => master.stand().rechner.some((r) => r.rechnerId === 'Regie-Laptop 2-id' && r.online));
ck('Master: fremder Rechner online mit Launcher', master.stand().rechner.find((r) => r.rechnerId === 'Regie-Laptop 2-id')?.tools.some((t) => t.art === 'launcher') === true);

// --- Slave C koppelt, B wird entfernt -------------------------------------------
const C = rechner('slave', 'Aufnahme-PC');
const slaveC = neuerSlave(C);
slaveC.starte();
master.oeffneKopplung();
ck('zweiter Rechner koppelt', (await slaveC.koppele(`127.0.0.1:${port}`, master.stand().kopplung.code!)).ok);
await bis(() => slaveC.stand().client.art === 'verbunden');
ck('Reihenfolge: „dieser Rechner“ zuerst, dann nach Name', master.stand().rechner.map((r) => r.name).join('|') === 'Regie-PC|Aufnahme-PC|Regie-Laptop 2');
master.entferne('Regie-Laptop 2-id');
await bis(() => slaveB.stand().client.code === 'unbekannt', 1000);
ck('B entfernt während verbunden → „unbekannt“ binnen 1 s', slaveB.stand().client.code === 'unbekannt');
ck('C bleibt verbunden', slaveC.stand().client.art === 'verbunden');
const D = rechner('slave', 'Studio-PC');
const slaveD = neuerSlave(D);
slaveD.starte();
master.oeffneKopplung();
ck('dritter Rechner koppelt', (await slaveD.koppele(`127.0.0.1:${port}`, master.stand().kopplung.code!)).ok);
await bis(() => master.stand().rechner.some((r) => r.rechnerId === 'Studio-PC-id' && r.online));
await slaveD.stoppe();
await bis(() => master.stand().rechner.find((r) => r.rechnerId === 'Studio-PC-id')?.online === false);
ck('Rechner aus → bleibt im Verbund, aber offline', master.stand().rechner.find((r) => r.rechnerId === 'Studio-PC-id')?.online === false);

// --- Identität erneuern ---------------------------------------------------------
await master.erneuereIdentitaet();
const idNeu = pruefeIdentitaet(JSON.parse(readFileSync(join(A.speicherDir, 'identitaet.json'), 'utf8')))!;
ck('neue Identität, Selbstkopplung im selben Schritt neu geschrieben', A.lies().kopplung?.fingerprint === fingerprintVonPem(idNeu.zertifikat));
ck('fremde Rechner aus dem Verbund entfernt', master.stand().rechner.every((r) => r.dieserRechner));
await bis(() => slaveC.stand().client.code === 'zertifikat', 3000);
ck('fremder Rechner meldet „zertifikat“', slaveC.stand().client.code === 'zertifikat');
await bis(() => timerA.zustand().art === 'verbunden', 3000);
ck('eigenes Tool verbindet ohne Zutun wieder', timerA.zustand().art === 'verbunden');

// --- Schnell umschalten (Review Focus 2) ----------------------------------------
const selbstVorher = A.lies().kopplung!.schluessel.oeffentlich;
await master.stoppe();
await master.starte();
await master.stoppe();
await master.starte();
ck('Aus/An zweimal schnell: läuft, Port wieder frei', master.stand().zustand === 'laeuft');
ck('Neustart behält den Selbst-Schlüssel (eigene Tools bleiben gültig)', A.lies().kopplung?.schluessel.oeffentlich === selbstVorher);
await master.stoppe();
const startLaeuft = master.starte();
await master.stoppe();
await startLaeuft;
ck('Aus während des Starts → Port bleibt zu', await verweigert(port));
// Wie setzeRolle „Master → Aus → Master“: eine NEUE MasterRolle, während die alte noch startet.
const vorige = neuerMaster(A, port);
const voriger = vorige.starte();
await vorige.stoppe(); // wartet den laufenden Start ab — danach ist der Port frei
const folgende = neuerMaster(A, port);
await folgende.starte();
ck('Aus während des Starts, sofort neue MasterRolle → läuft (kein EADDRINUSE)', folgende.stand().zustand === 'laeuft');
await voriger;
await folgende.stoppe();

// --- Gewählte Karte fällt weg (Kabel gezogen): nur ihr Lauscher schließt (Spec 2, 4.3) ---
{
  const pK = await freierPort();
  const K = rechner('master', 'Kabel-PC');
  K.schreibe({ ...K.lies(), netzwerk: { karte: 'Ethernet 2' } });
  // 127.0.0.2 steht für die Karten-IP: ohne Einrichtung bindbar (Windows, Linux); listeKarten nimmt sie (internal: false).
  const ethernet2: NetzwerkInterfaces = {
    'Ethernet 2': [{ address: '127.0.0.2', netmask: '255.0.0.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal: false, cidr: '127.0.0.2/8' }],
  };
  let karten: NetzwerkInterfaces = ethernet2;
  const mK = new MasterRolle({
    speicherDir: K.speicherDir, suiteVersion: '0.12.0', datei: K.lies, schreibeDatei: K.schreibe,
    beiAenderung: () => {}, log, port: pK, fristen: KURZ, netzwerkKarten: () => karten, mdnsFabrik: null,
  });
  await mK.starte();
  const tK = new MasterLinkClient({ dateiPfad: K.pfad, teilnehmer: { art: 'tool', appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 3 }, fristen: KURZ, suche: null });
  tK.starte();
  await bis(() => tK.zustand().art === 'verbunden');
  const seit = (tK.zustand() as { seit?: number }).seit;
  ck('Karte gewählt: lauscht auf ihrer IP und auf 127.0.0.1', !(await verweigert(pK, '127.0.0.2')) && tK.zustand().art === 'verbunden');
  karten = {}; // wie os.networkInterfaces() nach dem Kabelziehen (Windows meldet nur Karten mit Status „Up“)
  await mK.pruefeKarten();
  await warte(300);
  ck('Karte weg: eigenes Tool bleibt über 127.0.0.1 verbunden (dieselbe Sitzung)',
    tK.zustand().art === 'verbunden' && (tK.zustand() as { seit?: number }).seit === seit);
  ck('… nur der Lauscher der Karte ist zu', await verweigert(pK, '127.0.0.2'));
  karten = ethernet2;
  await mK.pruefeKarten();
  await warte(300);
  ck('Karte wieder da: ihr Lauscher ist offen, das Tool blieb in derselben Sitzung',
    !(await verweigert(pK, '127.0.0.2')) && (tK.zustand() as { seit?: number }).seit === seit);
  await tK.stoppe();
  await mK.stoppe();
}

// --- Wächter ohne Electron (verbund/wache.ts) -------------------------------------
{
  // Spec 4.1: Karten alle 10 s — ändert sich „Karte fehlt“, meldet der Launcher in JEDER Rolle.
  let ni: NetzwerkInterfaces = {
    'Ethernet 2': [{ address: '10.0.0.110', netmask: '255.255.255.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal: false, cidr: '10.0.0.110/24' }],
  };
  let meldungen = 0;
  const stopp = beobachte(() => JSON.stringify(kartenLage(ni, 'Ethernet 2')), () => { meldungen++; }, 20);
  await warte(80);
  ck('Karten unverändert → keine Meldung', meldungen === 0 && !kartenLage(ni, 'Ethernet 2').karteFehlt);
  ni = {};
  await bis(() => meldungen > 0, 500);
  await warte(80);
  ck('gewählte Karte weg → genau eine Meldung, „Karte fehlt“', meldungen === 1 && kartenLage(ni, 'Ethernet 2').karteFehlt);
  stopp();

  // Spec 7.3/10: master-link.json beim Start nicht lesbar → gesperrt melden, erneut lesen, bis es gelingt.
  const io: Lesen<MasterLinkDatei> = { art: 'io', code: 'EBUSY' };
  const folge: Lesen<MasterLinkDatei>[] = [io, io, io, { art: 'ok', wert: B.lies() }];
  const gesperrt: string[] = [];
  const r = await leseBisLesbar(() => folge.shift() ?? io, (c) => gesperrt.push(c), { versuche: 2, pauseMs: 5, taktMs: 20 });
  ck('io beim Start: jeder Fehlversuch gesperrt gemeldet, gelesen, sobald es gelingt', r.art === 'ok' && gesperrt.join() === 'EBUSY,EBUSY,EBUSY');
}

// --- Karten-Takt gegen stoppe(): nie Geister-Annonce, nie ein gebundener Port (Review Focus 2) ----------
{
  const pR = await freierPort();
  const R = rechner('master', 'Rennen-PC');
  R.schreibe({ ...R.lies(), netzwerk: { karte: 'Ethernet 2' } });
  const karte = (name: string, ip: string): NetzwerkInterfaces => ({
    [name]: [{ address: ip, netmask: '255.0.0.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal: false, cidr: `${ip}/8` }],
  });
  let karten = karte('Ethernet 2', '127.0.0.2');
  // mDNS-Attrappe: Goodbye dauert 150 ms (echt bis 1 s) — genau das Fenster, in dem aktualisiere() sonst nach stoppe() neu annonciert.
  const lebend = new Set<number>();
  let nr = 0;
  let kaputtFabrik = false;
  const fabrik: BonjourFabrik = () => {
    if (kaputtFabrik) throw gesperrtMit('EMDNS');
    const mein = ++nr;
    lebend.add(mein);
    return {
      publish: () => ({}),
      find: () => ({ stop() { /* nichts */ } }),
      unpublishAll: (cb) => { setTimeout(() => cb?.(), 150); },
      destroy: (cb) => { lebend.delete(mein); cb?.(); },
    };
  };
  const m = neuerMaster(R, pR, { fristen: { ...KURZ, kartenPruefMs: 60_000 }, netzwerkKarten: () => karten, mdnsFabrik: fabrik, lauschAdressen: undefined });
  await m.starte();
  ck('Annonce und Lauscher der gewählten Karte laufen', m.stand().zustand === 'laeuft' && lebend.size === 1 && !(await verweigert(pR, '127.0.0.2')));
  karten = karte('Ethernet 3', '127.0.0.3'); // Kartenwechsel (WLAN/DHCP): Lauscher UND Annonce müssen neu
  const lauf = m.pruefeKarten();
  await m.stoppe(); // Aus — OHNE den Karten-Lauf abzuwarten
  ck('stoppe() wartet den Karten-Lauf ab: danach keine Annonce mehr', lebend.size === 0);
  await lauf;
  await warte(300);
  ck('… und später keine Geister-Annonce auf dem verwaisten Objekt', lebend.size === 0);
  ck('… alle Lauscher (alte Karte, neue Karte, Loopback) sind zu', await verweigert(pR, '127.0.0.2') && await verweigert(pR, '127.0.0.3') && await verweigert(pR));
  const danach = neuerMaster(R, pR);
  await danach.starte();
  ck('neue MasterRolle auf demselben Port → läuft (kein EADDRINUSE)', danach.stand().zustand === 'laeuft');
  await danach.stoppe();

  // Zwei Karten-Läufe (Takt und setzeKarte) überlappen nie: der zweite sieht den Stand des ersten.
  const m2 = neuerMaster(R, pR, { fristen: { ...KURZ, kartenPruefMs: 60_000 }, netzwerkKarten: () => karten, mdnsFabrik: fabrik, lauschAdressen: undefined });
  karten = karte('Ethernet 2', '127.0.0.2');
  await m2.starte();
  karten = karte('Ethernet 3', '127.0.0.3');
  await Promise.all([m2.pruefeKarten(), m2.pruefeKarten(), m2.pruefeKarten()]);
  ck('drei gleichzeitige Karten-Läufe: genau eine Annonce, Lauscher der neuen Karte', lebend.size === 1 && !(await verweigert(pR, '127.0.0.3')) && await verweigert(pR, '127.0.0.2'));

  // Wirft die Annonce (Bonjour-Fabrik), gibt es keine unbehandelte Ablehnung; das Log meldet nur einen Wechsel der Meldung.
  const lm = logMitschrift();
  const m3R = rechner('master', 'Fabrik-PC');
  m3R.schreibe({ ...m3R.lies(), netzwerk: { karte: 'Ethernet 2' } });
  let kartenF = karte('Ethernet 2', '127.0.0.2');
  const pF = await freierPort();
  const m3 = neuerMaster(m3R, pF, { log: lm.log, fristen: { ...KURZ, kartenPruefMs: 60_000 }, netzwerkKarten: () => kartenF, mdnsFabrik: fabrik, lauschAdressen: undefined });
  await m3.starte();
  kaputtFabrik = true;
  kartenF = karte('Ethernet 3', '127.0.0.3');
  await m3.pruefeKarten(); // lehnt NICHT ab
  kartenF = karte('Ethernet 4', '127.0.0.4');
  await m3.pruefeKarten();
  await m3.pruefeKarten(); // gleicher Fehler, nichts geändert: der Versuch wird wiederholt, das Log bleibt still
  ck('Annonce wirft: pruefeKarten lehnt nicht ab, dieselbe Meldung nur einmal im Log', lm.zeilen.filter((z) => z.includes('EMDNS')).length === 1);
  kaputtFabrik = false;
  const vorher = lebend.size;
  await m3.pruefeKarten();
  ck('… und sobald die Fabrik wieder geht, kommt die Annonce von selbst zurück', lebend.size === vorher + 1 && m3.stand().zustand === 'laeuft');
  await m3.stoppe();
  await m2.stoppe();
  ck('alle Annoncen nach dem Aus zu', lebend.size === 0);

  // Beenden des Launchers (before-quit wartet nicht): der Server wird VOR dem mDNS-Goodbye angestoßen — sein
  // synchroner Teil schreibt „zuletzt gesehen“ und zerstört die Sockets; das Goodbye dauert bis 1 s.
  karten = karte('Ethernet 2', '127.0.0.2');
  const mQ = neuerMaster(R, pR, { fristen: { ...KURZ, kartenPruefMs: 60_000 }, netzwerkKarten: () => karten, mdnsFabrik: fabrik, lauschAdressen: undefined });
  await mQ.starte();
  const zuQ = mQ.stoppe();
  await warte(40); // Goodbye der Attrappe: 150 ms
  ck('stoppe(): der Port ist schon zu, während das mDNS-Goodbye noch läuft', await verweigert(pR) && lebend.size === 1);
  await zuQ;
  ck('… danach ist auch die Annonce zu, und die Rolle meldet nicht „läuft“', lebend.size === 0 && mQ.stand().zustand !== 'laeuft');
}

// --- Start-Fehler: nie dauerhaft „startet“, nie eine Meldung, die lügt (Spec 5.4, 7.3) ---------------------
{
  const pI = await freierPort();
  const I = rechner('master', 'Identitaet-PC');
  let sperreI = true;
  const mI = neuerMaster(I, pI, { vorSchreiben: () => { if (sperreI) throw gesperrtMit('EPERM'); } });
  await mI.starte();
  ck('Identität nicht schreibbar → „lausch-fehler“ mit Code (nicht dauerhaft „startet“)', mI.stand().zustand === 'lausch-fehler' && mI.stand().fehlerCode === 'EPERM');
  ck('… der Master lauscht nicht', await verweigert(pI));
  sperreI = false;
  await bis(() => mI.stand().zustand === 'laeuft', 5000);
  ck('nach Wegfall der Ursache startet die Wiederholung den Master', mI.stand().zustand === 'laeuft' && !(await verweigert(pI)));
  await mI.stoppe();

  const pS = await freierPort();
  const S = rechner('master', 'Schreib-PC');
  let sperreS = true;
  const mS = neuerMaster(S, pS, { schreibeDatei: (d) => { if (sperreS) throw gesperrtMit('EACCES'); S.schreibe(d); } });
  await mS.starte();
  ck('Selbstkopplung nicht schreibbar → Startfehler „lausch-fehler“ mit Code', mS.stand().zustand === 'lausch-fehler' && mS.stand().fehlerCode === 'EACCES');
  ck('… Port frei, keine halbe Selbstkopplung', await verweigert(pS) && S.lies().kopplung === null);
  sperreS = false;
  await bis(() => mS.stand().zustand === 'laeuft', 5000);
  ck('… nach Wegfall der Ursache läuft der Master mit Selbstkopplung', mS.stand().zustand === 'laeuft' && S.lies().kopplung !== null);
  await mS.stoppe();
  ck('nach stoppe() meldet die Rolle nicht „läuft“', mS.stand().zustand !== 'laeuft' && mS.stand().rechner.length === 0);

  const pE = await freierPort();
  const E = rechner('master', 'Erneuer-PC');
  let sperreE = false;
  const mE = neuerMaster(E, pE, { vorSchreiben: () => { if (sperreE) throw gesperrtMit('EPERM'); } });
  await mE.starte();
  const fpVorher = E.lies().kopplung!.fingerprint;
  sperreE = true;
  let abgelehnt = false;
  try { await mE.erneuereIdentitaet(); } catch (e) { abgelehnt = (e as { code?: string }).code === 'EPERM'; }
  ck('erneuereIdentitaet mit Schreibfehler → der Aufruf lehnt mit dem ursprünglichen Fehler ab', abgelehnt);
  ck('… und der Master läuft danach wieder (alte Identität, Port offen)', mE.stand().zustand === 'laeuft' && E.lies().kopplung?.fingerprint === fpVorher && !(await verweigert(pE)));
  sperreE = false;
  await mE.stoppe();

  // neuAufsetzen: Löschen scheitert (hier echt: identitaet.json ist ein Ordner → rmSync wirft) → trotzdem starten, dann ablehnen.
  const pN = await freierPort();
  const N = rechner('master', 'Neu-PC');
  mkdirSync(N.speicherDir, { recursive: true });
  const idN = join(N.speicherDir, 'identitaet.json');
  mkdirSync(idN);
  const mN = neuerMaster(N, pN);
  let abgelehntN = false;
  try { await mN.neuAufsetzen(); } catch { abgelehntN = true; }
  ck('neuAufsetzen mit Löschfehler → lehnt ab, der Master steht ehrlich im Fehlerzustand (nicht „startet“/„läuft“)',
    abgelehntN && mN.stand().zustand === 'lausch-fehler' && mN.stand().fehlerCode === 'EISDIR');
  rmSync(idN, { recursive: true });
  await bis(() => mN.stand().zustand === 'laeuft', 5000);
  ck('… nach Wegfall der Ursache startet die Wiederholung den Master', mN.stand().zustand === 'laeuft');
  await mN.stoppe();

  // Dauerhaft belegter Port: „lauscht nicht“ steht einmal im Log, nicht bei jeder Wiederholung (alle 10 s = 8 640/Tag).
  const pB = await freierPort();
  const blocker = createServer();
  await new Promise<void>((r) => blocker.listen(pB, '127.0.0.1', r));
  const lb = logMitschrift();
  const mB = neuerMaster(rechner('master', 'Belegt-PC'), pB, { log: lb.log });
  await mB.starte();
  await warte(900); // KURZ: Wiederholung alle 200 ms → mehrere Versuche
  ck('Port dauerhaft belegt: „lauscht nicht“ genau einmal im Log', mB.stand().zustand !== 'laeuft' && lb.zeilen.filter((z) => z.includes('lauscht nicht')).length === 1);
  await new Promise<void>((r) => blocker.close(() => r()));
  await bis(() => mB.stand().zustand === 'laeuft', 5000);
  ck('… Port frei → die Wiederholung startet den Master', mB.stand().zustand === 'laeuft');
  await mB.stoppe();
  const blocker2 = createServer();
  await new Promise<void>((r) => blocker2.listen(pB, '127.0.0.1', r));
  await mB.starte();
  await warte(400);
  ck('nach Erfolg zurückgesetzt: derselbe Fehler wird beim nächsten Mal wieder gemeldet', lb.zeilen.filter((z) => z.includes('lauscht nicht')).length === 2);
  await mB.stoppe();
  await new Promise<void>((r) => blocker2.close(() => r()));
}

// --- Fremdnamen werden an der Quelle gekürzt (Log, Speicher, Stand) -----------------------------------------
{
  const lang = `${'M'.repeat(70)}\nINJIZIERTE-LOGZEILE`;
  const pL = await freierPort();
  const L = rechner('master', 'Namens-PC');
  mkdirSync(L.speicherDir, { recursive: true });
  const echt = erzeugeMasterIdentitaet('Namens-PC');
  writeFileSync(join(L.speicherDir, 'identitaet.json'), JSON.stringify({ ...echt, name: lang }));
  writeFileSync(join(L.speicherDir, 'verbund.json'), JSON.stringify({
    version: 1,
    rechner: [{ rechnerId: 'fremd', name: 'N'.repeat(200), schluessel: 'AAAA', gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: false }],
  }));
  const mL = neuerMaster(L, pL);
  await mL.starte();
  const stL = mL.stand();
  ck('master.stand(): Master- und Rechnernamen höchstens 60 Zeichen', [...stL.name].length <= 60 && stL.rechner.every((r) => [...r.name].length <= 60));
  const lsl = logMitschrift();
  const SL = rechner('slave', 'Namens-Laptop');
  const slL = neuerSlave(SL, { log: lsl.log });
  slL.starte();
  mL.oeffneKopplung();
  const rl = await slL.koppele(`127.0.0.1:${pL}`, mL.stand().kopplung.code!);
  ck('Koppeln mit langem Master-Namen klappt', rl.ok);
  const gespeichert = SL.lies().kopplung?.masterName ?? '';
  ck('Slave: Master-Name gekürzt gespeichert und gemeldet (kein Zeilenumbruch)',
    [...gespeichert].length <= 60 && !gespeichert.includes('\n') && [...(slL.stand().masterName ?? '')].length <= 60);
  ck('Slave: kein Fremdtext im Log', lsl.zeilen.every((z) => !z.includes('INJIZIERTE-LOGZEILE') && !z.includes('\n')));
  await slL.stoppe();
  await mL.stoppe();
}

// --- Koppeln: nie „gekoppelt“ melden, wenn die Kopplung nicht gespeichert werden konnte (Spec 10) ----------
{
  const pK = await freierPort();
  const KM = rechner('master', 'Koppel-PC');
  const mK = neuerMaster(KM, pK);
  await mK.starte();
  const KS = rechner('slave', 'Schreibfehler-Laptop');
  let sperreK = true;
  const lk = logMitschrift();
  const slK = neuerSlave(KS, { log: lk.log, schreibeDatei: (d) => { if (sperreK) throw gesperrtMit('EPERM'); KS.schreibe(d); } });
  slK.starte();
  mK.oeffneKopplung();
  const r1 = await slK.koppele(`127.0.0.1:${pK}`, mK.stand().kopplung.code!);
  ck('schreibeDatei wirft → ok:false, Text nennt „nicht gespeichert“ und den Code',
    !r1.ok && r1.text.includes('nicht gespeichert') && r1.text.includes('EPERM'));
  ck('… Stand: nicht gekoppelt, nichts in der Datei, „koppelt gerade“ aus', !slK.stand().gekoppelt && KS.lies().kopplung === null && !slK.stand().koppeltGerade);
  await warte(200);
  ck('… die Kopplungsverbindung wurde nicht übernommen', !['verbindet', 'verbunden'].includes(slK.stand().client.art));
  ck('… im Log nur der Code, kein „gekoppelt“', lk.zeilen.every((z) => !z.includes('gekoppelt')) && lk.zeilen.some((z) => z.includes('EPERM')));
  sperreK = false;
  mK.oeffneKopplung();
  const r2 = await slK.koppele(`127.0.0.1:${pK}`, mK.stand().kopplung.code!);
  ck('Ursache weg → Koppeln klappt', r2.ok && slK.stand().gekoppelt && KS.lies().kopplung !== null);
  await bis(() => slK.stand().client.art === 'verbunden');
  ck('… und die Verbindung steht', slK.stand().client.art === 'verbunden');
  await slK.stoppe();
  await mK.stoppe();

  // merkeAdressen: ein Schreibfehler beim Adressnachtrag ist kein Absturz (nur Log, nur Code).
  const pM = await freierPort();
  const MM = rechner('master', 'Adress-PC');
  const mM = neuerMaster(MM, pM);
  await mM.starte();
  const MS = rechner('slave', 'Adress-Laptop');
  let sperreM = false;
  const lma = logMitschrift();
  const slM = neuerSlave(MS, { log: lma.log, schreibeDatei: (d) => { if (sperreM) throw gesperrtMit('EBUSY'); MS.schreibe(d); } });
  slM.starte();
  mM.oeffneKopplung();
  await slM.koppele(`127.0.0.1:${pM}`, mM.stand().kopplung.code!);
  await bis(() => slM.stand().client.art === 'verbunden', 3000);
  await slM.stoppe();
  // Gespeicherte Adressen weichen von dem ab, was der Master meldet → die nächste Anmeldung müsste nachtragen (= schreiben).
  const kM = MS.lies().kopplung!;
  MS.schreibe({ ...MS.lies(), kopplung: { ...kM, adressen: ['9.9.9.9'] } });
  sperreM = true;
  slM.starte();
  await bis(() => lma.zeilen.some((z) => z.includes('EBUSY')), 3000);
  await bis(() => slM.stand().client.art === 'verbunden', 3000);
  ck('Schreibfehler beim Adressnachtrag: nur der Code im Log, die Verbindung steht trotzdem',
    lma.zeilen.some((z) => z.includes('EBUSY')) && slM.stand().client.art === 'verbunden');
  sperreM = false;
  await slM.stoppe();
  await mM.stoppe();
}

// --- Slave: Such-Runde und zweites koppele() ---------------------------------------------------------------
{
  let wurf = 'EBOOM';
  const attrappe: SucheLike = {
    setzeKarten: () => { throw gesperrtMit(wurf); },
    runde: async () => [],
    stoppe: () => {},
  };
  const ls = logMitschrift();
  const SS = rechner('slave', 'Such-Laptop');
  const slS = neuerSlave(SS, { log: ls.log, listenSuche: attrappe, suchTaktMs: 30 });
  slS.starteSuche();
  await warte(250); // mehrere Runden, alle werfen
  ck('Such-Runde wirft: keine unbehandelte Ablehnung, dieselbe Meldung nur einmal im Log', ls.zeilen.filter((z) => z.includes('EBOOM')).length === 1);
  wurf = 'EANDERS';
  await warte(150);
  ck('… eine andere Meldung wird wieder geloggt', ls.zeilen.filter((z) => z.includes('EANDERS')).length === 1);
  slS.stoppeSuche();

  // Ein zweites koppele() bricht das erste ab; dessen Ende darf „Koppeln mit …“ des zweiten nicht ausschalten.
  // Beide Versuche gehen an einen Dienst, der annimmt und schweigt (Hallo-Frist KURZ.tlsHalloMs = 500 ms): deterministisch „läuft noch“.
  const stumme: import('node:net').Socket[] = [];
  const stumm = createServer((s) => { stumme.push(s); s.on('error', () => {}); });
  await new Promise<void>((r) => stumm.listen(0, '127.0.0.1', r));
  const pStumm = (stumm.address() as AddressInfo).port;
  const ZS = rechner('slave', 'Zweit-Laptop');
  const slZ = neuerSlave(ZS);
  slZ.starte();
  const erstes = slZ.koppele(`127.0.0.1:${pStumm}`, 'K7QXP3PRTH');
  await warte(30);
  const zweites = slZ.koppele(`127.0.0.1:${pStumm}`, 'K7QXP3PRTH');
  const e1 = await erstes;
  ck('erstes koppele() wird vom zweiten abgebrochen', !e1.ok && e1.text === 'Koppeln abgebrochen. Nichts gespeichert.');
  ck('… dessen Ende schaltet „Koppeln mit …“ des noch laufenden zweiten NICHT aus', slZ.stand().koppeltGerade);
  const z2 = await zweites;
  ck('zweites koppele() endet (kein Master), danach „koppelt gerade“ aus', !z2.ok && !slZ.stand().koppeltGerade);
  await slZ.stoppe();
  stumme.forEach((s) => s.destroy());
  await new Promise<void>((r) => stumm.close(() => r()));
}

// --- Kern des Verbunds (verbund/kern.ts): die Logik hinter verbund/index.ts, ohne Electron ---------------------
/** Ein Rechner mit eigenen appData-/userData-Ordnern; `rolle` null = keine master-link.json. */
function kernRechner(name: string, rolle: MasterLinkDatei['rolle'] | null, port: number, extra: (pfad: string) => Partial<VerbundKernDeps> = () => ({})) {
  const pfad = masterLinkPfad(temp('jmvb-kapp-'));
  const userData = temp('jmvb-kuser-');
  if (rolle !== null) {
    schreibeMasterLinkDatei(pfad, { version: 1, rolle, rechner: { id: `${name}-id`, name }, netzwerk: { karte: null }, kopplung: null });
  }
  const meldungen = { n: 0 };
  const protokoll = logMitschrift();
  const kern = erzeugeVerbundKern({
    dateiPfad: () => pfad, speicherDir: () => join(userData, 'master-link'), suiteVersion: () => '0.12.0', log: protokoll.log,
    netzwerkKarten: () => ({}), lesen: { versuche: 2, pauseMs: 5, taktMs: 20 }, kartenTaktMs: 50, meldeVerzoegerungMs: 10,
    master: { port, fristen: KURZ, mdnsFabrik: null, lauschAdressen: ['127.0.0.1'] },
    slave: { fristen: KURZ, suche: null, listenSuche: null },
    ...extra(pfad),
  });
  kern.setzeMelder(() => { meldungen.n++; });
  return { kern, pfad, meldungen, protokoll };
}
const dateiDaten = (pfad: string): MasterLinkDatei | null => {
  const r = leseMasterLinkDatei(pfad);
  return r.art === 'ok' ? r.wert : null;
};
const dateiRolle = (pfad: string): string | null => dateiDaten(pfad)?.rolle ?? null;

{
  // Master → Aus → Master über die Kette `nacheinander` (Review Focus 2 auf IPC-Ebene, nicht nur auf Rollenebene).
  const pK = await freierPort();
  const K = kernRechner('Kern-PC', 'master', pK);
  await K.kern.starte();
  ck('Kern: Master aus der Datei gestartet', K.kern.stand().rolle === 'master' && K.kern.stand().master?.zustand === 'laeuft');
  const [s1, s2, s3, s4] = await Promise.all([ // überlappende IPC-Aufrufe, ohne zwischendurch zu warten
    K.kern.setzeRolle('aus'), K.kern.setzeRolle('master'), K.kern.setzeRolle('aus'), K.kern.setzeRolle('master'),
  ]);
  ck('Master → Aus → Master → Aus → Master: die Aufrufe überholen sich nicht', s1.rolle === 'aus' && s2.rolle === 'master' && s3.rolle === 'aus' && s4.rolle === 'master');
  ck('… am Ende läuft der Master (kein EADDRINUSE), Datei steht auf „master“', s4.master?.zustand === 'laeuft' && !(await verweigert(pK)) && dateiRolle(K.pfad) === 'master');
  ck('… und die Änderungen wurden gemeldet', await bis(() => K.meldungen.n > 0, 1000));
  const aus = await K.kern.setzeRolle('aus');
  ck('Aus: Port sofort frei, keine Rolle, Selbstkopplung weg', aus.rolle === 'aus' && aus.master === null && await verweigert(pK) && dateiDaten(K.pfad)?.kopplung === null);
  await K.kern.beende();
}

{
  // master-link.json beim Start nicht lesbar (Virenscanner): nichts starten, nichts schreiben, nichts ändern.
  const p2 = await freierPort();
  let lesbar = false;
  const io: Lesen<MasterLinkDatei> = { art: 'io', code: 'EBUSY' };
  const K2 = kernRechner('Sperr-PC', 'master', p2, (pfad) => ({ lies: () => (lesbar ? leseMasterLinkDatei(pfad) : io) }));
  const inhaltVorher = readFileSync(K2.pfad, 'utf8');
  const gestartet = K2.kern.starte();
  await bis(() => K2.kern.stand().dateiFehler === 'EBUSY', 2000);
  const gesperrt = K2.kern.stand();
  ck('Datei nicht lesbar: der Stand meldet den Code, keine Rolle läuft', gesperrt.dateiFehler === 'EBUSY' && gesperrt.master === null && gesperrt.slave === null);
  let wurfCode = '';
  try { K2.kern.setzeRechnerName('Anders'); } catch (e) { wurfCode = (e as { code?: string }).code ?? ''; }
  ck('schreibe wirft bei dateiFehler (Code im Error) und ändert nichts', wurfCode === 'EBUSY' && K2.kern.stand().rechnerName === gesperrt.rechnerName && readFileSync(K2.pfad, 'utf8') === inhaltVorher);
  let karteAbgelehnt = false;
  try { await K2.kern.setzeKarte('Ethernet 2'); } catch { karteAbgelehnt = true; }
  ck('setzeKarte lehnt ab, die Kartenwahl bleibt unverändert', karteAbgelehnt && K2.kern.stand().gewaehlteKarte === null && readFileSync(K2.pfad, 'utf8') === inhaltVorher);
  const s = await K2.kern.setzeRolle('slave');
  ck('setzeRolle bei dateiFehler startet keine Rolle auf der Ersatzdatei', s.rolle === 'aus' && s.slave === null && s.master === null && readFileSync(K2.pfad, 'utf8') === inhaltVorher);
  ck('… im Log nur der Code', K2.protokoll.zeilen.some((z) => z.includes('EBUSY')));
  lesbar = true;
  await gestartet;
  const danach = K2.kern.stand();
  ck('Datei wieder lesbar: die Rolle aus der Datei startet, der Fehler ist weg', danach.dateiFehler === null && danach.rolle === 'master' && danach.master?.zustand === 'laeuft' && !(await verweigert(p2)));
  await K2.kern.beende();
}

{
  // 'defekt' → Slave, ohne etwas zu schreiben (Ruling: so lassen).
  const K3 = kernRechner('Defekt-PC', null, 0);
  mkdirSync(dirname(K3.pfad), { recursive: true });
  writeFileSync(K3.pfad, 'Müll');
  await K3.kern.starte();
  const st3 = K3.kern.stand();
  ck('master-link.json defekt → der Launcher startet als Slave (Ersatzdatei nur im Speicher)', st3.rolle === 'slave' && st3.slave !== null && st3.master === null);
  ck('… nichts geschrieben: die defekte Datei steht unverändert da', readFileSync(K3.pfad, 'utf8') === 'Müll');
  await bis(() => K3.kern.stand().slave?.client.code === 'datei', 3000);
  ck('… der Client meldet „Kopplung beschädigt“', K3.kern.stand().slave?.client.code === 'datei');
  ck('… und schreibt auch dann nichts', readFileSync(K3.pfad, 'utf8') === 'Müll');
  await K3.kern.beende();
}

{
  // Schreibfehler in setzeRolle: vorige Rolle läuft wieder, der Aufruf lehnt ab; übrige Aufrufe lehnen ab, Stand unverändert.
  const p4 = await freierPort();
  let sperre = false;
  const K4 = kernRechner('Rolle-PC', 'master', p4, () => ({
    schreibeAufPlatte: (pfad, dd) => { if (sperre) throw gesperrtMit('EPERM'); schreibeMasterLinkDatei(pfad, dd); },
  }));
  await K4.kern.starte(); // schreibt die Selbstkopplung (noch nicht gesperrt)
  const vorher = readFileSync(K4.pfad, 'utf8');
  const nameVorher = K4.kern.stand().rechnerName;
  sperre = true;
  let abgelehnt4: { code?: string } | null = null;
  try { await K4.kern.setzeRolle('slave'); } catch (e) { abgelehnt4 = e as { code?: string }; }
  ck('setzeRolle mit Schreibfehler: der Aufruf lehnt mit dem Fehler ab', abgelehnt4?.code === 'EPERM');
  const nach = K4.kern.stand();
  ck('… die vorige Rolle läuft aus der unveränderten Datei wieder (Master, Port offen, kein Slave)',
    nach.rolle === 'master' && nach.master?.zustand === 'laeuft' && nach.slave === null && !(await verweigert(p4)) && readFileSync(K4.pfad, 'utf8') === vorher);
  let nameWurf = false;
  try { K4.kern.setzeRechnerName('Geändert'); } catch { nameWurf = true; }
  ck('setzeRechnerName mit Schreibfehler: lehnt ab, Name unverändert — auch in der Liste des Masters (keine Folgeaktion)',
    nameWurf && K4.kern.stand().rechnerName === nameVorher && K4.kern.stand().master?.rechner.find((r) => r.dieserRechner)?.name === nameVorher);
  let karteWurf = false;
  try { await K4.kern.setzeKarte('Ethernet 2'); } catch { karteWurf = true; }
  ck('setzeKarte mit Schreibfehler: lehnt ab, Kartenwahl unverändert', karteWurf && K4.kern.stand().gewaehlteKarte === null);
  sperre = false;
  const s4 = await K4.kern.setzeRolle('slave');
  ck('Ursache weg: der Rollenwechsel klappt (Master zu, Slave läuft)', s4.rolle === 'slave' && s4.slave !== null && s4.master === null && await verweigert(p4) && dateiRolle(K4.pfad) === 'slave');
  await K4.kern.beende();

  // Slave über den Kern koppeln; Trennen und feste Adresse lehnen bei Schreibfehler ab, der Speicherstand bleibt.
  const pM = await freierPort();
  const KM = kernRechner('Kern-Master', 'master', pM);
  await KM.kern.starte();
  let sperreS = false;
  const KS = kernRechner('Kern-Slave', 'slave', 0, () => ({
    schreibeAufPlatte: (pfad, dd) => { if (sperreS) throw gesperrtMit('EACCES'); schreibeMasterLinkDatei(pfad, dd); },
  }));
  await KS.kern.starte();
  KM.kern.oeffneKopplung();
  const gekoppelt = await KS.kern.koppeleMitMaster(`127.0.0.1:${pM}`, KM.kern.stand().master!.kopplung.code!);
  ck('Kern: Slave koppelt über koppeleMitMaster', gekoppelt.ok && KS.kern.stand().slave?.gekoppelt === true);
  sperreS = true;
  let trenneWurf = false;
  try { KS.kern.trenneVerbund(); } catch { trenneWurf = true; }
  ck('trenneVerbund mit Schreibfehler: lehnt ab, die Kopplung bleibt (nie still entkoppelt)', trenneWurf && KS.kern.stand().slave?.gekoppelt === true);
  const festVorher = KS.kern.stand().slave?.festeAdresse;
  let festWurf = false;
  try { KS.kern.setzeFesteAdresse('10.9.9.9'); } catch { festWurf = true; }
  ck('setzeFesteAdresse mit Schreibfehler: lehnt ab, Adresse unverändert', festWurf && KS.kern.stand().slave?.festeAdresse === festVorher);
  sperreS = false;
  const getrennt = KS.kern.trenneVerbund();
  ck('Ursache weg: Trennen löscht die Kopplung, die Rolle bleibt Slave', getrennt.slave?.gekoppelt === false && getrennt.rolle === 'slave');
  await KS.kern.beende();
  await KM.kern.beende();
}

// --- Beschädigte Daten ----------------------------------------------------------
await master.stoppe();
const vb = join(A.speicherDir, 'verbund.json');
writeFileSync(vb, 'Müll');
const ausBak = neuerMaster(A, port);
await ausBak.starte();
ck('nur verbund.json kaputt → läuft aus .bak', ausBak.stand().zustand === 'laeuft' && ausBak.stand().ausBak);
await ausBak.stoppe();
writeFileSync(vb, 'Müll');
writeFileSync(`${vb}.bak`, 'Müll');
const kaputt = neuerMaster(A, port);
await kaputt.starte();
ck('verbund.json + .bak kaputt → „daten-beschaedigt“', kaputt.stand().zustand === 'daten-beschaedigt');
ck('… und der Master lauscht NICHT (kein „unbekannt“ an Slaves)', await verweigert(port));
ck('… und überschreibt nichts', readFileSync(vb, 'utf8') === 'Müll');
const fpAlt = A.lies().kopplung!.fingerprint;
await kaputt.neuAufsetzen();
ck('„Verbund neu aufsetzen“ → läuft wieder', kaputt.stand().zustand === 'laeuft');
ck('… mit neuer Identität', A.lies().kopplung?.fingerprint !== fpAlt);
await kaputt.stoppe();
const idp = join(A.speicherDir, 'identitaet.json');
writeFileSync(idp, 'Müll');
writeFileSync(`${idp}.bak`, 'Müll');
const ohneId = neuerMaster(A, port);
await ohneId.starte();
ck('identitaet.json + .bak kaputt → „daten-beschaedigt“, keine still neue Identität', ohneId.stand().zustand === 'daten-beschaedigt' && readFileSync(idp, 'utf8') === 'Müll');
await ohneId.neuAufsetzen();

await timerA.stoppe();
await slaveB.stoppe();
await slaveC.stoppe();
await ohneId.stoppe();
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
