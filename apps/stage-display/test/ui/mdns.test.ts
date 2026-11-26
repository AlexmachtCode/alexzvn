// Altfehler Stufe 2, SD-3 (C5): Die mDNS-Suche übernimmt einen gefundenen Host nur, solange die Quelle auf der Vorgabe 127.0.0.1
// steht. Ein eingetragener oder schon gefundener Host bleibt stehen, auch wenn er gerade nicht verbunden ist. Reines Modul
// (src/shared/mdns.ts, ohne electron und ohne @jm/discovery); die Filter von heute bleiben: Timer und Presenter nur der Dienst ohne
// Steuer-Marke (!ctl), der Switcher auch mit Marke. Dazu der Wächter, dass onDiscovered im Main das Modul nutzt.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { StageConfig } from '@shared/types';
import { DEFAULT_CONFIG } from '@shared/konfig-regeln';
import { mdnsUebernahme, VORGABE_HOST } from '@shared/mdns';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { ohneKommentare } from './testzustand';

type Quelle = 'timer' | 'switcher' | 'presenter';
const QUELLEN: readonly Quelle[] = ['timer', 'switcher', 'presenter'];
const keineVerbunden = { timer: false, switcher: false, presenter: false };
/** Konfiguration mit einer Quelle in diesem Zustand, die anderen aus auf der Vorgabe. */
function cfgMit(q: Quelle, teil: { enabled: boolean; host: string }): StageConfig {
  return { ...DEFAULT_CONFIG, [q]: { ...DEFAULT_CONFIG[q], ...teil } };
}

gleich(VORGABE_HOST, '127.0.0.1', 'SD-3 VORGABE_HOST: die Vorgabe der drei Quellen ist 127.0.0.1');

// ── Die Beispiele des Plans (Timer) ──
{
  const dienst = [{ role: 'timer', host: '10.0.0.9', port: 7777 }];
  gleich(mdnsUebernahme(cfgMit('timer', { enabled: true, host: '10.0.0.4' }), keineVerbunden, dienst), {}, 'SD-3 Timer an, eingetragener Host 10.0.0.4, nicht verbunden, Fund 10.0.0.9:7777 → nichts (der Host bleibt)');
  gleich(
    mdnsUebernahme(cfgMit('timer', { enabled: true, host: '127.0.0.1' }), keineVerbunden, dienst),
    { timer: { host: '10.0.0.9', port: 7777 } },
    'SD-3 Timer an, Host auf der Vorgabe 127.0.0.1, nicht verbunden → der Fund wird übernommen',
  );
  gleich(mdnsUebernahme(cfgMit('timer', { enabled: true, host: '127.0.0.1' }), { ...keineVerbunden, timer: true }, dienst), {}, 'SD-3 Timer verbunden → nichts');
  gleich(mdnsUebernahme(cfgMit('timer', { enabled: false, host: '127.0.0.1' }), keineVerbunden, dienst), {}, 'SD-3 Timer aus → nichts');
}

// ── Kreuzprodukt je Quelle: Host (Vorgabe/eingerichtet) × an × verbunden ──
for (const q of QUELLEN) {
  const faelle = kreuz({ host: [VORGABE_HOST, '10.0.0.4'], an: [false, true], verbunden: [false, true] } as const);
  pruefeFaelle(`SD-3 mDNS ${q}: übernommen nur bei an, nicht verbunden und Host auf der Vorgabe`, faelle, (f) => {
    const patch = mdnsUebernahme(cfgMit(q, { enabled: f.an, host: f.host }), { ...keineVerbunden, [q]: f.verbunden }, [{ role: q, host: '10.0.0.9', port: 4242 }]);
    const soll = f.an && !f.verbunden && f.host === VORGABE_HOST ? { [q]: { host: '10.0.0.9', port: 4242 } } : {};
    return vergleiche(JSON.stringify(patch), JSON.stringify(soll));
  });
}

