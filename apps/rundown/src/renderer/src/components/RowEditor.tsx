import { useState } from 'react';
import { Button, Select, TextInput } from '@jm/ui';
import { buildActionLine } from '@shared/conductor';
import { loeseSprungZiel } from '@shared/sprung';
import {
  ablaufPunkte,
  istSpeakerAbruf,
  istSprung,
  loeseSpeakerZiel,
  sendeArgs,
  speakerOptionen,
  speakerPatch,
  sperrenFuer,
  zeilenArt,
  zeilenHinweis,
  type AblaufPunkt,
  type ShowSicht,
} from '@shared/zeilen';
import { CAPABILITIES, KNOWN_ROLES, capAction } from '@/lib/capabilities';
import { addAction, duplicateAction, removeAction, updateAction, updateRow } from '@/lib/doc';
import { formatClock, parseClock } from '@/lib/duration';
import type { ShowIveoProgramRef, ShowIveoSpeaker } from '@jm/show';
import type { RundownAction, RundownDoc, RundownRow } from '@shared/types';

// Ungesteuerte Felder (defaultValue, Speichern bei onBlur, 5.5) bleiben echte input-Elemente: TextInput und NumberInput sind
// gesteuert. Das Aussehen ist das der geteilten Eingaben (EINGABE_KLASSE in @jm/ui, nicht exportiert), nur aus Tokens.
const FELD_BASIS =
  'h-[var(--control-h)] min-w-0 rounded-[var(--radius-md)] border border-[var(--field-border)] bg-[var(--input)] px-2.5 text-[13px] ' +
  'text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] select-text ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]';
const input = `w-full ${FELD_BASIS}`;

/** Default-Argumente einer Capability-Aktion (Reihenfolge wie im Protokoll). */
function defaultArgs(role: string, verb: string): (string | number)[] {
  const a = capAction(role, verb);
  return (a?.args ?? []).map((arg) => arg.default ?? (arg.type === 'number' ? 0 : ''));
}

