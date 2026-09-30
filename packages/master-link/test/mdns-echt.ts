// Echter mDNS-Durchlauf auf den Karten DIESES Rechners (nicht in der CI: dort gibt es kein Multicast).
import { networkInterfaces } from 'node:os';
import { randomUUID } from 'node:crypto';
import { listeKarten } from '../src/adresswahl';
import { MasterAnnonce, MdnsSuche, standardFabrik } from '../src/mdns';

const karten = listeKarten(networkInterfaces());
console.log('Karten:', karten.map((k) => `${k.name} ${k.adressen.map((a) => `${a.adresse}/${a.praefix}`).join(',')}`).join(' | '));
const log = (t: string): void => console.log(`  (mDNS) ${t}`);
const masterId = randomUUID();
const annonce = new MasterAnnonce(standardFabrik(log), { masterId, name: 'Selbsttest-Master', fp: 'ab'.repeat(32), port: 18738 });
annonce.starte(karten);
const suche = new MdnsSuche(standardFabrik(log));
suche.setzeKarten(karten);
await new Promise((r) => setTimeout(r, 500));
const sichtungen = await suche.runde(2000);
const meine = sichtungen.find((s) => s.masterId === masterId);
console.log(meine ? `gefunden: ${meine.name} ${meine.adressen.join(', ')}` : 'NICHT gefunden');
await annonce.stoppe();
suche.stoppe();
process.exit(meine ? 0 : 1);
