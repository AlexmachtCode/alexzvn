# Herkunft und Lizenz der Ansagen

Die Ansagen der geführten Anleitungen (Stimme, die die Sprechblasen vorliest) entstehen beim Bau am Rechner des
Controllers mit Piper und ffmpeg aus den Texten der Anleitung. In diesem Ordner liegen nur das Ergebnis und die Belege:
die Ansagen als `.ogg` (Opus in Ogg, 24 kbit/s, mono), `manifest.json` (Stimme, Werkzeug, Parameter und je Ansage die
Prüfsumme des Textes und der Datei) und diese Datei. Erzeugt werden sie mit `npm run stimme:erzeugen -w @jm/launcher`
(`apps/launcher/scripts/anleitung-stimme.mjs`), geprüft ohne Piper mit dem Launcher-Selbsttest. Spec 6 verlangt, die
Lizenz vor dem Plan zu prüfen und im Repo zu vermerken; das ist dieser Vermerk. Lesarten zu Lizenzen sind keine
Rechtsberatung. Jede zitierte Lizenz und jedes Etikett hat seine Quelle unten (abgerufen am 19.10.2026, wo nicht anders
vermerkt).

## Gewählte Stimme

Owner-Entscheidung OFP1 vom 20.10.2026: ohne Ton. Der Launcher erscheint ohne Stimme, `manifest.json` bleibt ohne Stimme,
und die Kapitelübersicht zeigt „In dieser Fassung gibt es keine Stimme.“. Die Stimme folgt später.

Vorgabe des Plans: `de_DE-mls-medium`, Sprecher nach Hörprobe, `--length-scale 1.05`, `--sentence-silence 0.3`.
`de_DE-thorsten-medium` nur, wenn der Owner das unten beschriebene Restrisiko ausdrücklich annimmt. Klingt keine Stimme gut
genug, erscheint der Launcher ohne Ton, und die Stimme folgt später.

## Kandidat 1: `de_DE-mls-medium` (Vorgabe)

- Bezug: `https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/mls/medium`, Dateien `de_DE-mls-medium.onnx`,
  `de_DE-mls-medium.onnx.json`, `MODEL_CARD`.
- `.onnx`: 76 961 079 Bytes, SHA-256 `69cd1d2aa5a35839a518966fcc4924b5f93e5f8c948ed0752b1a616ad53f65bf` (Blob-Seite und
  LFS-Zeiger gleich). Der Pin steht in `apps/launcher/scripts/stimme-manifest.mjs` (`STIMMEN`); der Erzeuger bricht ab,
  wenn die Datei nicht dazu passt.
- Modellkarte wörtlich: „License: CC-BY 4.0“, „Trained from scratch“, „Speakers: 236“. Qualität medium, 22 050 Hz.
- Datensatz: Multilingual LibriSpeech (MLS, OpenSLR 94), Lizenz „CC BY 4.0“, „derived from read audiobooks from
  LibriVox“.
- Bewertung: sauber nach Urheberrecht und Lizenz, von Grund auf trainiert, gewerbliche Nutzung erlaubt. Verlangt
  Namensnennung mit Verweis auf das Modell (CC BY 4.0 §3(a)(1)).
- Nicht geprüft: Mit `--sprecher` klingt jede Ansage nach einem der 236 realen Sprecher der LibriVox-Hörbücher. Ob dessen
  Stimm- oder Persönlichkeitsrecht berührt ist, deckt keine Lizenz und keine Quelle hier ab (Lesart, keine
  Rechtsberatung). Der Owner entscheidet das bei der Hörprobe mit (OFP1).
- Namensnennung (steht auch im Manifest unter `stimme.namensnennung` und in der Kapitelübersicht unter dem
  Stimmen-Schalter):

  Stimme „de_DE-mls-medium“ aus rhasspy/piper-voices (huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/mls/medium), trainiert mit Multilingual LibriSpeech (Pratap u. a. 2020, Hörbücher von LibriVox), Lizenz CC BY 4.0 (creativecommons.org/licenses/by/4.0). Die Ansagen sind damit erzeugt.

## Kandidat 2: `de_DE-thorsten-medium` (nur mit ausdrücklicher Owner-Zusage)

- Bezug: `https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/thorsten/medium`.
- `.onnx`: 63 201 294 Bytes, SHA-256 `7e64762d8e5118bb578f2eea6207e1a35a8e0c30595010b666f983fc87bb7819` (Blob-Seite und
  LFS-Zeiger gleich; Thorsten Müllers eigene Kopie `huggingface.co/Thorsten-Voice/Piper` hat dieselbe Prüfsumme).
- Etikett, wörtlich: Modellkarte „License: CC0“; `rhasspy/piper-voices` und `Thorsten-Voice/Piper` tragen im README-Kopf
  „license: mit“. Datensatz `Thorsten-Voice/TV-44kHz-Full`: Lizenz „cc0-1.0“. CC0 1.0 §2: „for any purpose whatsoever,
  including without limitation commercial, advertising or promotional purposes“.
