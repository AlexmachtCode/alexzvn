<#
  JM Zoom Bridge - Start-Skript (Einsatzpaket).

  Fragt Zugangsdaten-Datei, Modus, Meeting-Nummer, Kenncode, Anzeigename und
  Bild-Versatz ab, setzt damit die Umgebung und startet zoom-join.exe IM
  SELBEN FENSTER. Danach wird der Rueckgabewert in Klartext gedeutet.

  Gemerkt werden in %APPDATA%\JM Zoom Bridge\einstellungen.json NUR:
  Pfad der Zugangsdaten-Datei, Anzeigename, Bild-Versatz.
  NIE die Meeting-Nummer, NIE den Kenncode. Daneben schreibt zoom-join.exe
  versatz-zuletzt.txt: den zuletzt von der Bridge bestaetigten Bild-Versatz,
  SOFORT bei jeder Bestaetigung - so ueberlebt der Klatschtest-Wert auch ein
  geschlossenes Fenster. Das Skript uebernimmt ihn beim naechsten Start.

  Strg+C waehrend des Laufs bekommt NUR zoom-join.exe (die verlaesst das
  Meeting sauber); dieses Skript faengt es fuer sich ab und deutet danach das
  Ergebnis wie bei "ende". Ohne das brach PowerShell das Skript mitten im
  Lauf ab: kein ERGEBNIS, und unter der .cmd fragte cmd.exe "Batchvorgang
  abbrechen (J/N)?" und schloss das Fenster (gemessen, 01.10.2026).

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
$versatzDatei = Join-Path $einstOrdner 'versatz-zuletzt.txt'

