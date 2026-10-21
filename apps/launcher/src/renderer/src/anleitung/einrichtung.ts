// Erste geführte Anleitung: Einrichtung im Launcher (Spec docs/superpowers/specs/2026-10-17-gefuehrte-anleitungen-design.md,
// Abschnitt 5). Texte wörtlich aus der Texttabelle des Plans (9.1: A1–A48, 9.3: L1–L14, L15 ab P14); sie gehen vor dem
// Release zur Owner-Freigabe. Ändert sich ein gesprochener Text, entsteht seine Ansage neu (Prüfung „zu jedem Text eine Ansage“).
//
// Nur Daten und `import type` (G5): Vite, der Launcher-Selbsttest (node --experimental-strip-types) und das Erzeuger-Skript
// der Ansagen laden diese Datei gleichermaßen. Bedingungen sind Daten, nie Funktionen (EP2); ihre Namen liefert der
// Zustands-Adapter lib/anleitung-zustand.ts. Ziele sind feste Kennungen `data-anleitung="…"` an den Bedienelementen (EP10).
import type { Anleitung, Bedingung } from '@jm/ui/anleitung';

/** Fortschritt der Anleitung im localStorage des Launchers (EP4, JSON mit `format: 1`). */
export const ANLEITUNG_SCHLUESSEL = 'jmps:anleitung:einrichtung';
/** Stimme je Rechner (Spec 6): `'aus'` oder fehlt (EP4). */
export const STIMME_SCHLUESSEL = 'jmps:anleitungStimme';

/** Launcher-Texte rund um die Anleitung (Texttabelle 9.3, L1–L14; L15 ergänzt P14). */
export const LAUNCHER_ANLEITUNG_TEXTE = {
  /** L1: Option in k3.allein (Entscheidung `allein`). */
  optionAllein: 'Ich arbeite allein an diesem Rechner',
  /** L2: Option in k3.allein (weiter ohne Entscheidung). */
  optionVerbund: 'Verbund einrichten',
  /** L3: Option in k4.slave (Entscheidung `showVomMaster`, OFP2). */
  optionShowDa: 'Die Show ist da',
  /** L4: Option in k5.bestaetigen (Entscheidung `companionVerbunden`). */
  optionCompanion: 'Companion ist verbunden',
  /** L5–L8: direkte Aktionen der Kapitelübersicht (Bestand der Checkliste, Klick des Bedieners). */
  aktion: {
    k1: (fertig: boolean): string => (fertig ? 'Ändern' : 'Einrichten'),
    k2: (fertig: boolean): string => (fertig ? 'Werkzeugkasten' : 'Auswählen'),
    k3: 'Verbund öffnen',
    k4: 'Vorlage wählen',
    k5: 'Prüfen',
  },
  /** L9, L10: Detailzeilen der Kapitelübersicht (Bestand der Checkliste; L10 ohne „Tool(s)“). */
  detail: {
    k1: (quelle: 'proxy' | 'github'): string => (quelle === 'proxy' ? 'Aktiv: Firmen-Proxy.' : 'Aktiv: GitHub.'),
    k2: (n: number): string =>
      n === 1 ? '1 Tool installiert, weitere jederzeit im Werkzeugkasten.' : `${n} Tools installiert, weitere jederzeit im Werkzeugkasten.`,
  },
  /** L11: Knopf im Kopf (sichtbarer Name) und sein Titel. */
  knopf: 'Erste Schritte',
  knopfTitel: 'Erste Schritte · geführte Einrichtung',
  /** L12: Hinweis für bestehende Rechner (OF2, EP8). */
  neu: 'Neu: geführte Einrichtung',
  /** L13: Kopf der Kapitelübersicht. */
  titel: 'Willkommen bei der JM Production Suite',
  unterzeile: 'In sechs Schritten startklar. Jeden Schritt kannst du dir einzeln zeigen lassen.',
  /** L14: Fuß der Kapitelübersicht. */
  tipp: 'Tipp: Das JM Kochbuch (oben) hat Anleitungen & Best Practices.',
  schliessen: 'Schließen',
  /** L15: in der Sprechblase statt U21, solange kurz nach dem Start unklar ist, ob eine Produktion läuft (EP24, P14). */
  stimmeWartet: 'Die Stimme wartet noch kurz: Ob gerade eine Produktion läuft, sehe ich erst ein paar Sekunden nach dem Start des Launchers.',
} as const;

