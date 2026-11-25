// UX Welle 2b, Studio-Control · Nachtrag zu Task 19 (Controller-Ruling, Global Constraint „Wahl ≠ Bewegung“): Die Rollen-Auswahl im
// Benutzer-Reiter hält je Zeile nur einen Entwurf, erst „Setzen“ ruft dasselbe updateRole(id, rolle) wie bisher. „Setzen“ ist nur
// frei, wenn der Entwurf von der gemeldeten Rolle abweicht, sonst gesperrt mit sichtbarem Grund; nach dem Setzen fällt der Entwurf
// weg; die eigene Zeile bleibt gesperrt. Geprüft über die echten Handler der Zeile (Elementbaum der hooklosen BenutzerZeile) und das
// gerenderte Markup, dazu die Verdrahtung in UserManager über den echten Store.
import { createElement } from 'react';
import { PEERS_TEXTE } from '@jm/settings';
import { Button } from '@jm/ui';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { STUDIO_TEXTE } from '@/lib/oberflaeche';
import * as um from '@/components/setup/UserManager';
import type { Role } from '@shared/roles';
import type { UserRow } from '@/types/admin';
import { attr, elemente, mitSitzung, mitStore, ohneKommentare, sitzungsBenutzer, tags, type Element } from './testzustand';

type Zeile = { wert: Role; eigene: boolean; setzenGrund: string | undefined; waehlen(r: Role): void; setzen(): Promise<void> };
type Entwurf = Readonly<Record<number, Role>>;
const T = (STUDIO_TEXTE as unknown as { rollenWahl?: { unveraendert: string; eigene: string } }).rollenWahl;
const api = um as unknown as {
  rollenZeile?: (a: { user: Pick<UserRow, 'id' | 'role'>; meId: number | undefined; entwurf: Entwurf; setzeEntwurf(f: (e: Entwurf) => Entwurf): void; updateRole(id: number, r: Role): Promise<void> }) => Zeile;
  BenutzerZeile?: (p: { user: UserRow; zeile: Zeile; grundId: string; loeschenGesperrt: boolean; onPasswort(): void; onLoeschen(): void }) => React.JSX.Element;
};

const ME = 1;
const gast = (role: Role = 'viewer'): UserRow => ({ id: 2, username: 'Gast', role, created_at: 0 });
const ich = (): UserRow => ({ id: ME, username: 'Admin', role: 'admin', created_at: 0 });

/** Eine Zeile mit eigenem Entwurf und einem Protokoll der Aufrufe von updateRole. */
function aufbau(antwort: 'ok' | 'fehler' = 'ok') {
  const z = { entwurf: {} as Entwurf, gesendet: [] as Array<[number, Role]>, offen: [] as Array<() => void> };
  const updateRole = (id: number, r: Role): Promise<void> => {
    z.gesendet.push([id, r]);
    return antwort === 'ok' ? Promise.resolve() : Promise.reject(new Error('500: x'));
  };
  const zeile = (user: UserRow): Zeile | undefined =>
    api.rollenZeile?.({ user, meId: ME, entwurf: z.entwurf, setzeEntwurf: (f) => (z.entwurf = f(z.entwurf)), updateRole });
  return { z, zeile };
}

/** Elementbaum der hooklosen Zeile (ohne Komponenten aufzurufen) und ihr Markup. */
function zeichne(user: UserRow, zeile: Zeile | undefined): { baum: Element[]; html: string } {
  if (api.BenutzerZeile === undefined || zeile === undefined) return { baum: [], html: '' };
  const p = { user, zeile, grundId: `grund-${user.id}`, loeschenGesperrt: user.id === ME, onPasswort: () => undefined, onLoeschen: () => undefined };
  return { baum: elemente(api.BenutzerZeile(p)), html: render(createElement(api.BenutzerZeile, p)) };
}
const auswahl = (baum: Element[]): Element | undefined => baum.find((e) => e.type === 'select');
const setzenKnopf = (baum: Element[]): Element | undefined => baum.find((e) => e.type === Button && e.props.children === PEERS_TEXTE.setzen);
const waehle = (baum: Element[], r: Role): void => (auswahl(baum)?.props.onChange as ((e: { target: { value: string } }) => void) | undefined)?.({ target: { value: r } });
const klick = async (baum: Element[]): Promise<void> => {
  (setzenKnopf(baum)?.props.onClick as (() => void) | undefined)?.();
  await new Promise((r) => setTimeout(r, 0));
};
const gewaehlt = (html: string): string | undefined => /<option value="(\w+)" selected=""/.exec(html)?.[1];

