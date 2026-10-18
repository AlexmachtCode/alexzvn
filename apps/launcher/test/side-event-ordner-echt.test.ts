// Side-Event-Ordner gegen das ECHTE Dateisystem (tsx): npm run selftest:iveo -w @jm/launcher
// iveo-Paket, Spec 12.4 „Echte Dateisysteme“ (B37): die Fälle, die die Attrappe nur annimmt — feindliche Namen,
// rename auf einen bestehenden Namen, Umbenennen nur in Groß- und Kleinschreibung, ein NFD-Name in der Liste,
// entfernt\ an der Längengrenze, Umlaute. Derselbe Ablauf läuft gegen die Attrappe (Profil NTFS); beide Ergebnisse
// müssen gleich sein. Weicht eines ab, wird die Attrappe angepasst, nicht die Erwartung. Läuft im Temp-Ordner.
import * as fsp from 'node:fs/promises';
import { platform, release, tmpdir } from 'node:os';
import path from 'node:path';
import type { IveoAgendaItem, IveoMaterial } from '@jm/iveo';
import type { VerbundRolle } from '../src/shared/types';
import { erzeugeOrdnerLauf, type OrdnerFs } from '../src/main/side-event-ordner-lauf';
import { ordnerPfad, vergleichsform } from '../src/main/side-event-ordner';
import { DownloadAttrappe, FsAttrappe, Gleichzeitig, TestUhr, datei, punkt, showText } from './ordner-attrappe';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const FEINDLICH = [
  'CON', 'con.txt', 'CON .pdf', 'nul  .txt', 'CONIN$', 'COM¹', 'LPT9.pdf', 'Präsentation.', 'Präsentation  ', '.versteckt', '..', '../x',
  'a/b', 'a\\b', 'a:b', 'a*?"<>|b', 'Steuer\u0001zeichen', 'Zeile\u0085Ende', 'Null​breite', 'Slides‮txt.exe',
  'Präsentation in NFD', `${'x'.repeat(298)}😀`, '', 'entfernt', 'Grüße – Übersicht',
];

interface Lauf { fs: OrdnerFs; basis: string; show: string }

/** Ein Lauf auf einem Dateisystem (echt oder Attrappe) mit Testuhr; gibt Basis- und Side-Event-Ordner zurück. */
async function lauf(fs: OrdnerFs, wurzel: string, schritte: (takt: (agenda: IveoAgendaItem[]) => Promise<void>, ordner: string) => Promise<void>): Promise<void> {
  const show = path.join(wurzel, 'Shows', 'COP31 Tag 1.jmshow');
  await fs.mkdir(path.dirname(show), { recursive: true });
  const fh = await fs.open(show, 'wx');
  await fh.write(Buffer.from(showText([{ id: 'se-1', title: 'Klima' }], { programId: 'se-1' }), 'utf8'));
  await fh.sync();
  await fh.close();
  const uhr = new TestUhr();
  const g = new Gleichzeitig();
  const download = new DownloadAttrappe(g, uhr);
  const l = erzeugeOrdnerLauf({
    fs, jetzt: uhr.jetzt, setTimeout: uhr.setTimeout, clearTimeout: uhr.clearTimeout,
    aktiv: () => ({ path: show, event: 'cop31', filter: { programId: 'se-1' } }), rolle: () => 'aus' as VerbundRolle, tokenDa: () => true, schalterAn: () => true,
    tagVon: () => null, titelVon: () => null, agendaClient: () => null, downloadClient: () => download,
    rechner: 'ECHT', pid: 4711, neueSitzungsKennung: () => 'echt-1', log: { info: () => undefined, warn: () => undefined }, melde: () => undefined,
  });
  const basis = path.join(path.dirname(show), 'COP31 Tag 1 – Side Events');
  await schritte(async (agenda) => {
    l.agendaAktiv('se-1', { ok: true, agenda, abgerufen: new Date(uhr.t).toISOString() });
    l.takt();
    // Echtes Dateisystem: Wiederholungen (EPERM/EBUSY) warten über den Zeitgeber der Testuhr – die Uhr muss laufen,
    // solange der Lauf noch nicht ruht, sonst hängt ruhig() für immer. Reale Pause je Runde, Obergrenze 30 s.
    let ruht = false;
    void l.ruhig().then(() => { ruht = true; });
    const ende = Date.now() + 30_000;
    while (!ruht) {
      if (Date.now() > ende) throw new Error('Lauf kommt nicht zur Ruhe (Zeitgrenze 30 s)');
      await uhr.spule(50, 50);
      await new Promise((r) => setTimeout(r, 5));
    }
    await uhr.spule(45_000, 45_000);
  }, path.join(basis, 'Klima'));
}