function Beende($code) {
  # $null ist KEIN Erfolg: [int]$null waere 0, und ein Lauf, der gar nicht
  # erst startete, endete gruen (gemessen mit einer kaputten zoom-join.exe).
  if ($null -eq $code) { $code = 1 }
  if (-not $OhneFragen) {
    Write-Host ''
    Read-Host 'Enter druecken zum Schliessen' | Out-Null
  }
  exit [int]$code
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

# Uebernimmt den von zoom-join.exe gesicherten Bild-Versatz (versatz-zuletzt.txt)
# in die Einstellungen und loescht die Datei. Liefert den Wert oder $null.
# Laeuft vor UND nach dem Lauf: endete der letzte Lauf hart (Fenster
# geschlossen), liegt die Datei noch da und wird beim naechsten Start geholt.
function UebernimmVersatz($e) {
  if (-not [IO.File]::Exists($versatzDatei)) { return $null }
  $roh = ''
  try { $roh = [IO.File]::ReadAllText($versatzDatei).Trim() } catch { return $null }
  try { [IO.File]::Delete($versatzDatei) } catch { }
  $vz = 0
  if (-not (GanzzahlImBereich $roh ([ref]$vz))) { return $null }
  if ($vz -ne $e.versatzMs) {
    $e.versatzMs = $vz
    SchreibeEinstellungen $e
  }
  return $vz
}

# Faengt Strg+C und Strg+Pause fuer DIESEN Prozess ab, solange zoom-join.exe
# laeuft. Ein Konsolen-Handler, der TRUE liefert, beendet die Kette: der von
# PowerShell kommt danach nicht mehr dran, das Skript laeuft weiter.
# zoom-join.exe bekommt das Signal trotzdem - jeder Prozess an der Konsole
# hat seine eigene Kette - und verlaesst das Meeting sauber. Fenster
# schliessen (CTRL_CLOSE_EVENT) geht weiter an Windows. Liefert $false, wenn
# Add-Type nicht geht (z. B. eingeschraenkter Sprachmodus); dann bleibt das
# alte Verhalten mit dem finally-Zweig unten.
function StrgCAbfangen {
  try {
    if (-not ('JmZoomBridgeStrgC' -as [type])) {
      Add-Type -ErrorAction Stop -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class JmZoomBridgeStrgC {
  private delegate bool Handler(uint art);
  [DllImport("kernel32.dll")]
  private static extern bool SetConsoleCtrlHandler(Handler h, bool add);
  private static readonly Handler handler = new Handler(Fang);
  private static bool Fang(uint art) { return art == 0 || art == 1; }
  public static bool An() { return SetConsoleCtrlHandler(handler, true); }
  public static bool Aus() { return SetConsoleCtrlHandler(handler, false); }
}
'@
    }
    return [bool][JmZoomBridgeStrgC]::An()
  } catch {
    return $false
  }
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
# Ein Wert aus einem hart beendeten Lauf (Fenster geschlossen) liegt noch da.
$ausLetztemLauf = UebernimmVersatz $e
if ($null -ne $ausLetztemLauf) {
  Write-Host "Bild-Versatz aus dem letzten Lauf uebernommen: $ausLetztemLauf ms"
  Write-Host ''
}
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
# .ProviderPath, NICHT .Path: fuer eine Netzwerkfreigabe (\\server\...) liefert
# .Path "Microsoft.PowerShell.Core\FileSystem::\\server\..." - das versteht nur
# PowerShell, zoom-join.exe scheiterte daran mit ENOENT (gemessen), und der
# Wert stand danach als Vorgabe in den Einstellungen.
$e.zugangsdaten = (Resolve-Path -LiteralPath $zugang).ProviderPath
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
if (-not (Test-Path -LiteralPath $einstOrdner)) {
  New-Item -ItemType Directory -Path $einstOrdner | Out-Null
}
$env:ZOOM_VERSATZ_DATEI = $versatzDatei

Write-Host ''
if ($nurAnmelden) {
  Write-Host 'Pruefe die Zugangsdaten bei Zoom (es wird KEIN Meeting betreten) ...'
} else {
  Write-Host 'Starte. Beenden mit "ende" + Enter (Strg+C geht auch). "hilfe" zeigt alle Befehle.'
  Write-Host 'Das Fenster NICHT mit dem X schliessen - dann bleibt "JM Connect" unter Umstaenden im Meeting stehen.'
}
Write-Host ''

# Native Programme schreiben auf stderr - unter 'Stop' wuerde Windows
# PowerShell 5.1 das bei umgeleiteter Ausgabe als Fehler werten und abbrechen.
$ErrorActionPreference = 'Continue'
$code = $null
$startFehler = $null
$strgCGefangen = StrgCAbfangen
try {
  & $exe
  $code = $LASTEXITCODE
} catch {
  # zoom-join.exe liess sich nicht starten (blockiert, beschaedigt, keine
  # gueltige Anwendung). Ohne diesen Zweig stand "Abgebrochen (Strg+C)" da,
  # und das Skript endete mit 0 (gemessen).
  # Nur die erste Zeile, ohne die angehaengte Fundstelle im Skript ("In Zeile:...").
  $startFehler = (($_.Exception.Message -split "`r?`n")[0] -replace '(?<=\.)(In|At) (Zeile|line|[A-Za-z]:\\).*$', '')
} finally {
  if ($strgCGefangen) { [void][JmZoomBridgeStrgC]::Aus() }
  # Der Kenncode lebt nur fuer diesen Lauf. NUR .NET-Aufrufe hier: wurde das
  # Skript doch abgebrochen (Strg+C ohne den Handler oben), nimmt PowerShell
  # im finally keine Befehle mehr an.
  [Environment]::SetEnvironmentVariable('ZOOM_MEETING_PASSCODE', $null, 'Process')
  if ($null -eq $code -and $null -eq $startFehler) {
    [Console]::WriteLine('')
    [Console]::WriteLine('Abgebrochen (Strg+C).')
    if ([IO.File]::Exists($versatzDatei)) {
      [Console]::WriteLine('Der zuletzt bestaetigte Bild-Versatz ist gesichert und wird beim naechsten Start vorgeschlagen.')
    }
    if (-not $OhneFragen) {
      [Console]::WriteLine('Enter druecken zum Schliessen')
      [void][Console]::ReadLine()
    }
  }
}
$ErrorActionPreference = 'Stop'

if ($null -ne $startFehler) {
  Write-Host ''
  Write-Host "zoom-join.exe liess sich nicht starten: $startFehler" -ForegroundColor Red
  Write-Host 'Moeglicherweise blockiert der Virenschutz oder Smart App Control die Datei (sie ist nicht signiert).'
  Write-Host 'Dort freigeben oder das Paket neu entpacken.'
  $code = 1
}

# Den zuletzt BESTAETIGTEN Bild-Versatz als naechste Vorgabe merken - der im
# Projekt per Klatschtest nachgestellte Wert soll nicht verloren gehen.
$vz = UebernimmVersatz $e
if ($null -ne $vz) {
  Write-Host ''
  Write-Host "Zuletzt bestaetigter Bild-Versatz: $vz ms - wird beim naechsten Start vorgeschlagen. Bitte notieren."
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
    Write-Host 'ERGEBNIS: Abgebrochen, bevor es losging - eine Voraussetzung fehlt, die Bridge startet nicht, oder die Anmeldung wurde abgelehnt.' -ForegroundColor Red
    Write-Host 'Die Meldung darueber sagt, was fehlt (Zugangsdaten-Datei, Zoom-Dateien im Ordner bin, ...).'
  }
  3 {
    Write-Host 'ERGEBNIS: Im Meeting gewesen, aber ohne Aufnahme-Erlaubnis (Rohdaten) - ohne sie gibt es kein Bild und keinen Ton.' -ForegroundColor Yellow
    Write-Host 'Der Gastgeber muss die Aufnahme im Zoom-Client erlauben (oder wir sind selbst Gastgeber).'
  }
  4 {
    Write-Host 'ERGEBNIS: Nicht ins Meeting gekommen (oder vorher mit "ende"/Strg+C abgebrochen).' -ForegroundColor Red
    Write-Host 'Pruefen: Meeting-Nummer, Kenncode, laeuft das Meeting, hat der Gastgeber uns aus dem Warteraum eingelassen?'
  }
  5 {
    Write-Host 'ERGEBNIS: Die Bridge ist unerwartet beendet worden (Absturz) - Bild und Ton waren ab da weg.' -ForegroundColor Red
    Write-Host 'Die Meldungen darueber (FEHLER-Zeile mit exitCode) an das Entwicklungsteam schicken. Neu starten.'
  }
  6 {
    Write-Host 'ERGEBNIS: Die Verbindung zum Meeting ist abgerissen (Netz oder Zoom) - Bild und Ton waren ab da weg.' -ForegroundColor Yellow
    Write-Host 'Neu starten, um wieder beizutreten.'
  }
  default {
    Write-Host "ERGEBNIS: Unerwarteter Rueckgabewert $code - die Meldungen darueber mitschicken." -ForegroundColor Red
  }
}

Beende $code
