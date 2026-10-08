// Task 1 · Werkzeug: Rendern unter tsx mit jsx react-jsx, Zeilenenden, ID-Verweise, Paket-Export der Testhilfe.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ueberPaket from '@jm/ui/testhilfe';
import { Badge } from '../src/components/Badge';
import { enthaelt, fehlendeIdVerweise, gleich, leseText, ok, render } from './harness';

{
  const html = render(<Badge tone="success">ok</Badge>);
  enthaelt(html, 'text-[var(--success)]', 'Werkzeug: Badge rendert unter tsx mit jsx react-jsx');
  enthaelt(html, '>ok</span>', 'Werkzeug: Inhalt der Badge steht im HTML');
}

{
  const ordner = mkdtempSync(join(tmpdir(), 'jm-ui-'));
  const datei = join(ordner, 'crlf.txt');
  writeFileSync(datei, 'a\r\nb\r\n');
  const text = leseText(datei);
  rmSync(ordner, { recursive: true, force: true });
  gleich(text, 'a\nb\n', 'Werkzeug: leseText normalisiert CRLF');
  ok(!leseText('src/lib/cn.ts').includes('\r'), 'Werkzeug: leseText liest relativ zum Paketordner (src/lib/cn.ts)');
}

{
  gleich(
    fehlendeIdVerweise('<input aria-describedby="x a"><p id="a"></p>'),
    ['x'],
    'Werkzeug: fehlendeIdVerweise findet fehlende id',
  );
  gleich(
    fehlendeIdVerweise('<input aria-describedby="x a"><p id="a"></p><p id="x"></p>'),
    [],
    'Werkzeug: fehlendeIdVerweise – alle ids vorhanden → leer',
  );
  gleich(
    fehlendeIdVerweise('<label for="f"></label><button aria-controls="p" aria-labelledby="l"></button><input id="f">'),
    ['p', 'l'],
    'Werkzeug: fehlendeIdVerweise prüft for, aria-controls und aria-labelledby',
  );
}

{
  ok(ueberPaket.ok === ok, 'Werkzeug: @jm/ui/testhilfe ist dieselbe Testhilfe (ein Zähler)');
}