// ── Die Filter von heute: Steuer-Marke, Rolle, gleicher Host ──
{
  const an = (q: Quelle): StageConfig => cfgMit(q, { enabled: true, host: VORGABE_HOST });
  gleich(mdnsUebernahme(an('timer'), keineVerbunden, [{ role: 'timer', host: '10.0.0.9', port: 7778, ctl: true }]), {}, 'SD-3 Timer: der Steuer-Dienst (ctl) wird nicht übernommen');
  gleich(
    mdnsUebernahme(an('timer'), keineVerbunden, [{ role: 'timer', host: '10.0.0.9', port: 7778, ctl: true }, { role: 'timer', host: '10.0.0.9', port: 7777 }]),
    { timer: { host: '10.0.0.9', port: 7777 } },
    'SD-3 Timer: von zwei Diensten gilt der ohne Steuer-Marke',
  );
  gleich(mdnsUebernahme(an('presenter'), keineVerbunden, [{ role: 'presenter', host: '10.0.0.8', port: 7331, ctl: true }]), {}, 'SD-3 Presenter: der Steuer-Dienst (ctl) wird nicht übernommen');
  gleich(
    mdnsUebernahme(an('switcher'), keineVerbunden, [{ role: 'switcher', host: '10.0.0.7', port: 8723, ctl: true }]),
    { switcher: { host: '10.0.0.7', port: 8723 } },
    'SD-3 Switcher: sein Dienst mit Steuer-Marke wird übernommen (sein einziger Dienst ist der Steuerserver)',
  );
  gleich(mdnsUebernahme(an('timer'), keineVerbunden, [{ role: 'presenter', host: '10.0.0.8', port: 7330 }]), {}, 'SD-3: ein Dienst einer anderen Rolle ändert die Quelle nicht');
  gleich(mdnsUebernahme(an('timer'), keineVerbunden, [{ role: 'timer', host: VORGABE_HOST, port: 7790 }]), {}, 'SD-3: ein Fund auf demselben Host wie eingetragen ändert nichts (wie bisher)');
  gleich(mdnsUebernahme(an('timer'), keineVerbunden, []), {}, 'SD-3: ohne Fund nichts');
}

// ── Mehrere Quellen zugleich: jede nach ihrem eigenen Zustand ──
{
  const cfg: StageConfig = {
    ...DEFAULT_CONFIG,
    timer: { enabled: true, host: VORGABE_HOST, port: 7777 },
    switcher: { enabled: true, host: '10.0.0.4', port: 8723 },
    presenter: { ...DEFAULT_CONFIG.presenter, enabled: true, host: VORGABE_HOST, pin: '' },
  };
  const dienste = [
    { role: 'timer', host: '10.0.0.9', port: 7777 },
    { role: 'switcher', host: '10.0.0.9', port: 8723 },
    { role: 'presenter', host: '10.0.0.9', port: 7330 },
  ];
  gleich(
    mdnsUebernahme(cfg, { timer: false, switcher: false, presenter: true }, dienste),
    { timer: { host: '10.0.0.9', port: 7777 } },
    'SD-3 drei Quellen: Timer auf der Vorgabe übernimmt, Switcher mit eingetragenem Host bleibt, Presenter ist verbunden und bleibt',
  );
}

// ── Wächter: onDiscovered im Main ruft mdnsUebernahme mit den gemessenen Verbindungen und vergleicht nicht mehr selbst ──
{
  const main = ohneKommentare(leseText('src/main/index.ts'));
  const rumpf = main.slice(main.indexOf('function onDiscovered('), main.indexOf('function resourcePath('));
  ok(
    rumpf.includes('mdnsUebernahme(getConfig(), { timer: lastTimer.connected, switcher: lastSwitcher.connected, presenter: lastPresenter.connected }, services)') &&
      !rumpf.includes('cfg.timer.host !== timer.host') &&
      !/\.host !== /.test(rumpf) &&
      /patchConfig\(patch\);\s*applyConnections\(\);\s*broadcast\(\);/.test(rumpf),
    'SD-3 Wächter: onDiscovered ruft mdnsUebernahme( und vergleicht keine Hosts mehr selbst; danach patchConfig, applyConnections, broadcast wie bisher',
  );
  const modul = ohneKommentare(leseText('src/shared/mdns.ts'));
  ok(!/from ['"](?:electron|node:|@jm\/discovery)/.test(modul), 'SD-3 Wächter: shared/mdns.ts ist rein (kein electron, kein node:, kein @jm/discovery)');
}
