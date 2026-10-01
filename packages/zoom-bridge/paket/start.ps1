<#
  JM Zoom Bridge - Start-Skript (Einsatzpaket).

  Fragt Zugangsdaten-Datei, Modus, Meeting-Nummer, Kenncode, Anzeigename und
  Bild-Versatz ab, setzt damit die Umgebung und startet zoom-join.exe IM
  SELBEN FENSTER. Danach wird der Rueckgabewert in Klartext gedeutet.

  Gemerkt werden in %APPDATA%\JM Zoom Bridge\einstellungen.json NUR:
  Pfad der Zugangsdaten-Datei, Anzeigename, Bild-Versatz.
  NIE die Meeting-Nummer, NIE den Kenncode.

  -OhneFragen: fuer automatische Pruefungen. Fragt nichts, nimmt alle Werte
  aus den bereits gesetzten Umgebungsvariablen (ZOOM_SDK_CREDENTIALS,
  ZOOM_NUR_ANMELDEN, ZOOM_MEETING_ID, ZOOM_MEETING_PASSCODE,
  ZOOM_DISPLAY_NAME, ZOOM_VIDEO_DELAY_MS) und wartet am Ende nicht auf Enter.

  Windows PowerShell 5.1: kein &&, kein ?:, kein ??. Die Datei MUSS als
  UTF-8 MIT BOM gespeichert sein - sonst liest 5.1 sie in der ANSI-Codepage
  und zerlegt die Umlaute (der Bau prueft das, scripts/build-release.mjs).
#>
param(
  [switch]$OhneFragen
)

$ErrorActionPreference = 'Stop'

$ordner = $PSScriptRoot
$exe = Join-Path $ordner 'zoom-join.exe'
$einstOrdner = Join-Path $env:APPDATA 'JM Zoom Bridge'
$einstDatei = Join-Path $einstOrdner 'einstellungen.json'

function Beende([int]$code) {
  if (-not $OhneFragen) {
    Write-Host ''
    Read-Host 'Enter druecken zum Schliessen' | Out-Null
  }
  exit $code
}

function LiesEinstellungen {
  $e = @{ zugangsdaten = ''; anzeigename = 'JM Connect'; versatzMs = 0 }
  if (Test-Path -LiteralPath $einstDatei) {
    try {
      $j = Get-Content -LiteralPath $einstDatei -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($j.zugangsdaten) { $e.zugangsdaten = [string]$j.zugangsdaten }
      if ($j.anzeigename) { $e.anzeigename = [string]$j.anzeigename }
      $v = 0
      if ($null -ne $j.versatzMs -and [int]::TryParse([string]$j.versatzMs, [ref]$v) -and $v -ge 0 -and $v -le 1000) {
        $e.versatzMs = $v
      }
    } catch {
      Write-Host "Hinweis: $einstDatei ist nicht lesbar - es gelten die Vorgaben."
    }
  }
  return $e
}

function SchreibeEinstellungen($e) {
  # NUR diese drei Werte. Meeting-Nummer und Kenncode gehoeren nicht auf die Platte.
  $obj = [ordered]@{
    zugangsdaten = [string]$e.zugangsdaten
    anzeigename  = [string]$e.anzeigename
    versatzMs    = [int]$e.versatzMs
  }
  if (-not (Test-Path -LiteralPath $einstOrdner)) {
    New-Item -ItemType Directory -Path $einstOrdner | Out-Null
  }
  ($obj | ConvertTo-Json) | Set-Content -LiteralPath $einstDatei -Encoding UTF8
}

# Prueft die Zugangsdaten-Datei, ZEIGT ABER NIE EINEN WERT. Liefert $null, wenn
# sie taugt, sonst eine Meldung. Die Schluesselnamen sind dieselben, die
# zoom-join.exe liest (src/jwt.ts, readCredentials) - Gross-/Kleinschreibung
# zaehlt dort, darum hier -ccontains.
function PruefeZugangsdaten([string]$pfad) {
  if (-not $pfad) { return 'Kein Pfad angegeben.' }
  if (-not (Test-Path -LiteralPath $pfad -PathType Leaf)) { return "Datei nicht gefunden: $pfad" }
  try {
    $j = Get-Content -LiteralPath $pfad -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    # Die Fehlermeldung von ConvertFrom-Json zitiert Teile des Inhalts -
    # darum absichtlich NICHT anzeigen.
    return 'Die Datei ist kein gueltiges JSON (Inhalt wird absichtlich nicht angezeigt).'
  }
  if ($j -isnot [System.Management.Automation.PSCustomObject]) {
    return 'Die Datei enthaelt kein JSON-Objekt { ... }.'
  }
  $namen = @($j.PSObject.Properties | ForEach-Object { $_.Name })
  $idOk = $false
  foreach ($n in @('clientId', 'client_id', 'appKey', 'sdkKey')) {
    if (($namen -ccontains $n) -and ([string]$j.$n).Length -gt 0) { $idOk = $true }
  }
  $secOk = $false
  foreach ($n in @('clientSecret', 'client_secret', 'appSecret', 'sdkSecret')) {
    if (($namen -ccontains $n) -and ([string]$j.$n).Length -gt 0) { $secOk = $true }
  }
  if (-not $idOk -or -not $secOk) {
    return 'In der Datei fehlt die Client-ID oder das Secret. Erwartet: { "clientId": "...", "clientSecret": "..." }'
  }
  return $null
}

