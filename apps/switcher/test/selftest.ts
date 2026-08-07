// Selbsttest der reinen Ausgabe-Qualitaetswerte (Lane D1).
//   npm run selftest -w @jm/switcher
import { RESOLUTIONS, recommendedBitrate } from '../src/shared/output-quality.ts';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

console.log('output-quality — Aufloesungen:');
assert(RESOLUTIONS['720p'].w === 1280 && RESOLUTIONS['720p'].h === 720, '720p ist 1280x720');
assert(RESOLUTIONS['1080p'].w === 1920 && RESOLUTIONS['1080p'].h === 1080, '1080p ist 1920x1080');

console.log('output-quality — empfohlene Bitraten:');
for (const kind of ['stream', 'record'] as const) {
  for (const res of ['720p', '1080p'] as const) {
    const r = recommendedBitrate(res, kind);
    assert(r.min > 0 && r.min < r.max, `${kind}/${res}: min > 0 und min < max`);
  }
}

// Relationen allein wuerden ein stilles Abrutschen (6000 -> 5000) nicht bemerken — die Spec
// nennt konkrete Zahlen, also pruefen wir konkrete Zahlen.
const EXPECTED: Record<'stream' | 'record', Record<'720p' | '1080p', { min: number; max: number }>> = {
  stream: { '720p': { min: 3000, max: 6000 }, '1080p': { min: 6000, max: 12000 } },
  record: { '720p': { min: 8000, max: 16000 }, '1080p': { min: 16000, max: 32000 } },
};
for (const kind of ['stream', 'record'] as const) {
  for (const res of ['720p', '1080p'] as const) {
    const got = recommendedBitrate(res, kind);
    const want = EXPECTED[kind][res];
    assert(
      got.min === want.min && got.max === want.max,
      `${kind}/${res}: genau ${want.min}-${want.max} kbit/s`,
    );
  }
}

// Full-HD hat rund die 2,25-fache Pixelzahl — die Empfehlung MUSS darueber liegen,
// sonst sieht 1080p bei unveraenderter Bitrate schlechter aus als 720p. Genau das
// war der Ausgangspunkt von Lane D1.
for (const kind of ['stream', 'record'] as const) {
  const hd = recommendedBitrate('720p', kind);
  const fhd = recommendedBitrate('1080p', kind);
  assert(fhd.min > hd.min, `${kind}: 1080p-Untergrenze liegt ueber 720p`);
  assert(fhd.max > hd.max, `${kind}: 1080p-Obergrenze liegt ueber 720p`);
}

// Aufnahme ist unkomprimierter gedacht als der Stream und liegt darum hoeher.
for (const res of ['720p', '1080p'] as const) {
  assert(
    recommendedBitrate(res, 'record').min > recommendedBitrate(res, 'stream').min,
    `${res}: Aufnahme empfiehlt mehr als der Stream`,
  );
}

if (failures) {
  console.error(`\n${failures} Selbsttest(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle @jm/switcher-Selbsttests gruen.');
