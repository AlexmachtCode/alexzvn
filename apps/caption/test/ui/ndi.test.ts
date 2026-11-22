// UX Welle 2a, Caption b · NDI-Lage (E8): Wachhund auf den Statusmeldungen des Senders, Zuordnung zum laufenden Lauf
// (späte Ereignisse eines alten Unterprozesses wirken nie auf den neuen Sender) und Quelltext-Wächter der Verdrahtung.
// Kein Electron, kein window beim Import; die Uhr ist eine Attrappe.
import { leseText, ok } from '@jm/ui/testhilfe';
import { NDI_STILLE_MS, NdiLage, NdiWachhund } from '../../src/main/ndi/wachhund';

interface Zeitgeber {
  uhr: { setTimeout: (f: () => void, ms: number) => unknown; clearTimeout: (h: unknown) => void };
  weiter: (ms: number) => void;
  offen: () => number;
}
function attrappenUhr(): Zeitgeber {
  let jetzt = 0;
  let naechste = 1;
  const timer = new Map<number, { an: number; f: () => void }>();
  return {
    uhr: {
      setTimeout: (f, ms) => {
        const id = naechste++;
        timer.set(id, { an: jetzt + ms, f });
        return id;
      },
      clearTimeout: (h) => void timer.delete(h as number),
    },
    weiter: (ms) => {
      const ziel = jetzt + ms;
      for (;;) {
        const faellig = [...timer.entries()].filter(([, t]) => t.an <= ziel).sort((a, b) => a[1].an - b[1].an)[0];
        if (!faellig) break;
        timer.delete(faellig[0]);
        jetzt = faellig[1].an;
        faellig[1].f();
      }
      jetzt = ziel;
    },
    offen: () => timer.size,
  };
}

// ── CA NDI-Wachhund ──
{
  ok(NDI_STILLE_MS === 3000, 'CA NDI-Wachhund: NDI_STILLE_MS ist 3000');
  const z = attrappenUhr();
  let still = 0;
  const w = new NdiWachhund(3000, () => void still++, z.uhr);
  ok(!w.sendet, 'CA NDI-Wachhund: vor der ersten Meldung sendet nichts');
  w.meldung();
  ok(w.sendet, 'CA NDI-Wachhund: meldung() setzt „sendet“');
  z.weiter(2999);
  ok(w.sendet && still === 0, 'CA NDI-Wachhund: nach 2999 ms ohne Meldung ist noch nichts still');
  w.meldung();
  z.weiter(2999);
  ok(w.sendet && still === 0, 'CA NDI-Wachhund: eine neue Meldung setzt die Frist neu');
  z.weiter(1);
  ok(!w.sendet && still === 1, 'CA NDI-Wachhund: 3000 ms ohne Meldung rufen onStill einmal, „sendet“ fällt');
  z.weiter(10000);
  ok(still === 1, 'CA NDI-Wachhund: onStill kommt je Stille genau einmal');
  w.meldung();
  ok(w.sendet, 'CA NDI-Wachhund: eine Meldung nach der Stille schaltet wieder auf „sendet“');
  z.weiter(3000);
  ok(still === 2 && !w.sendet, 'CA NDI-Wachhund: die nächste Stille ruft onStill ein zweites Mal');
  w.meldung();
  w.stop();
  z.weiter(10000);
  ok(still === 2 && !w.sendet && z.offen() === 0, 'CA NDI-Wachhund: stop() ruft nichts mehr und lässt keinen Zeitgeber stehen');
}
{
  const z = attrappenUhr();
  const w = new NdiWachhund(3000, () => {}, z.uhr);
  w.stop();
  w.stop();
  ok(!w.sendet && z.offen() === 0, 'CA NDI-Wachhund: stop() ohne Meldung ist folgenlos, auch doppelt');
}

