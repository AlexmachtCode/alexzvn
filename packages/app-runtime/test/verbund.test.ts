// Selbsttest Verbund der Tool-Seite (Master-Link Teil 2b, Release 2, Spec 19.4) — ohne Electron, mit tsx:
//   npm run selftest -w @jm/app-runtime      (läuft nach dem CSP-Test aus test/selftest.ts)
//
// Jeder Block lädt seine Module mit `await import(…)` INNERHALB des Blocks. Fehlt das Modul einer
// späteren Aufgabe, laufen die Blöcke davor durch, dann bricht der Lauf mit ERR_MODULE_NOT_FOUND ab.
// Blöcke späterer Aufgaben kommen direkt vor die Zeile „// ── Abschluss“.
// Kein Test lädt Electron (die CI installiert ohne Postinstalls), keiner öffnet einen Socket.

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ── C11 · Anzeige V1–V15 (Spec 16.4) ─────────────────────────────────────────
{
  const { verbundAnzeige, kuerzeShowName } = await import('../src/verbund-anzeige');
  const { fehlerText } = await import('@jm/master-link');
  const uhr = (ms: number): string => `U${ms}`; // feste „Uhrzeit“: macht ⟨hh:mm⟩ im Test eindeutig
  const show = (name: string) => ({ schemaVersion: 1, name, tools: [] });
  const A = { masterId: 'M1', masterName: 'Regie-PC', epoche: 'e1', folge: 3, schluessel: 'aaaaaaaaaaaaaaaa', show: show('Gala'), mitDokument: [], empfangenAm: 1000 };
  const L = ' · letzter Stand: Gala U1000';
  const mit = (angewendet: typeof A | null, extra: Record<string, unknown> = {}) => ({ masterName: 'Regie-PC', angewendet, ...extra });
  const zeile = (d: unknown) => verbundAnzeige(d as never, uhr);
  const gleich = (name: string, d: unknown, text: string, farbe: string): void => {
    const a = zeile(d);
    check(name, a !== null && a.text === text && a.farbe === farbe, a);
  };

  check('C11 V1: einzelplatz → keine Anzeige', zeile({ art: 'einzelplatz' }) === null);
  gleich('C11 V2 ohne angewendet', { art: 'warte', ...mit(null) }, 'Verbunden mit Regie-PC · Show wird geladen…', 'gelb');
  gleich('C11 V2 mit angewendet (Zusatz L)', { art: 'warte', ...mit(A) }, `Verbunden mit Regie-PC · Show wird geladen…${L}`, 'gelb');
  gleich('C11 V3 ohne angewendet', { art: 'ohne-daten', ...mit(null) }, 'Regie-PC antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)', 'gelb');
  gleich('C11 V3 mit angewendet', { art: 'ohne-daten', ...mit(A) }, `Regie-PC antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)${L}`, 'gelb');
  const neuer = { ...A, folge: 4, show: show('Gala neu'), empfangenAm: 2000 };
  gleich('C11 V4 mit angewendet: Name und Zeit des ANGEWENDETEN Stands', { art: 'aktuell', letzter: neuer, ...mit(A) }, 'Show vom Master: Gala · Stand U1000', 'gruen');
  gleich('C11 V4 ohne angewendet: Name und Zeit des empfangenen Stands', { art: 'aktuell', letzter: neuer, ...mit(null) }, 'Show vom Master: Gala neu · Stand U2000', 'gruen');
  gleich('C11 V4 angewendet von anderem Master → empfangener Stand', { art: 'aktuell', letzter: { ...neuer, masterId: 'M2' }, ...mit(A) }, 'Show vom Master: Gala neu · Stand U2000', 'gruen');
  const ohne = (grund: string) => ({ ...A, folge: 5, show: null, grund, empfangenAm: 3000 });
  gleich('C11 V5 keine-show, etwas angewendet', { art: 'aktuell', letzter: ohne('keine-show'), ...mit(A) }, `Regie-PC hat keine Show offen${L}`, 'gelb');
  gleich('C11 V6 keine-show, nichts angewendet', { art: 'aktuell', letzter: ohne('keine-show'), ...mit(null) }, 'Regie-PC hat keine Show offen', 'gedaempft');
  gleich('C11 V7 zu-gross mit angewendet', { art: 'aktuell', letzter: ohne('zu-gross'), ...mit(A) }, `Show am Master zu groß für den Verbund${L}`, 'rot');
  gleich('C11 V7 zu-gross ohne angewendet', { art: 'aktuell', letzter: ohne('zu-gross'), ...mit(null) }, 'Show am Master zu groß für den Verbund', 'rot');
  gleich('C11 V8 nicht-lesbar mit angewendet', { art: 'aktuell', letzter: ohne('nicht-lesbar'), ...mit(A) }, `Show am Master nicht lesbar${L}`, 'rot');
  gleich('C11 V8 nicht-lesbar ohne angewendet', { art: 'aktuell', letzter: ohne('nicht-lesbar'), ...mit(null) }, 'Show am Master nicht lesbar', 'rot');
  for (const client of [{ art: 'sucht' }, { art: 'verbindet', adresse: '10.0.0.5' }, { art: 'aus' }]) {
    gleich(`C11 V9 getrennt (${client.art}), etwas angewendet`, { art: 'getrennt', client, ...mit(A) }, `Regie-PC nicht verbunden${L}`, 'gelb');
    gleich(`C11 V10 getrennt (${client.art}), nichts angewendet`, { art: 'getrennt', client, ...mit(null) }, 'Suche Regie-PC…', 'gelb');
  }
  const CODES = ['zeit', 'nicht-gefunden', 'verweigert', 'netz', 'kein-master', 'zertifikat', 'uhr', 'protokoll', 'unbekannt', 'signatur', 'ersetzt', 'datei', 'sonstig'] as const;
  for (const code of CODES) {
    const text = fehlerText(code, { masterName: 'Regie-PC', adresse: '10.0.0.5', errCode: 'EXYZ', suite: '0.14.0', masterProtokoll: 1 });
    const client = { art: 'fehler', code, text };
    gleich(`C11 V11 ${code}: Text des Clients unverändert`, { art: 'getrennt', client, ...mit(null) }, text, 'rot');
    gleich(`C11 V11 ${code}: Text des Clients + Zusatz L`, { art: 'getrennt', client, ...mit(A) }, `${text}${L}`, 'rot');
  }
  check('C11 V11: 13 verschiedene Client-Texte geprüft', new Set(CODES.map((c) => fehlerText(c, { masterName: 'Regie-PC' }))).size === 13);
  gleich('C11 V12 ohne angewendet', { art: 'warte', ...mit(null, { fehler: 'EBUSY' }) }, 'Show vom Master nicht übernommen: EBUSY', 'rot');
  gleich('C11 V12 mit angewendet: „in Benutzung“ statt Zusatz L', { art: 'aktuell', letzter: neuer, ...mit(A, { fehler: 'EBUSY' }) }, 'Show vom Master nicht übernommen: EBUSY · in Benutzung: Gala U1000', 'rot');
  gleich('C11 V13 entkoppelt gelb', { art: 'frueher', grund: 'entkoppelt', ...mit(A) }, `Daten vom früheren Master Regie-PC (nicht mehr gekoppelt)${L}`, 'gelb');
  gleich('C11 V13 datei rot', { art: 'frueher', grund: 'datei', ...mit(A) }, `Kopplungsdatei beschädigt. Neu koppeln.${L}`, 'rot');
  gleich('C11 V14 datei-defekt', { art: 'datei-defekt' }, 'Kopplungsdatei beschädigt. Neu koppeln.', 'rot');
  const verworfen = { grund: 'folge', seit: 5 };
  gleich('C11 V15 ohne angewendet', { art: 'warte', ...mit(null, { verworfen }) }, 'Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?)', 'rot');
  gleich('C11 V15 mit angewendet', { art: 'aktuell', letzter: neuer, ...mit(A, { verworfen }) }, `Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?)${L}`, 'rot');

  // Vorrang V12 > V15 > alle anderen, in jeder Lage außer einzelplatz/datei-defekt
  const lagen = [
    { art: 'warte' }, { art: 'ohne-daten' }, { art: 'aktuell', letzter: neuer }, { art: 'aktuell', letzter: ohne('zu-gross') },
    { art: 'getrennt', client: { art: 'sucht' } }, { art: 'getrennt', client: { art: 'fehler', code: 'netz', text: 'Netz weg' } },
    { art: 'frueher', grund: 'entkoppelt' }, { art: 'frueher', grund: 'datei' },
  ];
  check('C11 Vorrang: V12 vor V15 vor allen anderen', lagen.every((l) => zeile({ ...l, ...mit(A, { fehler: 'EBUSY', verworfen }) })?.text.startsWith('Show vom Master nicht übernommen: EBUSY')));
  check('C11 Vorrang: V15 vor allen anderen', lagen.every((l) => zeile({ ...l, ...mit(A, { verworfen }) })?.text.startsWith('Show-Daten von Regie-PC nicht lesbar')));
  const mitZusatz = lagen.filter((l) => l !== lagen[2]); // alle außer V4 (aktuell mit Show)
  check(
    'C11 Zusatz L genau dann, wenn angewendet nicht null (sieben Lagen)',
    mitZusatz.length === 7 && mitZusatz.every((l) => zeile({ ...l, ...mit(A) })!.text.endsWith(L) && !zeile({ ...l, ...mit(null) })!.text.includes(' · letzter Stand: ')),
  );
  check('C11 V4 hat keinen Zusatz L', !zeile({ art: 'aktuell', letzter: neuer, ...mit(A) })!.text.includes('letzter Stand'));

  // ⟨S⟩: höchstens 40 Zeichen (Code Points)
  const n40 = 'A'.repeat(40);
  check('C11 kuerzeShowName: 40 Zeichen bleiben', kuerzeShowName(n40) === n40);
  check('C11 kuerzeShowName: 41 → 39 + …', kuerzeShowName('B'.repeat(41)) === `${'B'.repeat(39)}…`);
  const emoji = `${'C'.repeat(39)}🎬`;
  check('C11 kuerzeShowName: Emoji an Stelle 40 bleibt ganz', kuerzeShowName(emoji) === emoji);
  const emoji41 = `${'C'.repeat(38)}🎬🎤X`;
  check('C11 kuerzeShowName: 41 Code Points mit Emoji → 39 + …, kein halbes Emoji', kuerzeShowName(emoji41) === `${'C'.repeat(38)}🎬…`);
  const lang = { ...A, show: show('D'.repeat(50)) };
  check('C11 lange Shownamen werden in jeder Zeile gekürzt', zeile({ art: 'warte', ...mit(lang) })!.text.endsWith(`${'D'.repeat(39)}… U1000`));
  // Vorgabe-Uhrzeit: hh:mm in Ortszeit dieses Rechners
  const ortszeit = new Date(2026, 9, 8, 9, 5, 0).getTime();
  const v4 = verbundAnzeige({ art: 'aktuell', letzter: { ...A, empfangenAm: ortszeit }, ...mit({ ...A, empfangenAm: ortszeit }) } as never);
  check('C11 Vorgabe-Uhrzeit hh:mm (Ortszeit)', v4?.text === 'Show vom Master: Gala · Stand 09:05', v4);
}