ok(typeof api.rollenZeile === 'function' && typeof api.BenutzerZeile === 'function', 'SC Rollen-Auswahl: UserManager exportiert die reine Zeilen-Bedienung (rollenZeile) und die hooklose BenutzerZeile');
ok(T !== undefined && [T.unveraendert, T.eigene].every((t) => t.length > 0 && !t.includes('"')), 'SC Rollen-Auswahl: die Sperrgründe stehen in STUDIO_TEXTE.rollenWahl, ohne ASCII-Anführungszeichen');

// 1 · Die Wahl allein sendet nichts, sie ändert nur den Entwurf der Zeile.
{
  const { z, zeile } = aufbau();
  waehle(zeichne(gast(), zeile(gast())).baum, 'operator');
  const danach = zeichne(gast(), zeile(gast()));
  ok(z.gesendet.length === 0 && z.entwurf[2] === 'operator', 'SC Rollen-Auswahl 1: die Wahl (auch per Pfeiltaste: change) sendet nichts, sie steht nur im Entwurf');
  ok(gewaehlt(danach.html) === 'operator' && attr(tags(danach.html, 'button').find((b) => b.includes(PEERS_TEXTE.setzenFuer('Gast'))), 'disabled') === undefined, 'SC Rollen-Auswahl 1: die Auswahl zeigt den Entwurf, „Setzen“ ist frei');
  waehle(danach.baum, 'viewer');
  ok(z.gesendet.length === 0 && !(2 in z.entwurf), 'SC Rollen-Auswahl 1: zurück auf die gemeldete Rolle gewählt fällt die Zeile aus dem Entwurf, gesendet wird weiter nichts');
}

// 2 · „Setzen“ sendet genau updateRole(id, neueRolle).
{
  const { z, zeile } = aufbau();
  waehle(zeichne(gast(), zeile(gast())).baum, 'operator');
  await klick(zeichne(gast(), zeile(gast())).baum);
  gleich(z.gesendet, [[2, 'operator']], 'SC Rollen-Auswahl 2: „Setzen“ ruft genau einmal updateRole(2, operator), dieselbe Nutzlast wie bisher');
}

// 3 · Ohne Abweichung ist „Setzen“ gesperrt, mit sichtbarem Grund.
{
  const { z, zeile } = aufbau();
  const { baum, html } = zeichne(gast(), zeile(gast()));
  const knopf = setzenKnopf(baum);
  ok(knopf?.props.disabled === true && zeile(gast())?.setzenGrund === T?.unveraendert, 'SC Rollen-Auswahl 3: ohne Entwurf ist „Setzen“ gesperrt, der Grund heißt „Die Rolle ist schon so eingestellt.“');
  ok(T !== undefined && html.includes(`id="grund-2"`) && html.includes(T.unveraendert) && attr(tags(html, 'button').find((b) => b.includes(PEERS_TEXTE.setzenFuer('Gast'))), 'aria-describedby') === 'grund-2', 'SC Rollen-Auswahl 3: der Grund steht sichtbar unter dem Knopf und ist mit ihm verknüpft (aria-describedby)');
  await zeile(gast())?.setzen();
  ok(z.gesendet.length === 0, 'SC Rollen-Auswahl 3: auch ein Aufruf von „Setzen“ ohne Abweichung sendet nichts');
  z.entwurf = { 2: 'operator' };
  ok(zeile(gast('operator'))?.setzenGrund === T?.unveraendert, 'SC Rollen-Auswahl 3: wird inzwischen genau die Rolle des Entwurfs gemeldet, gibt es keine Abweichung mehr, „Setzen“ ist gesperrt');
}

