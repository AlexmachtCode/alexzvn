import type { NetworkInterfaceInfo } from 'node:os';
import { abschnitt, gleich, pruefe } from './helfer';
import {
  imSubnetz, istVirtuell, kandidatenliste, listeKarten, ordneKandidaten, wirksameKarten, type NetzwerkInterfaces,
} from '../src/adresswahl';

const v4 = (address: string, cidr: string, internal = false): NetworkInterfaceInfo => ({
  address, netmask: '255.255.255.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal, cidr,
});
const v6 = (address: string): NetworkInterfaceInfo => ({
  address, netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:11:22:33:44:55', internal: false, cidr: `${address}/64`, scopeid: 0,
});

// Realistischer Regie-Laptop: LAN, Hyper-V, VPN, WLAN ohne DHCP, Loopback.
const regie: NetzwerkInterfaces = {
  'Ethernet 2': [v4('10.0.0.110', '10.0.0.110/24'), v6('fe80::1')],
  'vEthernet (Default Switch)': [v4('172.20.64.1', '172.20.64.1/20')],
  'Tailscale': [v4('100.64.0.5', '100.64.0.5/10')],
  'WLAN': [v4('169.254.10.20', '169.254.10.20/16')],
  'Loopback Pseudo-Interface 1': [v4('127.0.0.1', '127.0.0.1/8', true)],
  'Ethernet 3': [v6('fe80::2')],
};