function Frage([string]$text, [string]$vorgabe) {
  if ($vorgabe) { $a = Read-Host "$text [$vorgabe]" } else { $a = Read-Host $text }
  if ([string]::IsNullOrWhiteSpace($a)) { return $vorgabe }
  return $a.Trim()
}

function GanzzahlImBereich([string]$text, [ref]$wert) {
  $v = 0
  if (-not [int]::TryParse($text, [ref]$v)) { return $false }
  if ($v -lt 0 -or $v -gt 1000) { return $false }
  $wert.Value = $v
  return $true
}

Write-Host ''
Write-Host '=== JM Zoom Bridge ==='
Write-Host ''

if (-not (Test-Path -LiteralPath $exe)) {
  Write-Host "zoom-join.exe fehlt: $exe"
  Write-Host 'Bitte den ganzen Ordner aus dem ZIP entpacken.'
  Beende 1
}

$e = LiesEinstellungen
$nurAnmelden = $false

if ($OhneFragen) {
  $zugang = [string]$env:ZOOM_SDK_CREDENTIALS
  $nurAnmelden = ($env:ZOOM_NUR_ANMELDEN -eq '1')
  $problem = PruefeZugangsdaten $zugang
  if ($problem) {
    Write-Host "Zugangsdaten-Datei (ZOOM_SDK_CREDENTIALS): $problem"
    Beende 1
  }
  if (-not $nurAnmelden) {
    if ($env:ZOOM_DISPLAY_NAME) { $e.anzeigename = $env:ZOOM_DISPLAY_NAME }
    $vz = 0
    if ($env:ZOOM_VIDEO_DELAY_MS -and (GanzzahlImBereich $env:ZOOM_VIDEO_DELAY_MS ([ref]$vz))) { $e.versatzMs = $vz }
  }
} else {
  Write-Host 'Vorgaben in [Klammern] uebernimmt Enter.'
  Write-Host ''

  # 1. Zugangsdaten-Datei
  do {
    $zugang = Frage 'Zugangsdaten-Datei (JSON mit clientId und clientSecret)' $e.zugangsdaten
    if ($zugang) { $zugang = $zugang.Trim().Trim('"') }
    $problem = PruefeZugangsdaten $zugang
    if ($problem) { Write-Host "  $problem" -ForegroundColor Yellow }
  } while ($problem)

  # 2. Modus
  do {
    $m = Frage 'Modus: [1] Meeting beitreten   [2] nur Zugangsdaten pruefen' '1'
  } while ($m -ne '1' -and $m -ne '2')
  $nurAnmelden = ($m -eq '2')

  if (-not $nurAnmelden) {
    # 3. Meeting-Nummer - Leerzeichen und Bindestriche sind erlaubt
    #    (zoom-join.exe entfernt sie, src/protocol.ts normalizeMeetingId).
    do {
      $meeting = Read-Host 'Meeting-Nummer (Leerzeichen erlaubt)'
      $ok = (($meeting -replace '[\s-]', '') -match '^\d+$')
      if (-not $ok) { Write-Host '  Bitte nur Ziffern (Leerzeichen und Bindestriche sind erlaubt).' -ForegroundColor Yellow }
    } while (-not $ok)

    # 4. Kenncode - verdeckt, und nur fuer diesen Lauf im Speicher
    $sicher = Read-Host 'Kenncode (wird nicht angezeigt; leer lassen, wenn keiner)' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sicher)
    try {
      $kenncode = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    # 5. Anzeigename
    $e.anzeigename = Frage 'Anzeigename im Meeting' $e.anzeigename

    # 6. Bild-Versatz
    do {
      $v = Frage 'Bild-Versatz in ms (0 bis 1000; Ton hinterher -> groesser)' ([string]$e.versatzMs)
      $vz = 0
      $ok = GanzzahlImBereich $v ([ref]$vz)
      if (-not $ok) { Write-Host '  Bitte eine ganze Zahl von 0 bis 1000.' -ForegroundColor Yellow }
    } while (-not $ok)
    $e.versatzMs = $vz
  }
}

# Merken - NUR Zugangsdaten-Pfad, Anzeigename, Versatz.
$e.zugangsdaten = (Resolve-Path -LiteralPath $zugang).Path
SchreibeEinstellungen $e

