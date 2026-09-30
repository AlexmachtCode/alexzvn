// Verbund-Rollen des Launchers OHNE Electron (tsx): npm run selftest:verbund -w @jm/launcher
// Master und Slaves laufen in EINEM Prozess mit getrennten appData-/userData-Ordnern auf 127.0.0.1.
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { connect, createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  fingerprintVonPem, masterLinkPfad, MasterLinkClient, pruefeIdentitaet, schreibeMasterLinkDatei,
  type Lesen, type MasterLinkDatei, type NetzwerkInterfaces,
} from '@jm/master-link';
import { MasterRolle } from '../src/main/verbund/master';
import { koppelText, SlaveRolle, teileAdresse } from '../src/main/verbund/slave';
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

function rechner(rolle: MasterLinkDatei['rolle'], name: string) {
  const appData = mkdtempSync(join(tmpdir(), 'jmvb-app-'));
  const speicherDir = join(mkdtempSync(join(tmpdir(), 'jmvb-user-')), 'master-link');
  const pfad = masterLinkPfad(appData);
  let datei: MasterLinkDatei = { version: 1, rolle, rechner: { id: `${name}-id`, name }, netzwerk: { karte: null }, kopplung: null };
  return {
    pfad, speicherDir,
    lies: () => datei,
    schreibe: (d: MasterLinkDatei) => { datei = d; schreibeMasterLinkDatei(pfad, d); },
  };
}

function neuerMaster(A: ReturnType<typeof rechner>, port: number) {
  return new MasterRolle({
    speicherDir: A.speicherDir, suiteVersion: '0.12.0', datei: A.lies, schreibeDatei: A.schreibe,
    beiAenderung: () => {}, log, port, fristen: KURZ, netzwerkKarten: () => ({}), mdnsFabrik: null,
    lauschAdressen: ['127.0.0.1'],
  });
}
function neuerSlave(B: ReturnType<typeof rechner>) {
  return new SlaveRolle({
    dateiPfad: B.pfad, suiteVersion: '0.12.0', datei: B.lies, schreibeDatei: B.schreibe,
    beiAenderung: () => {}, log, fristen: KURZ, netzwerkKarten: () => ({}), suche: null, listenSuche: null,
  });
}

// --- Hilfen -------------------------------------------------------------------
ck('teileAdresse: IP ohne Port -> 8738', JSON.stringify(teileAdresse('10.0.0.110')) === JSON.stringify({ host: '10.0.0.110', port: 8738 }));
ck('teileAdresse: mit Port', teileAdresse('127.0.0.1:18738')?.port === 18738);
ck('teileAdresse: leer -> null', teileAdresse('  ') === null);
ck('koppelText code-falsch nennt Restversuche', koppelText({ ok: false, art: 'abgelehnt', grund: 'code-falsch', rest: 3 }, 'Regie-PC', '10.0.0.1') === 'Code stimmt nicht, noch 3 Versuche.');
ck('koppelText Frist', koppelText({ ok: false, art: 'frist' }, 'Regie-PC', '10.0.0.1') === 'Der Master hat nicht rechtzeitig bestätigt. Nichts gespeichert.');

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