/** Die 20 Ziel-Kennungen der Anleitung in der Reihenfolge der Texttabelle (für Test und Doku, EP10). */
export const ZIEL_KENNUNGEN: readonly string[] = [
  'kopf.erste-schritte',
  'kopf.einstellungen',
  'einstellungen.zugang',
  'reiter.werkzeugkasten',
  'werkzeugkasten.kategorien',
  'werkzeugkasten.installieren',
  'kopf.verbund',
  'verbund.rollen',
  'verbund.koppeln-master',
  'verbund.code',
  'reiter.show',
  'show.vorlage',
  'szenario.auswahl',
  'editor.name',
  'editor.iveo',
  'editor.speichern',
  'kopf.system',
  'system.sicher',
  'system.steuerebene',
  'kopf.show-oeffnen',
];

const ROLLE_AUS: Bedingung = { zustand: 'rolleAus' };
const ROLLE_MASTER: Bedingung = { zustand: 'rolleMaster' };
const ROLLE_SLAVE: Bedingung = { zustand: 'rolleSlave' };
/** Verbund = Master oder Slave. */
const VERBUND: Bedingung = { eineVon: [ROLLE_MASTER, ROLLE_SLAVE] };
/** Einzelplatz = nicht im Verbund, also auch bei unbekannter Rolle (EP6): Jedes Kapitel hat in jeder Lage einen Schritt. */
const EINZELPLATZ: Bedingung = { nicht: VERBUND };
const NICHT_SLAVE: Bedingung = { nicht: ROLLE_SLAVE };
/** Slave gekoppelt und einmal verbunden gewesen (EP5): Der Haken bleibt, wenn der Master später aus ist; entkoppelt fällt er weg. */
const SLAVE_GEKOPPELT_UND_VERBUNDEN: Bedingung = { alle: [{ zustand: 'slaveGekoppelt' }, { ereignis: 'slaveWarVerbunden' }] };
/** Sichere Steuerebene eingerichtet (Konfiguration; sie wirkt erst nach dem Neustart, EP5). Hakt Kapitel 5 nie ab. */
const STEUEREBENE_SICHER: Bedingung = { zustand: 'steuerebeneSicher' };
const EDITOR_FEHLT = 'Der Show-Editor ist nicht offen. Klicke bei „Aus Vorlage starten“ auf „Vorlage wählen“.';
/** Knöpfe im Kopf fehlen, wenn das Fenster zu schmal ist: Die Knopfleiste rechts bricht nicht um (Header.tsx). */
const KOPF_FEHLT = 'Ich sehe den Knopf oben rechts gerade nicht. Zieh das Fenster breiter.';
const REITER_FEHLT = 'Ich sehe die Reiter oben links gerade nicht. Zieh das Fenster größer.';