/** Ablauf, den echtes Dateisystem und Attrappe gleich erleben müssen; liefert die Dateiliste (relativ, mit Größe). */
async function ablauf(fs: OrdnerFs, wurzel: string, legeFremd: (p: string, inhalt: string) => Promise<void>): Promise<string[]> {
  const ergebnis: string[] = [];
  await lauf(fs, wurzel, async (takt, ordner) => {
    const anhaenge: IveoMaterial[] = FEINDLICH.map((label, i) => datei(`f-${i}`, label, { size: 1000 }));
    await legeFremd(path.join(ordner, 'Bericht.pdf'), 'fremd');
    await legeFremd(path.join(ordner, 'Präsentation.pdf'.normalize('NFD')), 'fremd in NFD');
    const bericht = datei('b-1', 'Bericht', { size: 1000 });
    const praes = datei('b-2', 'Präsentation', { size: 1000 });
    const klein = datei('b-3', 'bericht final', { size: 1000 });
    await takt([punkt('se-1', [...anhaenge, bericht, praes, klein])]);
    await takt([punkt('se-1', [...anhaenge, bericht, praes, { ...klein, label: 'Bericht Final' }])]);
    await takt([punkt('se-1', [bericht, praes, { ...klein, label: 'Bericht Final' }])]); // die feindlichen nach entfernt/
    const liste = async (o: string, pre: string): Promise<void> => {
      for (const n of (await fs.readdir(o)).sort()) {
        const p = path.join(o, n);
        const st = await fs.stat(p);
        if (st.isDirectory()) await liste(p, `${pre}${n}/`);
        else if (!n.startsWith('.jm-')) ergebnis.push(`${pre}${n.normalize('NFC')} ${st.size}`);
      }
    };
    await liste(ordner, '');
  });
  return ergebnis.sort();
}

