// Selbsttest der Worker-Routen und der Gast-Seite des Gast-Klickers (#317), ohne Cloudflare:
// die Durable-Object-Bindung ist eine Attrappe, die Anfrage und Rolle merkt.
//   node services/gast-klicker/test/worker.test.mjs
import worker, { KlickRaum } from '../worker.js';
import { gastSeiteHtml } from '../gast-seite.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

const aufrufe = [];
const env = {
  KLICK_RAUM: {
    jurisdiction(j) {
      aufrufe.push({ jurisdiction: j });
      return {
        idFromName(name) {
          aufrufe.push({ idFromName: name });
          return `id:${name}`;
        },
        get(id) {
          return {
            fetch(req) {
              aufrufe.push({ id, rolle: req.headers.get('x-rolle'), raum: req.headers.get('x-raum'), upgrade: req.headers.get('Upgrade') });
              return new Response('do', { status: 200 });
            },
          };
        },
      };
    },
  },
};

const BASIS = 'https://jm-gast-klicker.jm-production-suite.workers.dev';
const RAUM = 'abcdefghij12';
const hole = (pfad, init = {}) => worker.fetch(new Request(BASIS + pfad, init), env);

check('KlickRaum wird exportiert', typeof KlickRaum === 'function');

{
  const r = await hole(`/k/${RAUM}`);
  const csp = r.headers.get('content-security-policy') ?? '';
  const body = await r.text();
  check('Gast-Seite 200', r.status === 200);
  check('Gast-Seite text/html', (r.headers.get('content-type') ?? '').startsWith('text/html'));
  check('Gast-Seite no-store', r.headers.get('cache-control') === 'no-store');
  check('Gast-Seite nosniff + no-referrer', r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('referrer-policy') === 'no-referrer');
  check('CSP default-src none', csp.includes("default-src 'none'"));
  check('CSP connect-src wss + Host', csp.includes('connect-src wss://jm-gast-klicker.jm-production-suite.workers.dev'));
  check('CSP img-src blob:', csp.includes('img-src blob:'));
  check('CSP frame-ancestors none', csp.includes("frame-ancestors 'none'"));
  check('Seite hat Knöpfe weiter/zurück', body.includes('id="weiter"') && body.includes('id="zurueck"'));
  check('Seite hat Bild, Position, Status', body.includes('id="bild"') && body.includes('id="pos"') && body.includes('id="status"'));
  check('Seite kennt den Raum', body.includes(RAUM));
  check('Seite lädt nichts von außen', !/\b(src|href)=["']https?:/i.test(body));
  const skripte = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let parst = skripte.length === 1;
  try {
    for (const s of skripte) new Function(s);
  } catch {
    parst = false;
  }
  check('Inline-Skript parst', parst);
}

check('gastSeiteHtml baut den Raum ein', gastSeiteHtml(RAUM).includes(`"${RAUM}"`));
check('gastSeiteHtml lehnt kaputten Raum ab', (() => {
  try {
    gastSeiteHtml('</script><b>');
    return false;
  } catch {
    return true;
  }
})());

for (const [pfad, init, name] of [
  ['/k/ABCDEFGHIJ12', {}, 'Großbuchstaben'],
  ['/k/abc', {}, 'zu kurz'],
  ['/x', {}, 'anderer Pfad'],
  ['/', {}, 'Wurzel'],
  [`/k/${RAUM}`, { method: 'POST' }, 'POST'],
  [`/k/${RAUM}/ws/x`, {}, 'zu langer Pfad'],
  [`/h/${RAUM}`, {}, 'Presenter-Pfad ohne ws'],
]) {
  const r = await hole(pfad, init);
  check(`404: ${name}`, r.status === 404);
}

{
  aufrufe.length = 0;
  const r = await hole(`/k/${RAUM}/ws`);
  check('Gast-ws ohne Upgrade → 426', r.status === 426 && aufrufe.length === 0);
  const r2 = await hole(`/h/${RAUM}/ws`);
  check('Presenter-ws ohne Upgrade → 426', r2.status === 426 && aufrufe.length === 0);
}

{
  aufrufe.length = 0;
  const r = await hole(`/k/${RAUM}/ws`, { headers: { Upgrade: 'websocket' } });
  const ziel = aufrufe.find((a) => a.rolle !== undefined);
  check('Gast-ws erreicht den DO', r.status === 200 && ziel?.rolle === 'gast' && ziel?.id === `id:${RAUM}`);
  check('DO in EU-Jurisdiction', aufrufe.some((a) => a.jurisdiction === 'eu'));
  aufrufe.length = 0;
  await hole(`/h/${RAUM}/ws`, { headers: { Upgrade: 'websocket' } });
  const pz = aufrufe.find((a) => a.rolle !== undefined);
  check('Presenter-ws erreicht den DO als presenter', pz?.rolle === 'presenter');
  check('Presenter-ws trägt die Raum-Kennung (x-raum)', pz?.raum === RAUM);
  aufrufe.length = 0;
  await hole(`/k/${RAUM}/ws`, { headers: { Upgrade: 'websocket', 'x-rolle': 'presenter', 'x-raum': 'zzzzzzzzzzzz' } });
  const gz = aufrufe.find((a) => a.rolle !== undefined);
  check('fremder x-rolle-Header wird überschrieben', gz?.rolle === 'gast');
  check('fremder x-raum-Header wird überschrieben', gz?.raum === RAUM);
}

console.log(`worker: ${passed} ok, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