// ── C12 · Zustandsmaschine VerbundFolger (Spec 13.2, 13.3, 16.1–16.3, 19.4) ──
{
  const { EventEmitter } = await import('node:events');
  const { VerbundFolger, VERBUND_FRISTEN, nichtAngewendet } = await import('../src/verbund-daten');
  const { verbundAnzeige } = await import('../src/verbund-anzeige');

  /** Uhr mit Zeitgebern, die nur `vor(ms)` auslöst (G13). */
  const testUhr = () => {
    let jetzt = Date.UTC(2026, 9, 8, 8, 0, 0);
    let naechste = 1;
    const zeitgeber = new Map<number, { zeit: number; f: () => void }>();
    return {
      uhr: {
        jetzt: () => jetzt,
        setTimeout: (f: () => void, ms: number) => {
          const id = naechste++;
          zeitgeber.set(id, { zeit: jetzt + ms, f });
          return id;
        },
        clearTimeout: (h: unknown) => void zeitgeber.delete(h as number),
      },
      vor(ms: number): void {
        const ziel = jetzt + ms;
        for (;;) {
          let id = -1;
          let zeit = Infinity;
          for (const [i, t] of zeitgeber) if (t.zeit <= ziel && t.zeit < zeit) [id, zeit] = [i, t.zeit];
          if (id < 0) break;
          const t = zeitgeber.get(id)!;
          zeitgeber.delete(id);
          jetzt = t.zeit;
          t.f();
        }
        jetzt = ziel;
      },
      offen: () => zeitgeber.size,
    };
  };
  const SLAVE = { rolle: 'slave', masterId: 'M1', masterName: 'Regie-PC', letzteAdresse: '10.0.0.5', adressen: ['10.0.0.5', '192.168.1.5'] };
  class TestClient extends EventEmitter {
    z: Record<string, unknown> = { art: 'aus' };
    k: Record<string, unknown> | null = { ...SLAVE };
    gesendet: Record<string, unknown>[] = [];
    zustand() { return this.z; }
    kopplung() { return this.k; }
    sende(n: Record<string, unknown>) {
      if (this.z.art !== 'verbunden') return false;
      this.gesendet.push(n);
      return true;
    }
    setze(z: Record<string, unknown>) {
      this.z = z;
      this.emit('zustand', z);
    }
    verbinde(masterName = 'Regie-PC') {
      this.setze({ art: 'verbunden', adresse: '10.0.0.5', seit: 0, masterName, suite: '0.15.0' });
      this.emit('angemeldet', { adresse: '10.0.0.5', adressen: ['10.0.0.5'], suite: '0.15.0', masterName });
    }
    trenne() { this.setze({ art: 'sucht' }); }
    abos() { return this.gesendet.filter((n) => n.t === 'abo').length; }
  }
  const showVon = (name: string) => ({ schemaVersion: 1, name, tools: [], ablauf: [{ id: 'p1', title: 'Begrüßung' }] });
  const stand = (folge: number, o: { epoche?: string; schluessel?: string | null; name?: string; show?: unknown; grund?: string; t?: string; mitDokument?: string[] } = {}) => {
    const show = o.show !== undefined ? o.show : showVon(o.name ?? 'Gala');
    return {
      t: o.t ?? 'stand', art: 'show', fassung: 1, epoche: o.epoche ?? 'e1', folge,
      schluessel: o.schluessel === undefined ? 'aaaaaaaaaaaaaaaa' : o.schluessel,
      show, ...(show === null ? { grund: o.grund ?? 'keine-show' } : {}), mitDokument: o.mitDokument ?? [],
    };
  };
  const gespeichert = (o: { masterId?: string; masterName?: string; folge?: number; schluessel?: string | null; name?: string } = {}) => ({
    masterId: o.masterId ?? 'M1', masterName: o.masterName ?? 'Regie-PC', epoche: 'alt', folge: o.folge ?? 7,
    schluessel: o.schluessel === undefined ? 'aaaaaaaaaaaaaaaa' : o.schluessel, show: showVon(o.name ?? 'Gala'), mitDokument: [], empfangenAm: 1000,
  });
  const testSpeicher = (start: unknown = null) => {
    const s = {
      inhalt: start as unknown,
      geschrieben: [] as { folge: number; name: string }[],
      geloescht: 0,
      gelesen: 0,
      lies() { s.gelesen++; return s.inhalt as never; },
      async schreibe(st: { folge: number; show: { name: string } }) {
        s.geschrieben.push({ folge: st.folge, name: st.show.name });
        s.inhalt = st;
        return true;
      },
      loesche() { s.geloescht++; s.inhalt = null; },
    };
    return s;
  };
  const testHandler = () => {
    const h = {
      aufrufe: [] as { name: string; folge: number; epoche: string; masterId: string; neueShow: boolean }[],
      wechsel: [] as { art: string }[],
      wirft: null as null | (() => Error),
      anwenden(s: { show: { name: string }; folge: number; epoche: string; masterId: string }, neueShow: boolean) {
        if (h.wirft) throw h.wirft();
        h.aufrufe.push({ name: s.show.name, folge: s.folge, epoche: s.epoche, masterId: s.masterId, neueShow });
      },
      beiWechsel(d: { art: string }) { h.wechsel.push(d); },
    };
    return h;
  };
  const aufbau = (o: { speicher?: ReturnType<typeof testSpeicher>; darfSchreiben?: boolean; kopplung?: Record<string, unknown> | null } = {}) => {
    const u = testUhr();
    const client = new TestClient();
    if (o.kopplung !== undefined) client.k = o.kopplung;
    const speicher = o.speicher ?? testSpeicher();
    const logs: string[] = [];
    const folger = new VerbundFolger({
      client: client as never, speicher: speicher as never, uhr: u.uhr,
      log: (stufe: string, t: string) => void logs.push(`${stufe}: ${t}`),
      ...(o.darfSchreiben === undefined ? {} : { darfSchreiben: o.darfSchreiben }),
    });
    const h = testHandler();
    return { u, client, speicher, logs, folger, h };
  };
  const ruhe = () => new Promise<void>((r) => setImmediate(r)); // ausstehende Schreibvorgänge abwarten
  const text = (f: { daten(): unknown }) => verbundAnzeige(f.daten() as never, () => 'hh:mm')?.text ?? null;

  check('C12 Fristen: 5 s, 30 s, 5 Versuche, 1 s', JSON.stringify(VERBUND_FRISTEN) === '{"antwortMs":5000,"aboWiederholMs":30000,"anwendeVersuche":5,"anwendePauseMs":1000}');

  // Abo, Frist, Wiederholung (13.3)
  {
    const { u, client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    check('C12 vor der Anmeldung: getrennt, kein Abo', folger.daten().art === 'getrennt' && client.abos() === 0);
    client.verbinde();
    check('C12 angemeldet → genau ein abo {t:abo, art:show, fassung:1}', client.abos() === 1 && JSON.stringify(client.gesendet[0]) === '{"t":"abo","art":"show","fassung":1}');
    check('C12 ohne Antwort: warte', folger.daten().art === 'warte' && text(folger) === 'Verbunden mit Regie-PC · Show wird geladen…');
    u.vor(4999);
    check('C12 nach 4,999 s noch warte', folger.daten().art === 'warte');
    u.vor(1);
    check('C12 nach 5 s ohne-daten (V3)', folger.daten().art === 'ohne-daten' && text(folger)!.startsWith('Regie-PC antwortet nicht'));
    u.vor(24_999);
    check('C12 vor 30 s kein zweites Abo', client.abos() === 1);
    u.vor(1);
    check('C12 nach 30 s zweites Abo', client.abos() === 2);
    u.vor(30_000);
    check('C12 nach 60 s drittes Abo', client.abos() === 3);
    client.emit('daten', stand(0));
    u.vor(120_000);
    check('C12 nach der Antwort keine Wiederholung', client.abos() === 3 && folger.daten().art === 'aktuell');
    check('C12 erster Stand angewendet, neueShow true', h.aufrufe.length === 1 && h.aufrufe[0].neueShow === true && h.aufrufe[0].name === 'Gala');
    check('C12 V4 nach dem ersten Stand', text(folger) === 'Show vom Master: Gala · Stand hh:mm');
    client.trenne();
    u.vor(120_000);
    check('C12 getrennt: keine Abos, solange die Verbindung fehlt', client.abos() === 3 && folger.daten().art === 'getrennt');
  }

  // Nur ein Tool, das folgt, abonniert (15.5); registriert es sich nach der Anmeldung, geht das Abo dann hinaus (E17)
  {
    const { u, client, folger, h } = aufbau();
    folger.starte();
    client.verbinde();
    u.vor(60_000);
    check('C12 ohne folge(): kein Abo, auch nach 60 s (andere Tools beziehen nichts, 15.5)', client.abos() === 0);
    folger.folge(h);
    check('C12 folge() nach der Anmeldung → Abo sofort', client.abos() === 1 && folger.daten().art === 'warte');
    folger.folge(h);
    u.vor(5000);
    check('C12 zweites folge() → kein zweites Abo; die Frist läuft ab dem Abo', client.abos() === 1 && folger.daten().art === 'ohne-daten');
  }

  // Neu oder alt (13.3), neueShow (16.2), Neuabo, Review Focus 2
  {
    const { client, speicher, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    await ruhe();
    check('C12 Zwischenspeicher nach dem Anwenden geschrieben', JSON.stringify(speicher.geschrieben) === '[{"folge":0,"name":"Gala"}]');
    check('C12 im Verbundmodus nach dem ersten Stand mit Show', folger.imVerbundmodus() === true);
    client.emit('daten', stand(1, { t: 'aenderung', name: 'Gala (geändert)' }));
    check('C12 größere Folge → angewendet, gleicher schluessel → neueShow false', h.aufrufe.length === 2 && h.aufrufe[1].folge === 1 && h.aufrufe[1].neueShow === false);
    client.emit('daten', stand(1, { t: 'aenderung' }));
    check('C12 gleiche Epoche und Folge → nicht angewendet', h.aufrufe.length === 2 && folger.daten().art === 'aktuell');
    client.emit('daten', stand(3, { t: 'aenderung', name: 'Stand 3' }));
    client.emit('daten', stand(2, { t: 'aenderung', name: 'Stand 2 (verspätet)' }));
    const d = folger.daten() as { art: string; letzter: { folge: number } };
    check('C12 älterer Stand nach neuerem → anwenden nicht gerufen (Review Focus 2)', h.aufrufe.length === 3 && h.aufrufe[2].folge === 3);
    check('C12 älterer Stand verdrängt den neueren nicht aus der Anzeige', d.art === 'aktuell' && d.letzter.folge === 3 && text(folger) === 'Show vom Master: Stand 3 · Stand hh:mm');
    client.emit('daten', stand(0, { epoche: 'e2', name: 'Neu gestartet' }));
    check('C12 andere Epoche mit kleinerer Folge → angewendet', h.aufrufe.length === 4 && h.aufrufe[3].epoche === 'e2' && h.aufrufe[3].neueShow === false);
    client.emit('daten', stand(1, { epoche: 'e2', schluessel: 'bbbbbbbbbbbbbbbb', name: 'Andere Show' }));
    check('C12 anderer schluessel → neueShow true', h.aufrufe.length === 5 && h.aufrufe[4].neueShow === true);
    client.trenne();
    check('C12 Verbindung weg → getrennt, Daten bleiben', folger.daten().art === 'getrennt' && folger.imVerbundmodus() === true);
    client.verbinde();
    check('C12 Neuabo nach dem Wiederverbinden', client.abos() === 2 && folger.daten().art === 'warte');
    client.emit('daten', stand(1, { epoche: 'e2', schluessel: 'bbbbbbbbbbbbbbbb', name: 'Andere Show' }));
    check('C12 gleicher Stand nach dem Wiederverbinden nicht erneut angewendet, aktuell', h.aufrufe.length === 5 && folger.daten().art === 'aktuell');
    await ruhe();
    // Fünf Anwendungen ohne Pause dazwischen: geschrieben werden der erste, der zweite (lief schon) und nur der neueste.
    check('C12 Zwischenspeicher: der Reihe nach, Zwischenstände fallen weg, der neueste zuletzt', speicher.geschrieben.map((g) => g.folge).join(',') === '0,1,1' && speicher.geschrieben.at(-1)?.name === 'Andere Show', speicher.geschrieben);
    client.k = { ...SLAVE, masterId: 'M2', masterName: 'Ton-PC' };
    client.verbinde('Ton-PC');
    client.emit('daten', stand(1, { epoche: 'e2', schluessel: 'bbbbbbbbbbbbbbbb', name: 'Andere Show' }));
    check('C12 anderer masterId → angewendet mit neueShow true', h.aufrufe.length === 6 && h.aufrufe[5].masterId === 'M2' && h.aufrufe[5].neueShow === true);
  }

  // anwenden wirft (16.2): fehler, Zwischenspeicher unverändert, bis zu fünf neue Versuche im Abstand von 1 s
  {
    const { u, client, speicher, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    await ruhe();
    h.wirft = () => Object.assign(new Error('C:\\Shows\\geheim.tsv gesperrt'), { code: 'EBUSY' });
    let versuche = 0;
    const altesAnwenden = h.anwenden;
    h.anwenden = (s, n) => { versuche++; altesAnwenden(s, n); };
    client.emit('daten', stand(1, { t: 'aenderung', name: 'Neu' }));
    const d = folger.daten() as { fehler?: string; angewendet: { folge: number } };
    check('C12 anwenden wirft → fehler = Code, nicht die Meldung', d.fehler === 'EBUSY' && !JSON.stringify(d).includes('geheim'));
    check('C12 anwenden wirft → angewendet bleibt der alte Stand', d.angewendet.folge === 0);
    check('C12 V12 mit „in Benutzung“', text(folger) === 'Show vom Master nicht übernommen: EBUSY · in Benutzung: Gala hh:mm');
    check('C12 nicht im Verbundmodus verloren (alter Stand vom selben Master)', folger.imVerbundmodus() === true);
    u.vor(999);
    check('C12 vor 1 s kein zweiter Versuch', versuche === 1);
    u.vor(1);
    check('C12 nach 1 s zweiter Versuch', versuche === 2);
    u.vor(10_000);
    check('C12 erster Versuch und fünf neue (16.2 „bis zu fünfmal … erneut“), dann keiner mehr', versuche === 6);
    await ruhe();
    check('C12 Zwischenspeicher unverändert, solange anwenden wirft', speicher.geschrieben.length === 1);
    check('C12 Warnungen: erster Fehlschlag und Aufgabe, ohne Meldungstext', logs.filter((l) => l.includes('nicht übernommen')).length === 2 && !logs.join('\n').includes('geheim'));
    client.emit('daten', stand(2, { t: 'aenderung', name: 'Noch neuer' }));
    u.vor(2500);
    check('C12 ein neuerer Stand ersetzt das Ziel: Versuche beginnen neu', versuche === 9);
    h.wirft = null;
    u.vor(1000);
    const nach = folger.daten() as { fehler?: string; angewendet: { folge: number } };
    check('C12 gelingt ein Versuch → fehler weg, angewendet neu', nach.fehler === undefined && nach.angewendet.folge === 2 && h.aufrufe.at(-1)?.name === 'Noch neuer');
    await ruhe();
    check('C12 nach dem gelungenen Versuch geschrieben', speicher.geschrieben.at(-1)?.folge === 2);
    h.wirft = () => Object.assign(new Error('x'), { code: 'EPERM' });
    client.emit('daten', stand(3, { t: 'aenderung' }));
    check('C12 fehler gesetzt', (folger.daten() as { fehler?: string }).fehler === 'EPERM');
    client.emit('daten', stand(4, { t: 'aenderung', show: null, grund: 'keine-show' }));
    u.vor(10_000);
    check('C12 keine-show löscht fehler und beendet die Versuche', (folger.daten() as { fehler?: string }).fehler === undefined && versuche === 11);
    check('C12 V5 nach keine-show mit Zusatz L', text(folger) === 'Regie-PC hat keine Show offen · letzter Stand: Noch neuer hh:mm');
    client.emit('daten', stand(5, { t: 'aenderung', show: null, grund: 'zu-gross' }));
    check('C12 zu-gross → V7', text(folger) === 'Show am Master zu groß für den Verbund · letzter Stand: Noch neuer hh:mm');
  }

  // Ein Tool meldet einen lesbaren Grund mit nichtAngewendet(code) (Titler: Fehlercode der TSV, Rundown: SCHLUESSEL_FEHLT):
  // V12 und die Logzeile zeigen den Code. Ein einfaches Error zeigte nur seinen Typ, nie die Meldung (G6).
  {
    const { client, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    h.wirft = () => nichtAngewendet('EBUSY');
    client.emit('daten', stand(0));
    check('C12 nichtAngewendet(code) → V12 mit dem Code', text(folger) === 'Show vom Master nicht übernommen: EBUSY', text(folger));
    check('C12 … Logzeile mit dem Code', logs.some((l) => l.endsWith('nicht übernommen (EBUSY), neuer Versuch in 1 s.')), logs);
    h.wirft = () => new Error('speakers.tsv nicht schreibbar: EBUSY');
    client.emit('daten', stand(1, { t: 'aenderung' }));
    check('C12 einfaches Error → nur der Fehlertyp, nie die Meldung', (folger.daten() as { fehler?: string }).fehler === 'Error');
  }

  // Ende des Verbunds während der Anwende-Versuche (16.1): kein weiterer Versuch mit einem Stand vom Master
  {
    const { u, client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    let versuche = 0;
    h.wirft = () => nichtAngewendet('EBUSY');
    const altesAnwenden = h.anwenden;
    h.anwenden = (s, n) => { versuche++; altesAnwenden(s, n); };
    client.emit('daten', stand(0));
    client.k = { ...SLAVE, rolle: 'aus', masterId: null, masterName: null };
    client.setze({ art: 'aus' });
    u.vor(10_000);
    check('C12 Verbund endet während der Versuche → keine weiteren Versuche (16.1)', versuche === 1 && h.aufrufe.length === 0, versuche);
  }
  {
    // Ein Stand aus dem Zwischenspeicher gehört zum Start (16.3) und wird weiter versucht, auch ohne Kopplung.
    const { u, client, folger, h } = aufbau({ speicher: testSpeicher(gespeichert()) });
    let versuche = 0;
    h.wirft = () => nichtAngewendet('EBUSY');
    const altesAnwenden = h.anwenden;
    h.anwenden = (s, n) => { versuche++; altesAnwenden(s, n); };
    folger.folge(h);
    folger.starte();
    client.k = { ...SLAVE, rolle: 'aus', masterId: null, masterName: null };
    client.setze({ art: 'aus' });
    h.wirft = null;
    u.vor(1000);
    check('C12 … ein Stand aus dem Zwischenspeicher wird weiter versucht (16.3)', versuche === 2 && h.aufrufe.length === 1, versuche);
  }
  {
    // Die Kopplung wechselt direkt an einen anderen Master (16.1 „Anderer Master“, kein Ende des Verbunds): Ein Stand des
    // bisherigen Masters wird nicht weiter versucht; erst ein Stand des neuen Masters wird angewendet.
    const { u, client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    let versuche = 0;
    h.wirft = () => nichtAngewendet('EBUSY');
    const altesAnwenden = h.anwenden;
    h.anwenden = (s, n) => { versuche++; altesAnwenden(s, n); };
    client.emit('daten', stand(0));
    client.k = { ...SLAVE, masterId: 'M2', masterName: 'Ton-PC' };
    client.setze({ art: 'sucht' });
    h.wirft = null;
    u.vor(10_000);
    check('C12 Kopplung wechselt an einen anderen Master → keine weiteren Versuche mit dem Stand des bisherigen (16.1)', versuche === 1 && h.aufrufe.length === 0, versuche);
  }

  // Logzeile „übernommen“: der Showname aus dem Netz einzeilig und gekürzt (G6, kuerzeName aus @jm/master-link)
  {
    const { client, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0, { name: `Gala\nwarn: gefälscht ${'x'.repeat(300)}` }));
    const zeile = logs.find((l) => l.includes('übernommen (Stand 0')) ?? '';
    check('C12 Logzeile „übernommen“: Showname einzeilig und gekürzt (kuerzeName)', h.aufrufe.length === 1 && zeile !== '' && !zeile.includes('\n') && zeile.length < 200, zeile);
  }

  // ungültiger Stand (13.2): verworfen, Warnung je Verbindung einmal je Typ und Feld
  {
    const { client, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', { ...stand(0), epoche: 'Geheim Epoche' });
    const d = folger.daten() as { verworfen?: { grund: string } };
    check('C12 ungültiger Stand → verworfen mit Feldname', d.verworfen?.grund === 'epoche' && h.aufrufe.length === 0);
    check('C12 V15 ohne angewendet', text(folger) === 'Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?)');
    client.emit('daten', { ...stand(0), epoche: '' });
    client.emit('daten', { ...stand(0, { t: 'aenderung' }), epoche: '' });
    client.emit('daten', { ...stand(0), schluessel: 'ABC' });
    const warnungen = logs.filter((l) => l.startsWith('warn: Verbund: Show-Daten von „Regie-PC“ verworfen'));
    check('C12 Warnung einmal je Typ und Feld', JSON.stringify(warnungen) === JSON.stringify([
      'warn: Verbund: Show-Daten von „Regie-PC“ verworfen (stand, Feld epoche).',
      'warn: Verbund: Show-Daten von „Regie-PC“ verworfen (aenderung, Feld epoche).',
      'warn: Verbund: Show-Daten von „Regie-PC“ verworfen (stand, Feld schluessel).',
    ]), warnungen);
    check('C12 Warnung ohne Werte aus dem Netz', !logs.join('\n').includes('Geheim'));
    client.trenne();
    client.verbinde();
    client.emit('daten', { ...stand(0), epoche: '' });
    check('C12 neue Verbindung → dieselbe Warnung noch einmal', logs.filter((l) => l.includes('(stand, Feld epoche)')).length === 2);
    client.emit('daten', stand(0));
    check('C12 nächster gültiger Stand löscht verworfen und wird angewendet', (folger.daten() as { verworfen?: unknown }).verworfen === undefined && h.aufrufe.length === 1);
    client.emit('daten', { ...stand(1), show: [1, 2] });
    check('C12 show als Liste → verworfen, alter Stand bleibt (V15 mit Zusatz L)', (folger.daten() as { verworfen?: unknown }).verworfen !== undefined && h.aufrufe.length === 1 && text(folger) === 'Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?) · letzter Stand: Gala hh:mm');
    client.emit('daten', { t: 'abo', art: 'show', fassung: 1 });
    check('C12 abo vom Master wird nicht als Stand gelesen', h.aufrufe.length === 1);
  }

  // fehler und verworfen gehören zu EINEM Master und zur Verbindung (Fix-Runde 1): Ende des Verbunds, Masterwechsel, Datei defekt
  {
    const { u, client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', { ...stand(0), epoche: '' });
    client.k = { ...SLAVE, masterId: 'M2', masterName: 'Ton-PC' };
    client.verbinde('Ton-PC');
    const d = folger.daten() as { art: string; verworfen?: unknown };
    check('C12 Masterwechsel → verworfen des alten Masters weg (warte)', d.art === 'warte' && d.verworfen === undefined && text(folger) === 'Verbunden mit Ton-PC · Show wird geladen…', text(folger));
    u.vor(5000);
    check('C12 Masterwechsel, Ton-PC schweigt → V3 statt V15', text(folger)!.startsWith('Ton-PC antwortet nicht'), text(folger));
  }
  {
    const { u, client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    h.wirft = () => nichtAngewendet('EBUSY');
    client.emit('daten', stand(1, { t: 'aenderung' }));
    u.vor(10_000);
    check('C12 Versuche aufgegeben, fehler steht noch', (folger.daten() as { fehler?: string }).fehler === 'EBUSY');
    client.k = { ...SLAVE, masterId: 'M2', masterName: 'Ton-PC' };
    client.verbinde('Ton-PC');
    check('C12 Masterwechsel → fehler des alten Masters weg', (folger.daten() as { fehler?: string }).fehler === undefined && !text(folger)!.startsWith('Show vom Master nicht übernommen'), text(folger));
  }
  {
    const { client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    h.wirft = () => nichtAngewendet('EBUSY');
    client.emit('daten', stand(1, { t: 'aenderung' }));
    check('C12 Versuche laufen, fehler V12', text(folger)!.startsWith('Show vom Master nicht übernommen: EBUSY'));
    client.k = { ...SLAVE, rolle: 'aus', masterId: null, masterName: null };
    client.setze({ art: 'aus' });
    check('C12 Entkoppeln mit fehler → V13, nicht V12', (folger.daten() as { fehler?: string }).fehler === undefined && text(folger) === 'Daten vom früheren Master Regie-PC (nicht mehr gekoppelt) · letzter Stand: Gala hh:mm', text(folger));
  }
  {
    const { client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    client.emit('daten', { ...stand(1), epoche: '' });
    check('C12 verworfen steht (V15)', text(folger)!.startsWith('Show-Daten von Regie-PC nicht lesbar'));
    client.setze({ art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' });
    check('C12 Datei beschädigt mit verworfen → V13 datei, nicht V15', text(folger) === 'Kopplungsdatei beschädigt. Neu koppeln. · letzter Stand: Gala hh:mm', text(folger));
  }

  // Wann ein Tool folgt (16.1): Rolle master, Datei fehlt, Slave ohne Kopplung, Datei beschädigt
  {
    const { client, folger, h } = aufbau({ kopplung: { ...SLAVE, rolle: 'master', masterId: 'M1' } });
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    check('C12 Rolle master → einzelplatz, kein Abo, nichts angewendet (E29)', folger.daten().art === 'einzelplatz' && client.abos() === 0 && h.aufrufe.length === 0 && text(folger) === null);
    check('C12 Rolle master → nicht im Verbundmodus', folger.imVerbundmodus() === false);
  }
  {
    const { client, folger, h } = aufbau({ kopplung: null });
    folger.folge(h);
    folger.starte();
    check('C12 Datei fehlt → einzelplatz', folger.daten().art === 'einzelplatz' && folger.kopplung() === null);
    client.k = { ...SLAVE, masterId: null, masterName: null };
    client.verbinde();
    check('C12 Slave ohne Kopplung → einzelplatz, kein Abo', folger.daten().art === 'einzelplatz' && client.abos() === 0);
    client.k = { ...SLAVE, rolle: 'aus' };
    client.setze({ art: 'aus' });
    check('C12 Rolle aus → einzelplatz', folger.daten().art === 'einzelplatz');
  }
  {
    const { client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.setze({ art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' });
    check('C12 Datei beschädigt ohne Master-Daten → datei-defekt (V14)', folger.daten().art === 'datei-defekt' && text(folger) === 'Kopplungsdatei beschädigt. Neu koppeln.');
    client.verbinde();
    client.emit('daten', stand(0));
    client.setze({ art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' });
    const d = folger.daten() as { art: string; grund?: string };
    check('C12 Datei beschädigt mit Master-Daten → frueher(datei), nicht im Verbundmodus', d.art === 'frueher' && d.grund === 'datei' && folger.imVerbundmodus() === false);
    check('C12 V13 datei mit Zusatz L', text(folger) === 'Kopplungsdatei beschädigt. Neu koppeln. · letzter Stand: Gala hh:mm');
  }

  // Ende des Verbundmodus (16.1), verbundDatenErsetzt (E16)
  {
    const { client, speicher, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    await ruhe();
    client.k = { ...SLAVE, rolle: 'aus', masterId: null, masterName: null };
    client.setze({ art: 'aus' });
    const d = folger.daten() as { art: string; grund?: string; masterName?: string };
    check('C12 Entkoppeln → frueher(entkoppelt) mit dem Namen des früheren Masters', d.art === 'frueher' && d.grund === 'entkoppelt' && d.masterName === 'Regie-PC');
    check('C12 Entkoppeln → Zwischenspeicher bleibt, nicht im Verbundmodus', speicher.geloescht === 0 && speicher.inhalt !== null && folger.imVerbundmodus() === false);
    check('C12 V13 entkoppelt', text(folger) === 'Daten vom früheren Master Regie-PC (nicht mehr gekoppelt) · letzter Stand: Gala hh:mm');
    folger.ersetzt();
    check('C12 ersetzt() → einzelplatz, Zwischenspeicher gelöscht (E16)', folger.daten().art === 'einzelplatz' && speicher.geloescht === 1 && speicher.inhalt === null);
  }
  {
    const { client, speicher, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    folger.ersetzt();
    const d = folger.daten() as { art: string; angewendet?: unknown };
    check('C12 ersetzt() im Verbund: Art bleibt (Verbindung läuft), angewendet null', d.art === 'aktuell' && d.angewendet === null && folger.imVerbundmodus() === false);
    client.emit('daten', stand(1, { t: 'aenderung' }));
    check('C12 nach ersetzt(): nächster Stand des Masters wieder angewendet, neueShow true', h.aufrufe.length === 2 && h.aufrufe[1].neueShow === true);
    await ruhe();
    check('C12 nach ersetzt(): Zwischenspeicher neu geschrieben', speicher.inhalt !== null);
  }

  // Zwischenspeicher beim Start (16.3, E17), Review Focus 3 und 5
  {
    const { client, speicher, folger, h } = aufbau({ speicher: testSpeicher(gespeichert()) });
    folger.folge(h);
    check('C12 folge() vor starte(): noch nichts angewendet', h.aufrufe.length === 0 && speicher.gelesen === 0);
    folger.starte();
    check('C12 Start: Zwischenspeicher genau einmal mit neueShow false', h.aufrufe.length === 1 && h.aufrufe[0].neueShow === false && h.aufrufe[0].folge === 7);
    await ruhe();
    check('C12 Start: Zwischenspeicher nicht noch einmal geschrieben', speicher.geschrieben.length === 0);
    check('C12 Start, gleicher Master gekoppelt → sofort Verbundmodus', folger.imVerbundmodus() === true);
    check('C12 Start, Master fehlt → V9 mit Zusatz L', text(folger) === 'Regie-PC nicht verbunden · letzter Stand: Gala hh:mm');
    folger.folge(h);
    check('C12 zweites folge() wendet nicht noch einmal an', h.aufrufe.length === 1);
    client.verbinde();
    client.emit('daten', stand(0, { name: 'Andere Show', schluessel: 'cccccccccccccccc' }));
    check('C12 Start mit X, erster Stand Y → neueShow true (Review Focus 3)', h.aufrufe.length === 2 && h.aufrufe[1].neueShow === true && h.aufrufe[1].name === 'Andere Show');
  }
  {
    const s = testSpeicher(gespeichert());
    const { folger, h } = aufbau({ speicher: s });
    folger.starte();
    check('C12 starte() vor folge(): erst nach folge() angewendet', h.aufrufe.length === 0 && s.gelesen === 1);
    folger.folge(h);
    check('C12 starte() vor folge(): genau einmal angewendet', h.aufrufe.length === 1);
  }
  {
    const { folger, h } = aufbau({ speicher: testSpeicher(gespeichert()), kopplung: null });
    folger.folge(h);
    folger.starte();
    check('C12 Start mit Zwischenspeicher ohne Kopplung → frueher', (folger.daten() as { art: string; grund?: string }).grund === 'entkoppelt' && h.aufrufe.length === 1);
  }
  {
    const { client, speicher, folger, h } = aufbau({ speicher: testSpeicher(gespeichert({ masterId: 'M9', masterName: 'Alt-PC', name: 'Alte Show' })) });
    folger.folge(h);
    folger.starte();
    check('C12 Start, anderer Master: angewendet, kein Verbundmodus', h.aufrufe.length === 1 && folger.imVerbundmodus() === false);
    check('C12 Start, anderer Master: Lage folgt der Verbindung, Zusatz L nennt den alten Stand', text(folger) === 'Regie-PC nicht verbunden · letzter Stand: Alte Show hh:mm');
    client.verbinde();
    client.emit('daten', stand(0, { show: null, grund: 'keine-show' }));
    check('C12 anderer Master ohne Show: alter Stand bleibt', h.aufrufe.length === 1 && text(folger) === 'Regie-PC hat keine Show offen · letzter Stand: Alte Show hh:mm');
    client.emit('daten', stand(1, { t: 'aenderung', name: 'Neue Show' }));
    await ruhe();
    check('C12 erster Stand mit Show des neuen Masters ersetzt ihn (neueShow true, gespeichert)', h.aufrufe[1]?.neueShow === true && folger.imVerbundmodus() === true && speicher.geschrieben.at(-1)?.name === 'Neue Show');
  }
  {
    const { folger, h } = aufbau({ speicher: testSpeicher(null) });
    folger.folge(h);
    folger.starte();
    check('C12 Speicher liefert null → wie ohne Zwischenspeicher (Review Focus 5)', h.aufrufe.length === 0 && folger.daten().art === 'getrennt' && text(folger) === 'Suche Regie-PC…');
  }
  {
    const { client, folger, h } = aufbau({ speicher: testSpeicher(gespeichert({ folge: 0 })) });
    folger.starte();
    client.verbinde();
    client.emit('daten', { ...stand(0), epoche: 'alt' });
    check('C12 Live-Stand vor folge(): noch nicht angewendet', h.aufrufe.length === 0);
    folger.folge(h);
    check('C12 Live-Stand gleich dem Zwischenspeicher → nur einmal angewendet', h.aufrufe.length === 1 && h.aufrufe[0].neueShow === false);
    client.emit('daten', stand(1, { epoche: 'alt', t: 'aenderung', name: 'Später' }));
    check('C12 danach weiter wie gewohnt', h.aufrufe.length === 2 && h.aufrufe[1].name === 'Später');
  }
  {
    const { client, folger, h } = aufbau({ speicher: testSpeicher(gespeichert({ folge: 0 })) });
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(4, { name: 'Live' }));
    folger.folge(h);
    check('C12 Live-Stand vor folge(): erst Zwischenspeicher, dann der neuere Live-Stand', h.aufrufe.map((a) => a.name).join(',') === 'Gala,Live');
  }
  {
    const { client, speicher, folger, h } = aufbau({ speicher: testSpeicher(gespeichert()) });
    folger.ersetzt();
    folger.folge(h);
    folger.starte();
    check('C12 ersetzt() vor dem Start: Zwischenspeicher weder gelesen noch angewendet', h.aufrufe.length === 0 && speicher.gelesen === 0 && speicher.geloescht === 1);
    check('C12 ersetzt() vor dem Start: Client läuft weiter (getrennt)', folger.daten().art === 'getrennt' && client.abos() === 0);
  }

  // Review Focus 4: master-link.json neu geschrieben, Rolle und Master gleich
  {
    const { client, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    const vorher = h.wechsel.length;
    client.k = { ...SLAVE, letzteAdresse: '192.168.1.5', masterName: 'Regie-PC' };
    client.setze({ ...client.z });
    check('C12 Datei geändert, Rolle und Master gleich → bleibt im Verbundmodus (Review Focus 4)', folger.imVerbundmodus() === true && folger.daten().art === 'aktuell');
    check('C12 … kein Neuanwenden, keine V13, kein Wechsel gemeldet', h.aufrufe.length === 1 && !text(folger)!.includes('früheren') && h.wechsel.length === vorher);
    check('C12 … kopplung() zeigt die neue letzteAdresse', folger.kopplung()?.letzteAdresse === '192.168.1.5');
  }

  // G14: darfSchreiben false → nie schreiben
  {
    const { client, speicher, folger, h } = aufbau({ darfSchreiben: false });
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    folger.ersetzt();
    await ruhe();
    check('C12 darfSchreiben false → kein Schreiben, kein Löschen (G14)', speicher.geschrieben.length === 0 && speicher.geloescht === 0 && h.aufrufe.length === 1);
  }

  // Zwischenspeicher der Reihe nach; ersetzt() während des Schreibens
  {
    const { client, h } = aufbau();
    const reihe: string[] = [];
    let loese: (() => void) | null = null;
    const langsam = {
      geloescht: 0,
      lies: () => null,
      schreibe: (st: { show: { name: string } }) => new Promise<boolean>((r) => {
        reihe.push(`start ${st.show.name}`);
        loese = () => { reihe.push(`ende ${st.show.name}`); r(true); };
      }),
      loesche() { langsam.geloescht++; },
    };
    const f2 = new VerbundFolger({ client: client as never, speicher: langsam as never, uhr: testUhr().uhr, log: () => {} });
    f2.folge(h);
    f2.starte();
    client.verbinde();
    client.emit('daten', stand(0, { name: 'A' }));
    client.emit('daten', stand(1, { name: 'B' }));
    client.emit('daten', stand(2, { name: 'C' }));
    loese!();
    await ruhe();
    loese!();
    await ruhe();
    check('C12 Schreiben der Reihe nach, Zwischenstände fallen weg, der neueste zuletzt', reihe.join(',') === 'start A,ende A,start C,ende C', reihe);
    client.emit('daten', stand(3, { name: 'D' }));
    f2.ersetzt();
    loese!();
    await ruhe();
    check('C12 ersetzt() während des Schreibens → danach wieder gelöscht', langsam.geloescht === 2);
  }

  // kopplung() (16.2), wechsel (16.5), werfender Zuhörer
  {
    const { client, logs, folger, h } = aufbau();
    folger.starte();
    const k0 = folger.kopplung();
    check('C12 kopplung(): Rolle, Master, Adressen, masterAdresse null ohne Verbindung', k0?.rolle === 'slave' && k0.masterId === 'M1' && k0.masterName === 'Regie-PC' && k0.masterAdresse === null && k0.adressen.join(',') === '10.0.0.5,192.168.1.5' && k0.letzteAdresse === '10.0.0.5');
    client.verbinde();
    check('C12 kopplung(): masterAdresse = Adresse der laufenden Verbindung', folger.kopplung()?.masterAdresse === '10.0.0.5');
    const ereignisse: string[] = [];
    folger.on('wechsel', (d: { art: string }) => ereignisse.push(d.art));
    folger.folge(h);
    client.emit('daten', stand(0));
    client.emit('daten', stand(0));
    client.trenne();
    check('C12 wechsel bei jeder Änderung, nicht bei gleichem Stand', ereignisse.join(',') === 'aktuell,getrennt', ereignisse);
    check('C12 beiWechsel des Handlers bekommt dieselben Wechsel', h.wechsel.map((d) => d.art).join(',') === 'aktuell,getrennt');
    h.beiWechsel = () => { throw Object.assign(new Error('kaputt'), { code: 'EKAPUTT' }); };
    client.verbinde();
    client.trenne();
    client.verbinde();
    check('C12 werfender beiWechsel trifft die Zustandsmaschine nicht, eine Logzeile', folger.daten().art === 'warte' && logs.filter((l) => l.includes('Zuhörer von „beiWechsel“ warf (EKAPUTT)')).length === 1);
  }

  // verbundIgnoriert (16.1, E19): höchstens einmal je Minute und Weg
  {
    const { u, client, logs, folger, h } = aufbau();
    folger.folge(h);
    folger.starte();
    client.verbinde();
    client.emit('daten', stand(0));
    folger.ignoriert('reload');
    folger.ignoriert('reload');
    folger.ignoriert('deeplink', 'C:\\Shows\\Gala.jmshow');
    const zeilen = logs.filter((l) => l.includes('ignoriert') || l.includes('Deep-Link'));
    check('C12 ignoriert: Texte wörtlich 16.1, je Weg eine Zeile', JSON.stringify(zeilen) === JSON.stringify([
      'info: Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „Regie-PC“.',
      'info: Verbund: Show-Deep-Link „C:\\Shows\\Gala.jmshow“ liefert hier nur Dokumente, die Show-Daten kommen vom Master „Regie-PC“.',
    ]), zeilen);
    u.vor(59_999);
    folger.ignoriert('reload');
    check('C12 ignoriert: innerhalb 60 s unterdrückt', logs.filter((l) => l.includes('RELOAD ignoriert')).length === 1);
    u.vor(1);
    folger.ignoriert('reload');
    check('C12 ignoriert: nach 60 s wieder eine Zeile', logs.filter((l) => l.includes('RELOAD ignoriert')).length === 2);
  }
}

// ── C13 · Zwischenspeicher master-stand.json (Spec 16.3, E18, Review Focus 5) ─
{
  const { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { EventEmitter } = await import('node:events');
  const { migrateShow } = await import('@jm/show');
  const { erzeugeStandSpeicher, standDatei } = await import('../src/verbund-speicher');
  const { VerbundFolger } = await import('../src/verbund-daten');
  const tmp = mkdtempSync(join(tmpdir(), 'jm-verbund-'));
  try {
    const stand = {
      masterId: 'M1', masterName: 'Regie-PC', epoche: '6f1c2a90-1b2c-4d5e-8f90-a1b2c3d4e5f6', folge: 12, schluessel: '0123456789abcdef',
      show: migrateShow({ schemaVersion: 1, name: 'Gala', updatedAt: '2026-10-08T08:00:00.000Z', tools: [], ablauf: [{ id: 'p1', title: 'Begrüßung' }] }),
      mitDokument: ['jm-rundown'], empfangenAm: 1_760_000_000_000,
    };
    const userData = join(tmp, 'userData');
    const datei = standDatei(userData);
    check('C13 standDatei = <userData>/verbund/master-stand.json', datei === join(userData, 'verbund', 'master-stand.json'));
    const logs: string[] = [];
    const sp = erzeugeStandSpeicher(datei, (stufe, t) => void logs.push(`${stufe}: ${t}`));
    check('C13 ohne Datei → null, keine Warnung', sp.lies() === null && logs.length === 0);
    check('C13 schreiben → true, Ordner verbund angelegt', (await sp.schreibe(stand as never)) === true && existsSync(join(userData, 'verbund')));
    const roh = JSON.parse(readFileSync(datei, 'utf8'));
    check('C13 Datei trägt { fassung: 1, stand }', roh.fassung === 1 && roh.stand.folge === 12 && Object.keys(roh).join(',') === 'fassung,stand');
    check('C13 keine Zwischendatei liegen geblieben', JSON.stringify(readdirSync(join(userData, 'verbund'))) === '["master-stand.json"]');
    check('C13 schreiben und lesen ergibt denselben Stand', JSON.stringify(sp.lies()) === JSON.stringify(stand), sp.lies());

    // Review Focus 5: kaputt, leer, fremd, keine Show → null, EINE Warnung ohne Dateiinhalt
    const faelle: [string, string, string][] = [
      ['halb geschrieben', '{"fassung":1,"stand":{"masterId":"GEHEIM-1","masterName":"GEH', 'kein gültiges JSON'],
      ['leer', '', 'kein gültiges JSON'],
      ['fassung 2', JSON.stringify({ fassung: 2, stand: { ...stand, masterName: 'GEHEIM-2' } }), 'fassung'],
      ['show ist keine Show (Liste)', JSON.stringify({ fassung: 1, stand: { ...stand, show: ['GEHEIM-3'] } }), 'show'],
      ['show fehlt', JSON.stringify({ fassung: 1, stand: { ...stand, show: null } }), 'show'],
      ['masterId fehlt', JSON.stringify({ fassung: 1, stand: { ...stand, masterId: '' } }), 'masterId'],
      ['epoche mit Leerzeichen', JSON.stringify({ fassung: 1, stand: { ...stand, epoche: 'GEHEIM 4' } }), 'epoche'],
      ['folge negativ', JSON.stringify({ fassung: 1, stand: { ...stand, folge: -1 } }), 'folge'],
      ['kein Objekt', '[1,2,3]', 'kein Objekt'],
    ];
    for (const [name, inhalt, grund] of faelle) {
      writeFileSync(datei, inhalt);
      logs.length = 0;
      const ergebnis = sp.lies();
      check(`C13 ${name} → null, eine Warnung (${grund})`, ergebnis === null && logs.length === 1
        && logs[0] === `warn: Verbund: Zwischenspeicher nicht lesbar (${grund}), wird beim nächsten Stand überschrieben.`, logs);
      check(`C13 ${name}: Warnung ohne Dateiinhalt`, !logs.join('\n').includes('GEHEIM'));
    }
    check('C13 der nächste Stand überschreibt die kaputte Datei', (await sp.schreibe(stand as never)) === true && sp.lies()?.folge === 12);
    const ordnerStatt = join(tmp, 'ordner', 'master-stand.json');
    mkdirSync(ordnerStatt, { recursive: true });
    logs.length = 0;
    const sp2 = erzeugeStandSpeicher(ordnerStatt, (stufe, t) => void logs.push(`${stufe}: ${t}`));
    check('C13 Ordner statt Datei → null, Warnung mit Fehlercode', sp2.lies() === null && /^warn: Verbund: Zwischenspeicher nicht lesbar \((EISDIR|EPERM|EACCES)\)/.test(logs[0] ?? ''), logs);

    // Schreiben mit Wiederholung (E18): bis zu 5 Versuche im Abstand von 50 ms bei EPERM/EBUSY/EACCES
    const besetzt = (mal: number, code = 'EBUSY') => {
      const r = { versuche: 0 };
      const f = (von: string, nach: string): void => {
        r.versuche++;
        if (r.versuche <= mal) throw Object.assign(new Error(`${von} ist gesperrt`), { code });
        writeFileSync(nach, readFileSync(von));
        rmSync(von);
      };
      return { r, f };
    };
    const b4 = besetzt(4);
    logs.length = 0;
    const d4 = join(tmp, 'b4', 'master-stand.json');
    const start = Date.now();
    const ok4 = await erzeugeStandSpeicher(d4, (stufe, t) => void logs.push(`${stufe}: ${t}`), b4.f).schreibe(stand as never);
    const dauer = Date.now() - start;
    check('C13 EBUSY viermal, dann ok → true nach fünf Versuchen', ok4 === true && b4.r.versuche === 5 && logs.length === 0, { ok4, versuche: b4.r.versuche, logs });
    check('C13 Abstand zwischen den Versuchen 50 ms (vier Pausen ≥ 190 ms)', dauer >= 190, dauer);
    const b5 = besetzt(5);
    logs.length = 0;
    const d5 = join(tmp, 'b5', 'master-stand.json');
    const ok5 = await erzeugeStandSpeicher(d5, (stufe, t) => void logs.push(`${stufe}: ${t}`), b5.f).schreibe(stand as never);
    check('C13 EBUSY fünfmal → false, eine Warnung mit Code', ok5 === false && b5.r.versuche === 5 && JSON.stringify(logs) === '["warn: Verbund: Zwischenspeicher nicht geschrieben (EBUSY)."]', logs);
    check('C13 gescheitertes Schreiben räumt die Zwischendatei weg', readdirSync(join(tmp, 'b5')).length === 0);
    const bx = besetzt(1, 'ENOENT');
    const okx = await erzeugeStandSpeicher(join(tmp, 'bx', 'master-stand.json'), () => {}, bx.f).schreibe(stand as never);
    check('C13 anderer Fehler (ENOENT) → kein zweiter Versuch', okx === false && bx.r.versuche === 1);
    sp.loesche();
    sp.loesche();
    check('C13 loesche zweimal wirft nicht, danach null', sp.lies() === null && !existsSync(datei));

    // Neustart auf B: Folger mit echtem Speicher (16.3)
    class Client extends EventEmitter {
      z: Record<string, unknown> = { art: 'aus' };
      zustand() { return this.z; }
      kopplung() { return { rolle: 'slave', masterId: 'M1', masterName: 'Regie-PC', letzteAdresse: null, adressen: [] }; }
      sende() { return this.z.art === 'verbunden'; }
    }
    const angewendet: { name: string; neueShow: boolean }[] = [];
    const handler = { anwenden: (s: { show: { name: string } }, neueShow: boolean) => void angewendet.push({ name: s.show.name, neueShow }) };
    const c1 = new Client();
    const f1 = new VerbundFolger({ client: c1 as never, speicher: erzeugeStandSpeicher(datei, () => {}), log: () => {} });
    f1.folge(handler as never);
    f1.starte();
    c1.z = { art: 'verbunden', adresse: '10.0.0.5', seit: 0, masterName: 'Regie-PC', suite: '0.15.0' };
    c1.emit('angemeldet', {});
    c1.emit('daten', { t: 'stand', art: 'show', fassung: 1, epoche: 'e1', folge: 0, schluessel: '0123456789abcdef', show: stand.show, mitDokument: [] });
    // Auf das asynchrone Schreiben warten (Zwischendatei, dann umbenennen): bis die Datei da ist, höchstens 5 s.
    // Eine feste Pause wäre unter Last (CI) zu knapp.
    for (const ende = Date.now() + 5000; !existsSync(datei) && Date.now() < ende; ) await new Promise((r) => setTimeout(r, 10));
    f1.stoppe();
    const c2 = new Client();
    const f2 = new VerbundFolger({ client: c2 as never, speicher: erzeugeStandSpeicher(datei, () => {}), log: () => {} });
    f2.starte();
    f2.folge(handler as never);
    check('C13 Neustart: Stand aus master-stand.json mit neueShow false angewendet', JSON.stringify(angewendet) === '[{"name":"Gala","neueShow":true},{"name":"Gala","neueShow":false}]', angewendet);
    check('C13 Neustart, Master fehlt: Verbundmodus, Daten bleiben', f2.imVerbundmodus() === true && f2.daten().art === 'getrennt');
    f2.stoppe();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── Abschluss ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