// 4 · Nach dem Setzen ist der Entwurf weg, auch wenn danach eine andere Rolle gemeldet wird.
{
  const { z, zeile } = aufbau();
  waehle(zeichne(gast(), zeile(gast())).baum, 'operator');
  await klick(zeichne(gast(), zeile(gast())).baum);
  ok(!(2 in z.entwurf), 'SC Rollen-Auswahl 4: nach dem Setzen ist der Entwurf verworfen');
  const fremd = zeichne(gast('admin'), zeile(gast('admin')));
  ok(gewaehlt(fremd.html) === 'admin' && setzenKnopf(fremd.baum)?.props.disabled === true, 'SC Rollen-Auswahl 4: meldet danach ein anderes Fenster „admin“, zeigt die Zeile „admin“ und „Setzen“ ist gesperrt (kein alter Entwurf dreht es zurück)');
  const nochmal = aufbau();
  waehle(zeichne(gast(), nochmal.zeile(gast())).baum, 'operator');
  const baum = zeichne(gast(), nochmal.zeile(gast())).baum;
  (setzenKnopf(baum)?.props.onClick as (() => void) | undefined)?.();
  waehle(zeichne(gast(), nochmal.zeile(gast())).baum, 'admin');
  await new Promise((r) => setTimeout(r, 0));
  ok(nochmal.z.entwurf[2] === 'admin', 'SC Rollen-Auswahl 4: eine neue Wahl während der Anfrage bleibt stehen, verworfen wird nur der gesendete Entwurf');
  const fehler = aufbau('fehler');
  waehle(zeichne(gast(), fehler.zeile(gast())).baum, 'operator');
  await klick(zeichne(gast(), fehler.zeile(gast())).baum);
  ok(fehler.z.entwurf[2] === 'operator' && fehler.z.gesendet.length === 1, 'SC Rollen-Auswahl 4: scheitert die Anfrage, bleibt der Entwurf (die Rolle ist nicht gesetzt), still wie bisher');
}

// 5 · Die eigene Zeile bleibt gesperrt, Auswahl und Knopf.
{
  const { z, zeile } = aufbau();
  const { baum, html } = zeichne(ich(), zeile(ich()));
  ok(auswahl(baum)?.props.disabled === true && setzenKnopf(baum)?.props.disabled === true, 'SC Rollen-Auswahl 5: in der eigenen Zeile sind Auswahl und „Setzen“ gesperrt (wie bisher die Auswahl)');
  ok(T !== undefined && zeile(ich())?.setzenGrund === T.eigene && html.includes(T.eigene), 'SC Rollen-Auswahl 5: der Grund „Du kannst deine eigene Rolle nicht ändern.“ steht sichtbar');
  waehle(baum, 'viewer');
  await zeile(ich())?.setzen();
  ok(z.gesendet.length === 0 && Object.keys(z.entwurf).length === 0, 'SC Rollen-Auswahl 5: auch ein direkter Aufruf ändert in der eigenen Zeile weder Entwurf noch Rolle');
}

// Verdrahtung: UserManager über den echten Store; die Auswahl ruft nie updateRole, „Setzen“ je Zeile.
{
  const html = mitSitzung({ token: 't', user: sitzungsBenutzer({ id: ME }) }, () => mitStore({ users: [ich(), gast()] }, () => render(createElement(um.UserManager))));
  const knoepfe = tags(html, 'button').filter((b) => b.includes(`aria-label="${PEERS_TEXTE.setzenFuer('')}`));
  ok(knoepfe.length === 2 && knoepfe.every((b) => attr(b, 'disabled') !== undefined), 'SC Rollen-Auswahl: UserManager zeigt je Benutzer „Setzen“, ohne Entwurf beide gesperrt');
  ok(T !== undefined && html.includes(T.eigene) && html.includes(T.unveraendert), 'SC Rollen-Auswahl: UserManager zeigt beide Gründe sichtbar (eigene Zeile, keine Abweichung)');
  const code = ohneKommentare(leseText('src/renderer/src/components/setup/UserManager.tsx'));
  ok(!/onChange=\{\(e\) => updateRole/.test(code) && /rollenZeile\(\{[^}]*updateRole/.test(code), 'SC Rollen-Auswahl: die Auswahl ruft updateRole nicht mehr direkt, UserManager reicht updateRole an rollenZeile');
}