// ── CA NDI-Lage: Ablauf und späte Ereignisse eines alten Unterprozesses ──
{
  const z = attrappenUhr();
  const l = new NdiLage(() => {}, z.uhr);
  ok(!l.sendet && l.netzName === null, 'CA NDI-Lage: vor dem Start sendet nichts, kein Netzname');
  const a = l.starte('Quelle A');
  ok(!l.sendet && l.netzName === 'Quelle A', 'CA NDI-Lage: starte merkt den Netznamen, „sendet“ erst mit der ersten Statusmeldung');
  ok(l.stat(a) && l.sendet, 'CA NDI-Lage: Statusmeldung des laufenden Senders setzt „sendet“');
  z.weiter(3000);
  ok(!l.sendet && l.netzName === 'Quelle A', 'CA NDI-Lage: 3000 ms Stille nehmen „sendet“ zurück, der Netzname bleibt (Sender läuft)');
  ok(l.stat(a) && l.sendet, 'CA NDI-Lage: die nächste Statusmeldung schaltet wieder auf „sendet“');
  l.stoppe();
  ok(!l.sendet && l.netzName === null && z.offen() === 0, 'CA NDI-Lage: stoppe nimmt „sendet“ und Netznamen zurück und räumt den Wachhund ab');
}
{
  // Start → Stopp → Start → späte Meldungen des ersten Prozesses
  const z = attrappenUhr();
  let aenderungen = 0;
  const l = new NdiLage(() => void aenderungen++, z.uhr);
  const a = l.starte('A');
  l.stat(a);
  z.weiter(1000);
  l.stoppe();
  const b = l.starte('B');
  ok(a !== b, 'CA NDI-Lage: jeder Start bekommt eine eigene Lauf-Kennung');
  ok(!l.sendet && l.netzName === 'B', 'CA NDI-Lage: nach Stopp und Start meldet der neue Lauf noch nichts');
  const vorher = aenderungen;
  ok(!l.stat(a), 'CA NDI-Lage: späte Statusmeldung des ersten Prozesses wird verworfen');
  ok(!l.sendet && aenderungen === vorher, 'CA NDI-Lage: sie setzt „sendet“ des neuen Senders nicht und meldet keine Änderung');
  ok(!l.ende(a) && l.netzName === 'B', 'CA NDI-Lage: spätes exit des ersten Prozesses nimmt dem neuen Sender nichts');
  l.stat(b);
  ok(l.sendet, 'CA NDI-Lage: der neue Sender setzt „sendet“ mit seiner eigenen Meldung');
  // Der Wachhund des ersten Laufs wäre bei 1000 + 3000 fällig gewesen; der des zweiten gilt ab jetzt.
  z.weiter(2999);
  ok(l.sendet, 'CA NDI-Lage: der Wachhund des alten Laufs feuert nicht für den neuen');
  ok(!l.ende(a) && l.sendet, 'CA NDI-Lage: auch ein spätes exit mitten im Lauf des neuen Senders wirkt nicht');
  z.weiter(1);
  ok(!l.sendet, 'CA NDI-Lage: die eigene Stille des neuen Laufs nimmt „sendet“ nach 3000 ms zurück');
}
{
  // Start → Start ohne Stopp dazwischen (startSender beendet den alten Prozess selbst)
  const z = attrappenUhr();
  const l = new NdiLage(() => {}, z.uhr);
  const a = l.starte('A');
  const b = l.starte('B');
  ok(!l.stat(a) && !l.sendet, 'CA NDI-Lage: Meldung des abgelösten Laufs nach direktem Neustart wird verworfen');
  ok(l.stat(b) && l.sendet && l.netzName === 'B', 'CA NDI-Lage: der neue Lauf gilt');
}
{
  // exit des laufenden Senders (Absturz): ndiActive muss zurück → ende meldet true
  const z = attrappenUhr();
  const l = new NdiLage(() => {}, z.uhr);
  const a = l.starte('A');
  l.stat(a);
  ok(l.ende(a), 'CA NDI-Lage: exit des laufenden Senders gilt (ende meldet true)');
  ok(!l.sendet && l.netzName === null && z.offen() === 0, 'CA NDI-Lage: nach exit sendet nichts mehr, kein Netzname, kein Wachhund');
  ok(!l.stat(a) && !l.sendet, 'CA NDI-Lage: eine Meldung nach dem exit desselben Laufs wird verworfen');
  ok(!l.ende(a), 'CA NDI-Lage: ein zweites exit desselben Laufs zählt nicht');
}