const wurzel = await fsp.mkdtemp(path.join(tmpdir(), 'jm-ordner-echt-'));
console.log(`— Echtes Dateisystem: ${platform()} ${release()}, Node ${process.version}, Ordner ${wurzel}`);
try {
  const echt = await ablauf(fsp as unknown as OrdnerFs, wurzel, async (p, inhalt) => {
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, inhalt, 'utf8');
  });
  ck('echt: der Name „Präsentation in NFD“ ist wirklich zerlegt (U+0308, kein NFC)', FEINDLICH.some((n) => n.includes('̈') && n.startsWith('Pra') && n.length === 'Präsentation in NFD'.normalize('NFC').length + 1));
  // Ein vorübergehendes EBUSY beim Umbenennen darf den Lauf nicht festsetzen (die Wiederholung wartet 50 ms über den Zeitgeber).
  let ebusy = 1;
  const wurzel2 = await fsp.mkdtemp(path.join(tmpdir(), 'jm-ordner-echt-')); // gleiche Länge wie die erste Wurzel, sonst kürzt die Längenregel anders
  let mitEbusy: string[] = [];
  try {
    const flaky = { ...fsp, rename: async (a: string, b: string): Promise<void> => {
      if (ebusy-- > 0) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
      return fsp.rename(a, b);
    } };
    mitEbusy = await ablauf(flaky as unknown as OrdnerFs, wurzel2, async (p, inhalt) => {
      await fsp.mkdir(path.dirname(p), { recursive: true });
      await fsp.writeFile(p, inhalt, 'utf8');
    });
  } finally {
    await fsp.rm(wurzel2, { recursive: true, force: true });
  }
  ck('echt: ein vorübergehendes EBUSY beim Umbenennen – der Lauf kommt zur Ruhe, Ergebnis wie ohne Fehler', ebusy < 0 && JSON.stringify(mitEbusy) === JSON.stringify(echt));
  const att = new FsAttrappe('NTFS');
  const attWurzel = wurzel; // gleicher Pfad, damit die Längenregel gleich kürzt
  const nachgebaut = await ablauf(att, attWurzel, async (p, inhalt) => { att.lege(p, inhalt); });
  const ordner = path.join(wurzel, 'Shows', 'COP31 Tag 1 – Side Events', 'Klima');
  const namen = (await fsp.readdir(ordner)).map((n) => n.normalize('NFC'));
  ck('echt: jeder feindliche Name aus Nr. 1 wurde abgelegt und lesbar, nichts außerhalb des Ordners',
    FEINDLICH.length === echt.filter((z) => z.startsWith('entfernt/')).length
    && (await fsp.readdir(path.join(wurzel, 'Shows'))).sort().join('|') === ['COP31 Tag 1 – Side Events', 'COP31 Tag 1.jmshow'].join('|'));
  ck('echt: rename auf einen bestehenden Namen – die fremde Datei bleibt, der Anhang weicht mit „ (2)“ aus',
    (await fsp.readFile(path.join(ordner, 'Bericht.pdf'), 'utf8')) === 'fremd' && namen.includes('Bericht (2).pdf'));
  ck('echt: NFD-Name in der Liste – die fremde NFD-Datei bleibt, der Anhang weicht aus',
    (await fsp.readFile(path.join(ordner, 'Präsentation.pdf'.normalize('NFD')), 'utf8')) === 'fremd in NFD' && namen.some((n) => /^Präsentation \(\d+\)\.pdf$/.test(n)));
  ck('echt: Umbenennen nur in Groß- und Kleinschreibung („bericht final“ → „Bericht Final“)',
    namen.includes('Bericht Final.pdf') && !namen.includes('bericht final.pdf'));
  ck('echt: Umlaute und Gedankenstrich im Namen', echt.some((z) => z.startsWith('entfernt/Grüße – Übersicht.pdf ')));
  ck('echt: entfernt\\ an der Längengrenze (300 Zeichen mit Emoji gekürzt, Pfad ≤ 250 UTF-16-Einheiten, lesbar)',
    echt.filter((z) => z.startsWith('entfernt/xxxx')).every((z) => path.join(ordner, z.split(' ').slice(0, -1).join(' ')).length <= 250));
  ck('echt: Ergebnis gleich der Attrappe (Profil NTFS) – Namen, Ordner und Größen', JSON.stringify(echt) === JSON.stringify(nachgebaut));
  if (JSON.stringify(echt) !== JSON.stringify(nachgebaut)) console.log(`      echt: ${JSON.stringify(echt)}\n      Attrappe: ${JSON.stringify(nachgebaut)}`);
  const tief = path.join(wurzel, 'x'.repeat(60), 'y'.repeat(60));
  const p = ordnerPfad({ art: 'datei', seitenOrdner: path.join(tief, 'Klima'), label: 'z'.repeat(200), kind: 'file', mime: 'application/pdf' });
  ck('echt: Namensregel kürzt im tiefen Ordner so, dass auch die längste entfernt-Form ins Budget passt',
    p.ok && path.join(tief, 'Klima', 'entfernt', `${p.name.slice(0, -4)} (unvollständig 2026-10-16 10-30) (99).pdf`).length <= 250 && vergleichsform(p.name) === p.name.toLowerCase());
} finally {
  await fsp.rm(wurzel, { recursive: true, force: true });
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