# Umgebung fuer zoom-join.exe. Client-ID/Secret aus der Umgebung ENTFERNEN:
# stuenden sie dort, gewaennen sie gegen die Datei, und der Lauf pruefte eine
# andere Anmeldung als die gewaehlte.
[Environment]::SetEnvironmentVariable('ZOOM_SDK_CLIENT_ID', $null, 'Process')
[Environment]::SetEnvironmentVariable('ZOOM_SDK_CLIENT_SECRET', $null, 'Process')
$env:ZOOM_SDK_CREDENTIALS = $e.zugangsdaten
if (-not $OhneFragen) {
  if ($nurAnmelden) {
    $env:ZOOM_NUR_ANMELDEN = '1'
  } else {
    [Environment]::SetEnvironmentVariable('ZOOM_NUR_ANMELDEN', $null, 'Process')
    $env:ZOOM_MEETING_ID = $meeting
    [Environment]::SetEnvironmentVariable('ZOOM_MEETING_PASSCODE', $kenncode, 'Process')
    $env:ZOOM_DISPLAY_NAME = $e.anzeigename
    $env:ZOOM_VIDEO_DELAY_MS = [string]$e.versatzMs
  }
}
$versatzDatei = Join-Path ([IO.Path]::GetTempPath()) ('jm-zoom-versatz-' + [guid]::NewGuid().ToString() + '.txt')
$env:ZOOM_VERSATZ_DATEI = $versatzDatei

Write-Host ''
if ($nurAnmelden) {
  Write-Host 'Pruefe die Zugangsdaten bei Zoom (es wird KEIN Meeting betreten) ...'
} else {
  Write-Host 'Starte. Beenden mit "ende" + Enter (Strg+C geht auch). "hilfe" zeigt alle Befehle.'
}
Write-Host ''

# Native Programme schreiben auf stderr - unter 'Stop' wuerde Windows
# PowerShell 5.1 das bei umgeleiteter Ausgabe als Fehler werten und abbrechen.
$ErrorActionPreference = 'Continue'
$code = $null
try {
  & $exe
  $code = $LASTEXITCODE
} finally {
  # Der Kenncode lebt nur fuer diesen Lauf. .NET statt Remove-Item: laeuft
  # auch nach Strg+C, wenn PowerShell keine Befehle mehr annimmt.
  [Environment]::SetEnvironmentVariable('ZOOM_MEETING_PASSCODE', $null, 'Process')
  if ($null -eq $code) {
    [Console]::WriteLine('')
    [Console]::WriteLine('Abgebrochen (Strg+C).')
  }
}
$ErrorActionPreference = 'Stop'

# Den zuletzt BESTAETIGTEN Bild-Versatz als naechste Vorgabe merken - der im
# Projekt per Klatschtest nachgestellte Wert soll nicht verloren gehen.
if (Test-Path -LiteralPath $versatzDatei) {
  $vz = 0
  $roh = (Get-Content -LiteralPath $versatzDatei -Raw).Trim()
  Remove-Item -LiteralPath $versatzDatei
  if ((GanzzahlImBereich $roh ([ref]$vz)) -and $vz -ne $e.versatzMs) {
    $e.versatzMs = $vz
    SchreibeEinstellungen $e
    Write-Host "Zuletzt bestaetigter Bild-Versatz: $vz ms - wird beim naechsten Start vorgeschlagen."
  }
}

Write-Host ''
switch ($code) {
  0 {
    if ($nurAnmelden) {
      Write-Host 'ERGEBNIS: Zugangsdaten in Ordnung - die Anmeldung bei Zoom hat geklappt.' -ForegroundColor Green
    } else {
      Write-Host 'ERGEBNIS: Im Meeting gewesen, die Aufnahme-Erlaubnis (Rohdaten) war erteilt.' -ForegroundColor Green
    }
  }
  1 {
    Write-Host 'ERGEBNIS: Abgebrochen, bevor es losging - eine Voraussetzung fehlt oder die Anmeldung wurde abgelehnt.' -ForegroundColor Red
    Write-Host 'Die Meldung darueber sagt, was fehlt (Zugangsdaten-Datei, Zoom-Dateien im Ordner bin, ...).'
  }
  3 {
    Write-Host 'ERGEBNIS: Im Meeting gewesen, aber OHNE Aufnahme-Erlaubnis - es konnte kein Bild und kein Ton abonniert werden.' -ForegroundColor Yellow
    Write-Host 'Der Gastgeber muss die Aufnahme im Zoom-Client erlauben (oder wir sind selbst Gastgeber).'
  }
  4 {
    Write-Host 'ERGEBNIS: Nicht ins Meeting gekommen.' -ForegroundColor Red
    Write-Host 'Pruefen: Meeting-Nummer, Kenncode, laeuft das Meeting, wurden wir aus dem Warteraum eingelassen?'
  }
  default {
    Write-Host "ERGEBNIS: Unerwarteter Rueckgabewert $code - die Meldungen darueber mitschicken." -ForegroundColor Red
  }
}

Beende $code