export function RowEditor({
  doc,
  row,
  iveoSpeakers,
  iveoSideEvents,
  sicht,
  onDoc,
  onAlsEigeneZeile,
}: {
  doc: RundownDoc;
  row: RundownRow;
  iveoSpeakers: ShowIveoSpeaker[];
  iveoSideEvents: ShowIveoProgramRef[];
  /** Gemerkte Show: Sperren (4.5) und Sprung-Auswahl (6.2). */
  sicht: ShowSicht;
  onDoc: (doc: RundownDoc) => void;
  onAlsEigeneZeile: (rowId: string) => void;
}) {
  const sperre = sperrenFuer(row, sicht.showGemerkt);
  const hinweis = zeilenHinweis(row, sicht.showGemerkt, sicht.mitIveo);
  const entfallen = zeilenArt(row) === 'entfallen';
  const punkte = ablaufPunkte(doc.rows, sicht.ablaufSchluessel);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] p-3">
        <label className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Zeilen-Titel</label>
        {sperre.text ? (
          // 4.5: Gesperrte Felder sind gesteuert (value + readOnly) — ein Abgleich ist sofort sichtbar.
          <TextInput value={row.label} onChange={() => {}} readOnly className="opacity-70" />
        ) : (
          <input
            key={row.id}
            defaultValue={row.label}
            onBlur={(e) => onDoc(updateRow(doc, row.id, { label: e.target.value }))}
            className={input}
          />
        )}
        <label className="mt-2 block text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Dauer (mm:ss · optional, für Timer-Austausch)
        </label>
        {sperre.text ? (
          <TextInput value={formatClock(row.durationMs)} onChange={() => {}} readOnly className="opacity-70" />
        ) : (
          <input
            key={`${row.id}:dur`}
            defaultValue={formatClock(row.durationMs)}
            placeholder="z. B. 5:00"
            onBlur={(e) => onDoc(updateRow(doc, row.id, { durationMs: parseClock(e.target.value) }))}
            className={input}
          />
        )}
        {sperre.text && row.note && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--muted-foreground)]">{row.note}</p>
        )}
        {hinweis && (
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span className={entfallen ? 'text-[var(--warning)]' : ''}>{hinweis}</span>
            {entfallen && (
              <Button type="button" variant="outline" size="sm" uppercase={false} className="ml-auto" onClick={() => onAlsEigeneZeile(row.id)}>
                Als eigene Zeile behalten
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Aktionen beim GO ({row.actions.length})
        </div>
        {row.actions.map((a) => (
          <ActionRow
            key={a.id}
            doc={doc}
            rowId={row.id}
            action={a}
            iveoSpeakers={iveoSpeakers}
            iveoSideEvents={iveoSideEvents}
            sicht={sicht}
            punkte={punkte}
            onDoc={onDoc}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          uppercase={false}
          className="w-full border-dashed text-[var(--muted-foreground)]"
          onClick={() => onDoc(addAction(doc, row.id))}
        >
          + Aktion hinzufügen
        </Button>
      </div>
    </div>
  );
}

function ActionRow({
  doc,
  rowId,
  action,
  iveoSpeakers,
  iveoSideEvents,
  sicht,
  punkte,
  onDoc,
}: {
  doc: RundownDoc;
  rowId: string;
  action: RundownAction;
  iveoSpeakers: ShowIveoSpeaker[];
  iveoSideEvents: ShowIveoProgramRef[];
  sicht: ShowSicht;
  punkte: AblaufPunkt[];
  onDoc: (doc: RundownDoc) => void;
}) {
  const cap = capAction(action.role, action.verb);
  // 6.2: Vorschau mit der Nummer, die jetzt gesendet würde; null = Ziel entfallen.
  // Teil 2b (8.3, 8.4): Ein Speaker-Abruf zeigt den aktuellen Namen zu seiner Kennung, in der
  // Namensform. Ob beim GO die @-Form hinausgeht, entscheidet der Main nach dem STATE des Titlers.
  const sprungArgs = sendeArgs(action, (x) => loeseSprungZiel(x, sicht.ablaufSchluessel, sicht.eigeneTimerListe));
  const sendArgs = sprungArgs ? loeseSpeakerZiel({ ...action, args: sprungArgs }, iveoSpeakers, false) : null;
  const line = sendArgs ? buildActionLine(action.role, action.verb, sendArgs) : null;
  // 6.2: Für `timer goto` die Ablaufpunkte zur Auswahl — nicht bei eigener Timer-Liste.
  const sprungAuswahl = istSprung(action) && !sicht.eigeneTimerListe && (punkte.length > 0 || !!action.zielId);
  const handNr = Number(action.args[0]);
  const handPunkt = Number.isInteger(handNr) ? punkte[handNr - 1] : undefined;
  const [fired, setFired] = useState<'' | 'ok' | 'off'>('');
  // iveo-Komfort (#11): Beim Titler-Recall die Speaker der Show als Dropdown anbieten.
  // Ersetzt für diese Aktion die generische Arg-Eingabe. Teil 2b (8.2): Eine Auswahl bindet
  // über die iveo-Kennung (`speakerId`), `args[0]` behält den Namen. iveo verknüpft Programme
  // und Speaker zwar (Side Events, apps/launcher/src/main/iveo-abgleich-kern.ts `sideSpeakerIds`);
  // welche Programmzeile welchen Speaker abruft, entscheidet hier aber der Operator.
  const speakerPicker = istSpeakerAbruf(action) && iveoSpeakers.length > 0;
  const picker = speakerOptionen(action, iveoSpeakers);
  // iveo-Komfort (#11): Beim LAUNCHER-SIDEEVENT-Cue die Side Events der Show als
  // Dropdown (Wert = programId) — ein GO schaltet die offene Show live auf dieses
  // Side Event um (Ablauf=Agenda + Speaker). Ersetzt die generische Arg-Eingabe.
  const sideEventPicker =
    action.role === 'launcher' && action.verb === 'sideevent' && iveoSideEvents.length > 0;

  async function test(): Promise<void> {
    // 6.2: Der Main sucht die Aktion über ihre Kennung und löst auf wie beim GO.
    const ok = await window.jmrundown.fireAction(rowId, action.id);
    setFired(ok ? 'ok' : 'off');
    setTimeout(() => setFired(''), 1300);
  }

  function setRole(role: string): void {
    const verb = CAPABILITIES[role]?.actions[0]?.verb ?? '';
    onDoc(updateAction(doc, rowId, action.id, { role, verb, args: defaultArgs(role, verb), zielId: undefined }));
  }
  function setVerb(verb: string): void {
    onDoc(updateAction(doc, rowId, action.id, { verb, args: defaultArgs(action.role, verb), zielId: undefined }));
  }
  /** 6.2: Eine Auswahl schreibt sofort zielId und die Nummer in args[0]; '' = Nummer von Hand. */
  function waehleZiel(id: string): void {
    if (!id) {
      onDoc(updateAction(doc, rowId, action.id, { zielId: undefined }));
      return;
    }
    const p = punkte.find((x) => x.id === id);
    if (p) onDoc(updateAction(doc, rowId, action.id, { zielId: p.id, args: [p.n, ...action.args.slice(1)] }));
  }
  /** 8.2: Auswahl im Speaker-Picker → Kennung und Name; `alt:`/`fehlt:` lassen die Aktion, wie sie ist. */
  function waehleSpeaker(wert: string): void {
    const patch = speakerPatch(wert, iveoSpeakers);
    if (patch) onDoc(updateAction(doc, rowId, action.id, patch));
  }
  function setArg(i: number, value: string | number): void {
    const args = action.args.slice();
    args[i] = value;
    onDoc(updateAction(doc, rowId, action.id, { args }));
  }
  function setDelay(ms: number): void {
    const v = Number.isFinite(ms) ? Math.max(0, Math.trunc(ms)) : 0;
    onDoc(updateAction(doc, rowId, action.id, { delayMs: v > 0 ? v : undefined }));
  }

  const delayMs = action.delayMs ?? 0;

  return (
    <div
      className={`rounded-lg border border-[var(--border)] p-2 ${action.enabled ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={action.enabled}
          onChange={(e) => onDoc(updateAction(doc, rowId, action.id, { enabled: e.target.checked }))}
          title="aktiviert"
        />
        <Select
          value={action.role}
          onChange={setRole}
          className="flex-1"
          options={KNOWN_ROLES.filter((r) => r !== 'rundown').map((r) => ({ value: r, label: CAPABILITIES[r].label }))}
        />
        <Select
          value={action.verb}
          onChange={setVerb}
          className="flex-1"
          options={(CAPABILITIES[action.role]?.actions ?? []).map((a) => ({ value: a.verb, label: a.label }))}
        />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {fired === 'ok' && <span className="text-xs text-[var(--success)]">✓ gesendet</span>}
          {fired === 'off' && <span className="text-xs text-[var(--warning)]">⚠ offline</span>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            uppercase={false}
            onClick={test}
            disabled={!line}
            title={line ? 'diese Aktion jetzt an das Tool senden' : 'Ziel entfallen — wird nicht gesendet'}
          >
            Test
          </Button>
          <Button type="button" variant="ghost" size="sm" uppercase={false} onClick={() => onDoc(duplicateAction(doc, rowId, action.id))} title="Aktion duplizieren">
            ⧉
          </Button>
          <Button type="button" variant="ghost" size="sm" uppercase={false} onClick={() => onDoc(removeAction(doc, rowId, action.id))} title="Aktion löschen">
            ✕
          </Button>
        </div>
      </div>

      {speakerPicker && (
        <div className="mt-2">
          <label className="text-xs text-[var(--muted-foreground)]">
            iveo-Speaker (Bauchbinde)
            <Select
              value={picker.gewaehlt}
              onChange={waehleSpeaker}
              className="mt-0.5"
              options={picker.optionen.map((o) => ({ value: o.wert, label: o.text }))}
            />
          </label>
        </div>
      )}

      {sideEventPicker && (
        <div className="mt-2">
          <label className="text-xs text-[var(--muted-foreground)]">
            iveo Side Event (live schalten)
            <Select
              value={String(action.args[0] ?? '')}
              onChange={(v) => setArg(0, v)}
              className="mt-0.5"
              options={[{ value: '', label: '— Tagesübersicht (alle Side Events) —' }, ...iveoSideEvents.map((se) => ({ value: se.id, label: se.title }))]}
            />
          </label>
        </div>
      )}

      {sprungAuswahl && (
        <div className="mt-2 space-y-1">
          <label className="text-xs text-[var(--muted-foreground)]">
            Ablaufpunkt (Timer springt dorthin)
            <Select
              value={action.zielId ?? ''}
              onChange={waehleZiel}
              className="mt-0.5"
              options={[
                { value: '', label: 'Nummer von Hand' },
                ...punkte.map((p) => ({ value: p.id, label: `${p.n} · ${p.label}` })),
                ...(action.zielId && !punkte.some((p) => p.id === action.zielId) ? [{ value: action.zielId, label: 'Ziel entfallen' }] : []),
              ]}
            />
          </label>
          {!action.zielId && (
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span>
                {`Nummer von Hand: ${String(action.args[0] ?? '')}`}
                {handPunkt ? ` (${handPunkt.label})` : ''}
              </span>
              {handPunkt && (
                <Button type="button" variant="outline" size="sm" uppercase={false} className="ml-auto" onClick={() => waehleZiel(handPunkt.id)}>
                  an diesen Punkt binden
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {!speakerPicker && !sideEventPicker && !(sprungAuswahl && action.zielId) && cap?.args && cap.args.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {cap.args.map((arg, i) => (
            <label
              key={arg.id}
              className={`text-xs text-[var(--muted-foreground)]${arg.picker === 'file' ? ' col-span-2' : ''}`}
            >
              {arg.label}
              {arg.picker === 'file' ? (
                // Pfad-Argument: Textfeld (kontrolliert, damit „Durchsuchen" sichtbar
                // einträgt) + nativer Datei-Dialog. Pfad gilt auf dem Ziel-Rechner.
                <div className="mt-0.5 flex gap-1">
                  <TextInput
                    value={String(action.args[i] ?? '')}
                    placeholder="Pfad zur Datei…"
                    onChange={(v) => setArg(i, v)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    uppercase={false}
                    className="shrink-0"
                    onClick={async () => {
                      const p = await window.jmrundown.pickFile();
                      if (p) setArg(i, p);
                    }}
                  >
                    Durchsuchen…
                  </Button>
                </div>
              ) : arg.type === 'dropdown' ? (
                <Select
                  value={String(action.args[i] ?? arg.default ?? '')}
                  onChange={(v) => setArg(i, v)}
                  className="mt-0.5"
                  options={(arg.choices ?? []).map((c) => ({ value: c.id, label: c.label }))}
                />
              ) : (
                <input
                  type={arg.type === 'number' ? 'number' : 'text'}
                  defaultValue={String(action.args[i] ?? arg.default ?? '')}
                  min={arg.min}
                  max={arg.max}
                  onBlur={(e) =>
                    setArg(i, arg.type === 'number' ? Number(e.target.value) : e.target.value)
                  }
                  className={`${input} mt-0.5`}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]" title="Wartezeit vor dieser Aktion, relativ zur vorherigen Aktion derselben GO-Sequenz">
          <span>⏱ Verzögerung</span>
          <input
            type="number"
            min={0}
            step={100}
            defaultValue={delayMs}
            key={`${action.id}:${delayMs}`}
            onBlur={(e) => setDelay(Number(e.target.value))}
            className={`w-20 ${FELD_BASIS}`}
          />
          <span className="text-[var(--muted-foreground)]">ms</span>
        </label>
        <span className="ml-auto font-mono text-[11px] text-[var(--muted-foreground)]">
          {delayMs > 0 && <span className="text-[var(--muted-foreground)]">+{delayMs} ms </span>}→{' '}
          {line ?? <span className="text-[var(--warning)]">Ziel entfallen</span>}
        </span>
      </div>
    </div>
  );
}