/** Anleitung „Einrichtung“ (Spec 5, Texttabelle 9.1). Kapitel und Schritte je nach Rolle über `giltWenn`. */
export const EINRICHTUNG: Anleitung = {
  format: 1,
  id: 'einrichtung',
  titel: 'Einrichtung',
  einleitung: {
    id: 'einleitung',
    art: 'erklaeren',
    text: 'Willkommen bei der JM Production Suite. Ich führe dich in sechs Schritten durch die Einrichtung. Du kannst jederzeit pausieren und später weitermachen.',
  },
  rueckfrage: {
    id: 'rueckfrage',
    art: 'erklaeren',
    ziel: 'kopf.erste-schritte',
    zielFehlt: KOPF_FEHLT,
    text: 'Willst du die Anleitung wirklich überspringen? Du findest sie jederzeit oben unter „Erste Schritte“.',
  },
  abschluss: {
    id: 'abschluss',
    art: 'erklaeren',
    ziel: 'kopf.erste-schritte',
    zielFehlt: KOPF_FEHLT,
    text: 'Das war die Einrichtung. Alle Schritte findest du jederzeit unter „Erste Schritte“, offene kannst du dort fortsetzen.',
  },
  wiederfinden: 'Übersprungenes findest du jederzeit oben unter „Erste Schritte“.',
  kapitel: [
    {
      id: 'k1',
      titel: 'Anmelden',
      kurz: 'Proxy-Schlüssel oder GitHub-Zugang hinterlegen, damit Tools installiert und aktualisiert werden können.',
      erledigt: 'Dieser Rechner ist schon mit der Release-Quelle verbunden. Du kannst gleich weitermachen.',
      erledigtWenn: { zustand: 'quelleVerbunden' },
      brauchtNicht: true,
      schritte: [
        {
          id: 'k1.einstellungen',
          art: 'handeln',
          ziel: 'kopf.einstellungen',
          zielFehlt: KOPF_FEHLT,
          erledigtWenn: { zustand: 'einstellungenOffen' },
          text: 'Damit der Launcher Tools laden kann, braucht er eine Verbindung zur Release-Quelle. Öffne dazu die Einstellungen.',
        },
        {
          id: 'k1.zugang',
          art: 'handeln',
          ziel: 'einstellungen.zugang',
          zielFehlt: 'Öffne zuerst oben die Einstellungen.',
          ueberspringenHinweis: true,
          erledigtWenn: { zustand: 'quelleVerbunden' },
          text: 'Trage hier den Proxy-Schlüssel oder deinen GitHub-Zugang ein und klicke auf „Speichern“. Ohne Internet geht das nicht; dann überspringe diesen Schritt.',
        },
      ],
    },
    {
      id: 'k2',
      titel: 'Tools installieren',
      kurz: 'Im Werkzeugkasten die Tools für deine Produktion auswählen und installieren.',
      erledigt: 'Auf diesem Rechner ist schon mindestens ein Tool installiert.',
      erledigtWenn: { zustand: 'toolInstalliert' },
      brauchtNicht: true,
      schritte: [
        {
          id: 'k2.reiter',
          art: 'handeln',
          ziel: 'reiter.werkzeugkasten',
          zielFehlt: REITER_FEHLT,
          erledigtWenn: { zustand: 'reiterWerkzeugkasten' },
          text: 'Alle Tools der Suite findest du im Werkzeugkasten. Öffne den Reiter „Werkzeugkasten“.',
        },
        {
          id: 'k2.katalog',
          art: 'erklaeren',
          ziel: 'werkzeugkasten.kategorien',
          zielFehlt: 'Öffne zuerst den Reiter „Werkzeugkasten“.',
          text: 'Das ist der Katalog. Mit den Kategorien und der Suche findest du schnell das passende Tool.',
        },
        {
          id: 'k2.installieren',
          art: 'handeln',
          ziel: 'werkzeugkasten.installieren',
          zielFehlt: 'Ich sehe gerade kein Tool zum Installieren. Stelle den Filter über dem Katalog auf „Alle“.',
          ueberspringenHinweis: true,
          erledigtWenn: { zustand: 'toolInstalliert' },
          text: 'Wähle ein Tool für deine Produktion und klicke auf „Installieren“. Ohne Internet geht das nicht; dann überspringe diesen Schritt.',
        },
      ],
    },
    {
      id: 'k3',
      titel: 'Rolle im Verbund wählen und koppeln',
      kurz: 'Festlegen, ob dieser Rechner allein arbeitet, Master ist oder sich mit einem Master verbindet.',
      erledigt: 'Die Rolle dieses Rechners im Verbund ist schon eingerichtet.',
      erledigtWenn: { eineVon: [ROLLE_MASTER, SLAVE_GEKOPPELT_UND_VERBUNDEN, { alle: [ROLLE_AUS, { entscheidung: 'allein' }] }] },
      brauchtNicht: true,
      schritte: [
        {
          id: 'k3.verbund',
          art: 'erklaeren',
          ziel: 'kopf.verbund',
          zielFehlt: 'Die Verbund-Anzeige ist gerade nicht zu sehen. Du findest den Verbund auch in den Einstellungen.',
          text: 'Arbeiten mehrere Rechner zusammen, ist einer der Master und verteilt die Show. Die anderen verbinden sich mit ihm.',
        },
        {
          id: 'k3.allein',
          art: 'entscheiden',
          optionen: [
            { knopf: LAUNCHER_ANLEITUNG_TEXTE.optionAllein, entscheidung: 'allein' },
            { knopf: LAUNCHER_ANLEITUNG_TEXTE.optionVerbund },
          ],
          text: 'Arbeitest du allein an diesem Rechner? Dann brauchst du keinen Verbund.',
        },
        {
          id: 'k3.oeffnen',
          art: 'handeln',
          ziel: 'kopf.verbund',
          zielFehlt: 'Öffne die Einstellungen und klicke dort auf „Verbund öffnen“.',
          erledigtWenn: { zustand: 'verbundOffen' },
          text: 'Öffne den Verbund mit einem Klick auf die Verbund-Anzeige oben.',
        },
        {
          id: 'k3.rolle',
          art: 'handeln',
          eingriff: true,
          ziel: 'verbund.rollen',
          zielFehlt: 'Öffne zuerst den Verbund. Ist er offen, lädt er noch oder sagt dort, warum die Rollen fehlen.',
          erledigtWenn: VERBUND,
          text: 'Wähle „Master“ für den Rechner, der die Show verteilt, oder „Mit Master verbinden“ für alle anderen.',
        },
        {
          id: 'k3.master',
          art: 'erklaeren',
          ziel: 'verbund.koppeln-master',
          zielFehlt: 'Öffne zuerst den Verbund. Ist er offen, läuft der Master noch nicht: Warte kurz oder lies dort unter „Master“, was ihn aufhält.',
          giltWenn: ROLLE_MASTER,
          ueberspringenHinweis: true,
          text: 'Mit „Rechner koppeln“ zeigt der Master einen Code. Gib ihn am anderen Rechner unter „Mit Master verbinden“ ein. Ohne zweiten Rechner machst du das später.',
        },
        {
          id: 'k3.slave',
          art: 'handeln',
          eingriff: true,
          ziel: 'verbund.code',
          zielFehlt: 'Öffne zuerst den Verbund. Ist er offen, ist dieser Rechner schon gekoppelt; ob er den Master erreicht, steht dort unter „Master“.',
          giltWenn: ROLLE_SLAVE,
          ueberspringenHinweis: true,
          erledigtWenn: SLAVE_GEKOPPELT_UND_VERBUNDEN,
          text: 'Wähle deinen Master in der Liste oder trage seine Adresse ein. Gib dann den Code ein, den der Master unter „Rechner koppeln“ zeigt, und klicke auf „Koppeln“. Ohne Master im Netz geht das nicht; dann überspringe diesen Schritt.',
        },
      ],
    },
    {
      id: 'k4',
      titel: 'Erste Show anlegen und an ein iveo-Event binden',
      kurz: 'Wähle, was du produzierst (Konferenz, Battle, Bühne, Podcast), und speichere die passende Show.',
      erledigt: 'Die erste Show hast du an diesem Rechner schon gespeichert oder vom Master bekommen.',
      erledigtWenn: {
        eineVon: [
          { alle: [NICHT_SLAVE, { ereignis: 'showGespeichert' }] },
          { alle: [ROLLE_SLAVE, { entscheidung: 'showVomMaster' }] },
        ],
      },
      brauchtNicht: true,
      schritte: [
        {
          id: 'k4.reiter',
          art: 'handeln',
          ziel: 'reiter.show',
          zielFehlt: REITER_FEHLT,
          giltWenn: NICHT_SLAVE,
          erledigtWenn: { zustand: 'reiterShow' },
          text: 'Shows legst du im Reiter „JM Show“ an. Öffne ihn.',
        },
        {
          id: 'k4.slave',
          art: 'entscheiden',
          giltWenn: ROLLE_SLAVE,
          optionen: [{ knopf: LAUNCHER_ANLEITUNG_TEXTE.optionShowDa, entscheidung: 'showVomMaster' }],
          text: 'An diesem Rechner kommt die Show vom Master; iveo und Tokens bleiben dort. Die Anleitung kann das hier nicht selbst sehen: Zeigen deine Tools die Show des Masters?',
        },
        {
          id: 'k4.vorlage',
          art: 'handeln',
          ziel: 'show.vorlage',
          zielFehlt: 'Öffne zuerst den Reiter „JM Show“.',
          giltWenn: NICHT_SLAVE,
          erledigtWenn: { zustand: 'szenarienOffen' },
          text: 'Am schnellsten geht es mit einer Vorlage. Klicke bei „Aus Vorlage starten“ auf „Vorlage wählen“.',
        },
        {
          id: 'k4.szenario',
          art: 'handeln',
          ziel: 'szenario.auswahl',
          zielFehlt: 'Klicke zuerst bei „Aus Vorlage starten“ auf „Vorlage wählen“.',
          giltWenn: NICHT_SLAVE,
          erledigtWenn: { zustand: 'editorOffen' },
          text: 'Wähle, was du produzierst, und klicke auf „Los“. Der Show-Editor übernimmt die passenden Tools.',
        },
        {
          id: 'k4.name',
          art: 'erklaeren',
          ziel: 'editor.name',
          zielFehlt: EDITOR_FEHLT,
          giltWenn: NICHT_SLAVE,
          text: 'Gib der Show einen Namen, an dem du sie wiedererkennst.',
        },
        {
          id: 'k4.iveo',
          art: 'erklaeren',
          ziel: 'editor.iveo',
          zielFehlt: EDITOR_FEHLT,
          giltWenn: NICHT_SLAVE,
          text: 'Arbeitest du mit einem iveo-Event, bindest du es hier mit Token und Event an. Ohne iveo klickst du einfach auf „Weiter“.',
        },
        {
          id: 'k4.speichern',
          art: 'handeln',
          ziel: 'editor.speichern',
          zielFehlt: EDITOR_FEHLT,
          giltWenn: NICHT_SLAVE,
          erledigtWenn: { ereignis: 'showGespeichert' },
          text: 'Speichere die Show. Das startet noch keine Tools; das kommt im letzten Schritt.',
        },
      ],
    },
    {
      id: 'k5',
      titel: 'Fernsteuerung für Companion einrichten',
      kurz: 'Sehen, ob sich die Tools im Netz finden, und Companion anbinden; am Einzelplatz mit der sicheren Steuerebene.',
      erledigt: 'Du hast schon bestätigt, dass Companion mit diesem Rechner verbunden ist.',
      // Ob Companion verbunden ist, sieht der Launcher nicht: An jeder Rolle zählt nur die Bestätigung (Spec 3.1, EP5).
      erledigtWenn: { entscheidung: 'companionVerbunden' },
      brauchtNicht: true,
      schritte: [
        {
          id: 'k5.system',
          art: 'handeln',
          ziel: 'kopf.system',
          zielFehlt: KOPF_FEHLT,
          giltWenn: EINZELPLATZ,
          ueberspringenHinweis: true,
          erledigtWenn: { zustand: 'systemOffen' },
          text: 'Mit Companion steuerst du die Tools zum Beispiel per Stream Deck. Öffne dazu den System-Zustand. Ohne Companion überspringe diesen Schritt.',
        },
        {
          // Empfehlung mit „Weiter“ (der offene Modus bleibt erlaubt); nach dem Aktivieren gilt der Schritt nicht mehr, und der
          // Kern geht von selbst zu Token und QR (Regel 11).
          id: 'k5.sicher',
          art: 'erklaeren',
          eingriff: true,
          ziel: 'system.sicher',
          zielFehlt: 'Öffne zuerst den System-Zustand.',
          giltWenn: { alle: [EINZELPLATZ, { nicht: STEUEREBENE_SICHER }] },
          text: 'Am Einzelplatz empfehle ich die sichere Steuerebene. Klicke auf „Sichere Steuerebene aktivieren“; bleibst du beim offenen Modus, klicke auf „Weiter“.',
        },
        {
          // Vor dem Neustart: Die Karte zeigt das Token nur direkt nach dem Aktivieren bzw. Erneuern (SystemStatusModal).
          id: 'k5.companion',
          art: 'erklaeren',
          ziel: 'system.steuerebene',
          zielFehlt: 'Öffne den System-Zustand.',
          giltWenn: { alle: [EINZELPLATZ, STEUEREBENE_SICHER] },
          text: 'Trag Token und Fingerprint in Companion ein oder scanne den QR-Code. Token und QR-Code zeigt die Karte nur direkt nach dem Aktivieren oder Erneuern. Fehlt das Token hier und hat Companion es noch nicht, erzeugt „Erneuern“ ein neues; das braucht wieder einen Neustart.',
        },
        {
          // Nur nach einem Wechsel offen → sicher (Ereignis steuerebeneAktiviert); eine schon vorher sichere Steuerebene wirkt.
          // Nach dem erledigten Neustart (Ereignis neustart:k5.neustart, vom Kern gemerkt) gilt der Schritt nicht mehr.
          id: 'k5.neustart',
          art: 'neustart',
          eingriff: true,
          giltWenn: { alle: [EINZELPLATZ, STEUEREBENE_SICHER, { ereignis: 'steuerebeneAktiviert' }, { nicht: { ereignis: 'neustart:k5.neustart' } }] },
          text: 'Die sichere Steuerebene wirkt erst nach einem Neustart. Beende laufende Tools und den Launcher und starte den Launcher neu. Danach geht es hier weiter.',
        },
        {
          id: 'k5.verbund',
          art: 'erklaeren',
          giltWenn: VERBUND,
          text: 'Im Verbund trägt die sichere Steuerebene über mehrere Rechner noch nicht: Ein Rechner im sicheren Modus findet die offenen nicht. Companion verbindest du im Verbund darum im offenen Modus.',
        },
        {
          id: 'k5.bestaetigen',
          art: 'entscheiden',
          ueberspringenHinweis: true,
          optionen: [{ knopf: LAUNCHER_ANLEITUNG_TEXTE.optionCompanion, entscheidung: 'companionVerbunden' }],
          text: 'Verbinde Companion mit diesem Rechner. Klappt die Verbindung, bestätige es hier. Ohne Companion überspringe diesen Schritt.',
        },
      ],
    },
    {
      id: 'k6',
      titel: 'Tools aus der Show starten',
      kurz: 'Die Show öffnen: Der Launcher startet die Tools, die darin stehen.',
      erledigt: 'Du hast schon Tools aus einer Show gestartet.',
      erledigtWenn: { zustand: 'showGestartet' },
      brauchtNicht: true,
      schritte: [
        {
          id: 'k6.master',
          art: 'erklaeren',
          giltWenn: ROLLE_MASTER,
          text: 'Achtung: Am Master verteilt das Öffnen einer Show sie an den ganzen Verbund. Am Timer der anderen Rechner beginnt der Countdown dann neu.',
        },
        {
          id: 'k6.oeffnen',
          art: 'handeln',
          eingriff: true,
          ziel: 'kopf.show-oeffnen',
          zielFehlt: KOPF_FEHLT,
          erledigtWenn: { zustand: 'showGestartet' },
          text: 'Öffne jetzt deine Show mit „Show öffnen“. Der Launcher startet die Tools, die darin stehen; den Klick machst du selbst.',
        },
      ],
    },
  ],
};

// ── Ende des Moduls ──