export async function laufe(): Promise<void> {
  abschnitt('Adresswahl: Karten');
  const karten = listeKarten(regie);
  gleich(karten.map((k) => k.name), ['Ethernet 2', 'Tailscale', 'vEthernet (Default Switch)', 'WLAN'], 'nur nicht-interne Karten mit IPv4, nach Name');
  gleich(karten.find((k) => k.name === 'Ethernet 2')?.adressen, [{ adresse: '10.0.0.110', praefix: 24 }], 'Präfix aus cidr');
  pruefe(karten.find((k) => k.name === 'vEthernet (Default Switch)')!.virtuell, 'Hyper-V als virtuell markiert');
  pruefe(karten.find((k) => k.name === 'Tailscale')!.virtuell, 'Tailscale als virtuell markiert');
  pruefe(!karten.find((k) => k.name === 'Ethernet 2')!.virtuell, 'Ethernet 2 nicht virtuell');
  pruefe(karten.find((k) => k.name === 'WLAN')!.nurLinkLocal, 'WLAN nur 169.254 → nurLinkLocal');
  pruefe(istVirtuell('utun3') && istVirtuell('bridge100') && !istVirtuell('en0'), 'macOS-Namen utun/bridge virtuell, en0 nicht');
  const zweiIPs = listeKarten({ 'Ethernet': [v4('10.0.0.5', '10.0.0.5/24'), v4('192.168.10.5', '192.168.10.5/24')] });
  gleich(zweiIPs[0].adressen.length, 2, 'Karte mit zwei IPv4 behält beide');
  const ohneCidr = listeKarten({ 'X': [{ ...v4('10.1.2.3', ''), cidr: null, netmask: '255.255.0.0' }] });
  gleich(ohneCidr[0].adressen[0].praefix, 16, 'Präfix aus Netzmaske, wenn cidr fehlt');

  abschnitt('Adresswahl: Subnetz');
  pruefe(imSubnetz('10.0.0.7', { adresse: '10.0.0.110', praefix: 24 }), '10.0.0.7 in 10.0.0.110/24');
  pruefe(!imSubnetz('10.0.1.7', { adresse: '10.0.0.110', praefix: 24 }), '10.0.1.7 nicht in /24');
  pruefe(imSubnetz('172.20.70.9', { adresse: '172.20.64.1', praefix: 20 }), '/20 über Oktettgrenze');
  pruefe(!imSubnetz('kein.ip', { adresse: '10.0.0.1', praefix: 24 }), 'keine IP → false');

  abschnitt('Adresswahl: wirksame Karten');
  gleich(wirksameKarten(karten, null).karteFehlt, false, 'Automatisch → alle, nichts fehlt');
  gleich(wirksameKarten(karten, 'Ethernet 2').karten.map((k) => k.name), ['Ethernet 2'], 'gewählte Karte allein');
  const fehlt = wirksameKarten(karten, 'USB-LAN');
  pruefe(fehlt.karteFehlt && fehlt.karten.length === karten.length, 'gewählte Karte fehlt → alle + karteFehlt (Automatisch)');

  abschnitt('Adresswahl: Kandidaten (#234)');
  // Master annonciert (Reihenfolge wie aus mDNS): Hyper-V zuerst — genau der #234-Fall.
  const master = ['172.20.64.9', '100.64.0.9', '10.0.0.50', '169.254.3.3', '10.0.0.50', '::1', '127.0.0.1'];
  gleich(ordneKandidaten(master, karten, null), ['10.0.0.50', '172.20.64.9', '100.64.0.9', '169.254.3.3'],
    'LAN vor virtuellen Netzen (dort Fund-Reihenfolge), 169.254 zuletzt, entdoppelt, ohne IPv6/Loopback');
  gleich(ordneKandidaten(master, karten, 'vEthernet (Default Switch)')[0], '172.20.64.9', 'gewählte Karte zieht ihr Subnetz nach vorn');
  gleich(ordneKandidaten(['169.254.9.9'], listeKarten({ 'WLAN': [v4('169.254.1.1', '169.254.1.1/16')] }), null), ['169.254.9.9'],
    'nur 169.254 auf beiden Seiten → wird trotzdem versucht (kein DHCP)');
  gleich(ordneKandidaten(['192.168.10.9', '10.0.0.9'], zweiIPs, 'Ethernet'), ['192.168.10.9', '10.0.0.9'],
    'Karte mit zwei IPv4: beide Präfixe zählen, Fund-Reihenfolge bleibt');
  // Spec 11.1 Nr. 6 „zwei echte Karten“: LAN + WLAN, beide nicht virtuell, beide mit DHCP-Adresse (Rangfolge 4.4).
  const zweiKarten = listeKarten({ 'Ethernet 2': [v4('10.0.0.110', '10.0.0.110/24')], 'WLAN': [v4('192.168.1.20', '192.168.1.20/24')] });
  pruefe(zweiKarten.every((k) => !k.virtuell && !k.nurLinkLocal), 'zwei echte Karten: keine virtuell, keine nur Link-Local');
  const zweiNetze = ['172.16.0.9', '192.168.1.9', '10.0.0.9'];
  gleich(ordneKandidaten(zweiNetze, zweiKarten, null), ['192.168.1.9', '10.0.0.9', '172.16.0.9'],
    'zwei echte Karten, Automatisch: beide eigenen Subnetze (Rang 2, untereinander Fund-Reihenfolge) vor dem Rest');
  gleich(ordneKandidaten(zweiNetze, zweiKarten, 'Ethernet 2'), ['10.0.0.9', '192.168.1.9', '172.16.0.9'],
    'zwei echte Karten, LAN gewählt: LAN (Rang 1), dann die zweite echte Karte (Rang 2), dann der Rest');

  const quelle = {
    rolle: 'slave' as const, mdns: ['10.0.0.50'], letzteAdresse: '10.0.0.51', adressen: ['10.0.0.50', '10.0.0.52'],
    festeAdresse: '192.168.99.1', karten, gewaehlteKarte: null,
  };
  gleich(kandidatenliste(quelle), ['10.0.0.50', '10.0.0.51', '10.0.0.52', '192.168.99.1'],
    'Reihenfolge mDNS → zuletzt → Datei → feste Adresse, entdoppelt');
  gleich(kandidatenliste({ ...quelle, rolle: 'master' }), ['127.0.0.1'], 'Master-Rechner: nur 127.0.0.1');
  gleich(kandidatenliste({ ...quelle, mdns: [], letzteAdresse: null, adressen: ['127.0.0.1'], festeAdresse: null }), ['127.0.0.1'],
    'Adresse aus der Datei darf Loopback sein (Tests, Selbstkopplung)');
}
