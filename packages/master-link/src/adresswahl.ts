import type { NetworkInterfaceInfo } from 'node:os';

// Netzwerkwahl und Adressreihenfolge (Spec 4.1, 4.4) — reine Funktionen.

export type NetzwerkInterfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

export interface KartenAdresse {
  adresse: string;
  praefix: number;
}

export interface Karte {
  name: string;
  adressen: KartenAdresse[];
  virtuell: boolean;
  nurLinkLocal: boolean;
}

const VIRTUELL = [
  /vethernet/i, /hyper-v/i, /virtualbox/i, /vmware/i, /wsl/i, /tailscale/i, /zerotier/i,
  /\btap\b/i, /vpn/i, /loopback pseudo/i, /^utun/i, /^bridge/i,
];

export function istVirtuell(name: string): boolean {
  return VIRTUELL.some((m) => m.test(name));
}

export function istLinkLocal(adresse: string): boolean {
  return adresse.startsWith('169.254.');
}

function zuZahl(adresse: string): number | null {
  const teile = adresse.split('.');
  if (teile.length !== 4) return null;
  let z = 0;
  for (const t of teile) {
    if (!/^\d{1,3}$/.test(t)) return null;
    const n = Number(t);
    if (n > 255) return null;
    z = z * 256 + n;
  }
  return z;
}

export function istIPv4Adresse(a: string): boolean {
  return zuZahl(a) !== null;
}

function istIPv4(i: NetworkInterfaceInfo): boolean {
  return i.family === 'IPv4' || (i.family as unknown) === 4;
}

function praefixAus(i: NetworkInterfaceInfo): number {
  if (i.cidr) {
    const p = Number(i.cidr.split('/')[1]);
    if (Number.isInteger(p) && p >= 0 && p <= 32) return p;
  }
  const m = zuZahl(i.netmask) ?? 0;
  return m.toString(2).split('').filter((b) => b === '1').length;
}

export function listeKarten(ni: NetzwerkInterfaces): Karte[] {
  const karten: Karte[] = [];
  for (const [name, eintraege] of Object.entries(ni)) {
    const v4 = (eintraege ?? []).filter((i) => !i.internal && istIPv4(i));
    if (v4.length === 0) continue;
    const adressen = v4.map((i) => ({ adresse: i.address, praefix: praefixAus(i) }));
    karten.push({
      name,
      adressen,
      virtuell: istVirtuell(name),
      nurLinkLocal: adressen.every((a) => istLinkLocal(a.adresse)),
    });
  }
  return karten.sort((a, b) => a.name.localeCompare(b.name));
}

export function imSubnetz(adresse: string, netz: KartenAdresse): boolean {
  const a = zuZahl(adresse);
  const n = zuZahl(netz.adresse);
  if (a === null || n === null) return false;
  const block = 2 ** (32 - netz.praefix);
  return Math.floor(a / block) === Math.floor(n / block);
}

/** Gewählte Karte vorhanden → nur sie; fehlt sie → alle Karten und karteFehlt (Spec 4.1: weiter mit Automatisch). */
export function wirksameKarten(karten: Karte[], gewaehlt: string | null): { karten: Karte[]; karteFehlt: boolean } {
  if (gewaehlt === null) return { karten, karteFehlt: false };
  const k = karten.find((x) => x.name === gewaehlt);
  return k ? { karten: [k], karteFehlt: false } : { karten, karteFehlt: true };
}

/**
 * Ordnet Master-Adressen aus mDNS (Spec 4.4): entdoppeln, IPv6/Loopback raus,
 * dann gewählte Karte → nicht virtuelle Karte → virtuelle Karte → Rest → 169.254.
 */
export function ordneKandidaten(masterAdressen: string[], eigeneKarten: Karte[], gewaehlteKarte: string | null): string[] {
  const gewaehlt = gewaehlteKarte ? eigeneKarten.find((k) => k.name === gewaehlteKarte) : undefined;
  const liste = [...new Set(masterAdressen)].filter((a) => istIPv4Adresse(a) && !a.startsWith('127.'));
  const imNetzVon = (a: string, karten: Karte[]): boolean =>
    karten.some((k) => k.adressen.some((n) => !istLinkLocal(n.adresse) && imSubnetz(a, n)));
  const rang = (a: string): number => {
    if (istLinkLocal(a)) return 5;
    if (gewaehlt && imNetzVon(a, [gewaehlt])) return 1;
    if (imNetzVon(a, eigeneKarten.filter((k) => !k.virtuell))) return 2;
    if (imNetzVon(a, eigeneKarten.filter((k) => k.virtuell))) return 3;
    return 4;
  };
  return liste
    .map((a, i) => ({ a, r: rang(a), i }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.a);
}

export interface KandidatenQuelle {
  rolle: 'master' | 'slave';
  mdns: string[];
  letzteAdresse: string | null;
  adressen: string[];
  festeAdresse: string | null;
  karten: Karte[];
  gewaehlteKarte: string | null;
}

/** Spec 4.5: Master-Rechner nur 127.0.0.1; sonst mDNS → zuletzt → Datei → feste Adresse, entdoppelt. */
export function kandidatenliste(q: KandidatenQuelle): string[] {
  if (q.rolle === 'master') return ['127.0.0.1'];
  const alle = [
    ...ordneKandidaten(q.mdns, q.karten, q.gewaehlteKarte),
    ...(q.letzteAdresse ? [q.letzteAdresse] : []),
    ...q.adressen,
    ...(q.festeAdresse ? [q.festeAdresse] : []),
  ];
  return [...new Set(alle)];
}