// ── CA Wächter Sender-Ende ──
{
  const sp = leseText('src/main/ndi/sender-process.ts');
  const idx = leseText('src/main/index.ts');
  const typen = leseText('src/shared/types.ts');
  ok(/onEnde\?: \(\) => void,?\s*\): void \{/.test(sp), 'CA Wächter Sender-Ende: startSender nimmt als vierten Parameter onEnde');
  ok(/proc\.on\('exit', \(\) => \{[\s\S]*?child !== proc\) return;[\s\S]*?onEnde\?\.\(\)/.test(sp), 'CA Wächter Sender-Ende: sender-process hat einen exit-Hörer, der nur beim aktuellen Prozess onEnde ruft');
  ok(/proc\.on\('message'[\s\S]*?child !== proc\) return;[\s\S]*?onStat\?\.\(/.test(sp), 'CA Wächter Sender-Ende: Statusmeldungen eines alten Prozesses erreichen onStat nicht');
  ok(/proc\.on\('exit'[\s\S]*?child = null;[\s\S]*?onEnde/.test(sp), 'CA Wächter Sender-Ende: nach dem exit ist senderActive() false (child auf null)');
  ok(/function stopNdi\(\): void \{\s*stopSender\(\);\s*ndiLage\.stoppe\(\);\s*status\.ndiActive = false;\s*status\.connections = 0;\s*broadcast\(\);\s*\}/.test(idx), 'CA Wächter Sender-Ende: stopNdi nimmt ndiSendet (ndiLage.stoppe) zurück, ndiActive und connections wie bisher');
  ok(/const lauf = ndiLage\.starte\(/.test(idx) && /ndiLage\.stat\(lauf\)/.test(idx) && /ndiLage\.ende\(lauf\)/.test(idx), 'CA Wächter Sender-Ende: startNdi setzt den Netznamen (starte), Statusmeldung und exit gehen mit der Lauf-Kennung durch die Lage');
  ok(/if \(!ndiLage\.ende\(lauf\)\) return;[\s\S]*?status\.ndiActive = false;/.test(idx), 'CA Wächter Sender-Ende: das Ende des laufenden Prozesses nimmt ndiActive zurück');
  ok(/status\.ndiActive = true;\s*status\.connections = 0;/.test(idx), 'CA Wächter Sender-Ende: ndiActive bei Start unverändert');
  ok(/new NdiLage\(/.test(idx) && idx.includes("from './ndi/wachhund'"), 'CA Wächter Sender-Ende: index.ts nutzt die NDI-Lage');
  ok(typen.includes('ndiSendet: boolean;') && typen.includes('ndiNetzName: string | null;'), 'CA Wächter Sender-Ende: CaptionStatus hat ndiSendet und ndiNetzName');
  ok(/const status: CaptionStatus = \{ ndiActive: false, connections: 0, ndiSendet: false, ndiNetzName: null \};/.test(idx), 'CA Wächter Sender-Ende: Anfangsstatus sendet nicht und ohne Netznamen');
  ok(sp.includes('child?.postMessage(e.data);') && sp.includes("win.webContents.postMessage('jmcaption:frame-port', null, [port1]);"), 'CA Wächter Sender-Ende: Bildweg (Port, Weiterleitung an den Prozess) unverändert');
  ok(idx.includes('ndi: status.ndiActive,') && idx.includes('connections: status.connections,'), 'CA Wächter Sender-Ende: Companion-Werte ndi und connections unverändert');
}