- Herkunft der Gewichte, wörtlich: Modellkarte „Finetuned from U.S. English lessac voice (medium quality).“ Die
  Lessac-Lizenz (Blizzard 2013): „The User wishes to make use of the Materials for Research Purposes only.“ Ausgeschlossen
  ist die Nutzung „for any commercial purpose, including the development, marketing, commercialisation, sale or licencing
  of voice synthesis or speech recognition products“.
- Der Piper-Maintainer dazu (HF-Diskussion #94): „This is something that I don't think has been tested yet legally, so
  I'm not sure what the answer is.“ Man werde „slowly be re-training many of the Piper voices so that they can at least be
  used for commercial purposes.“ Eine neu trainierte deutsche Stimme gibt es noch nicht.
- Bewertung: Nach dem Etikett ja, nach der Herkunft ungeklärt. Ob die Forschungslizenz der Basis auf feinjustierte Gewichte
  und deren Ausgabe durchschlägt, sagt keine Quelle. Das ist eine Entscheidung des Owners (Restrisiko), keine des Plans.
- Namensnennung (CC0 verlangt keine; Thorsten Müller bittet um Nennung):

  Stimme „de_DE-thorsten-medium“ aus rhasspy/piper-voices, Datensatz Thorsten-Voice von Thorsten Müller (CC0). Die Ansagen sind damit erzeugt.

## Ausgeschieden

- `de_DE-karlsson-low`, `de_DE-kerstin-low`: „Finetuned from U.S. English Ryan voice“, Ryan steht unter „CC BY-NC-SA 4.0“
  (nicht gewerblich).
- `de_DE-pavoque-low`: Lizenz „by-nc-sa/4.0“ (nicht gewerblich).
- `de_DE-ramona-low`, `de_DE-eva_k-x_low`: „License: See URL“ (M-AILABS), die Quelle war nicht erreichbar; Lizenz unklar.
- `de_DE-thorsten-low` („Finetuned from U.S. English Ryan voice“) und `de_DE-thorsten-high` (wie medium von lessac).

## Werkzeuge: nur beim Bau, nie mitgeliefert

| Werkzeug | Fassung | Lizenz |
| --- | --- | --- |
| Piper (`piper-tts`, OHF-Voice/piper1-gpl) | 1.8.0, Python-venv außerhalb des Repos | GPL-3.0-or-later |
| espeak-ng (in Piper eingebaut) | mit Piper | „GPL version 3 or later“ |
| onnxruntime | mit Piper | MIT |
| ffmpeg | 8.1.2 (Build gyan.dev, mit libopus) | GPL-Build |

Piper, espeak-ng, onnxruntime, die Python-Umgebung, die Stimme (`.onnx`, `.onnx.json`) und die WAV-Zwischendateien liegen
nur am Rechner des Controllers. Sie kommen weder ins Repo noch in den Installer noch in die CI. Das Skript ruft Piper nur
über die Kommandozeile auf (kein `import piper`).

Lesart (keine Rechtsberatung): GPLv3 §2 „You may make, run and propagate covered works that you do not convey, without
conditions so long as your license otherwise remains in force.“ und „The output from running a covered work is covered by
this License only if the output, given its content, constitutes a covered work.“ GPL-FAQ: „The output of a program is not,
in general, covered by the copyright on the code of the program.“ und zur Kommandozeile: „pipes, sockets and command-line
arguments are communication mechanisms normally used“ „between two separate programs.“ Die Ansagen sind Ausgabe ohne
Programmcode; Piper wird nicht weitergegeben. Damit greifen für die Suite keine GPL-Pflichten.

## Quellen (abgerufen am 19.10.2026, wo nicht anders vermerkt)

- Modellkarten: `huggingface.co/rhasspy/piper-voices/raw/main/de/de_DE/mls/medium/MODEL_CARD`,
  `…/de_DE/thorsten/medium/MODEL_CARD`, `…/en/en_US/lessac/medium/MODEL_CARD`, `…/en/en_US/ryan/low/MODEL_CARD`
- README-Kopf „license: mit“: `huggingface.co/rhasspy/piper-voices/raw/main/README.md`
- MLS: `www.openslr.org/94/`
- Lessac-Lizenz: `www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html`
- Maintainer: `huggingface.co/rhasspy/piper-voices/discussions/94`, `github.com/rhasspy/piper/issues/271`
- Thorsten-Voice: `huggingface.co/Thorsten-Voice/Piper`, `huggingface.co/datasets/Thorsten-Voice/TV-44kHz-Full`
- CC0 1.0, §2: `creativecommons.org/publicdomain/zero/1.0/legalcode.en`
- CC BY 4.0, §3(a)(1) (Namensnennung): `creativecommons.org/licenses/by/4.0/legalcode` (nicht abgerufen; der Controller
  liest den Text vor der Erzeugung gegen diesen Vermerk)
- Piper: `github.com/OHF-Voice/piper1-gpl`, `pypi.org/project/piper-tts/1.8.0/`
- espeak-ng, „GPL version 3 or later“: `raw.githubusercontent.com/espeak-ng/espeak-ng/master/README.md`
- onnxruntime 1.31.0, „MIT License“: `pypi.org/project/onnxruntime/1.31.0/`
- GPL: `www.gnu.org/licenses/gpl-3.0.html`, `www.gnu.org/licenses/gpl-faq.html`
