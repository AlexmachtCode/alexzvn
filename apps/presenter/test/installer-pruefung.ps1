param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [Parameter(Mandatory = $true)][string]$Produkt,
  [Parameter(Mandatory = $true)][string]$AppId
)
# Prueft die Registry-Anmeldung des Presenter-Installers (#299): Installieren, Update, Deinstallieren.
# Schreibt nur unter HKCU; die Deinstallation laeuft auch bei FAIL (finally).
$ErrorActionPreference = 'Stop'
$script:fails = 0
$Installer = (Resolve-Path -LiteralPath $Installer).Path
$progId = "$AppId.pdf"
$exe = "$Produkt.exe"
$instDir = Join-Path $env:LOCALAPPDATA "Programs\$Produkt"
$uninst = Join-Path $instDir "Uninstall $Produkt.exe"
$classes = 'HKCU:\Software\Classes'
$caps = "HKCU:\Software\Jakobs Medien\$Produkt\Capabilities"

function Report([bool]$cond, [string]$name) {
  if ($cond) { Write-Host "ok   $name" } else { Write-Host "FAIL $name"; $script:fails++ }
}
function RegDefault([string]$path) {
  try { return (Get-Item -LiteralPath $path -ErrorAction Stop).GetValue('') } catch { return $null }
}
function RegValue([string]$path, [string]$name) {
  try { return (Get-Item -LiteralPath $path -ErrorAction Stop).GetValue($name, $null) } catch { return $null }
}
function RegHasValue([string]$path, [string]$name) {
  try { return ((Get-Item -LiteralPath $path -ErrorAction Stop).GetValueNames() -contains $name) } catch { return $false }
}
function Test-Eintraege([string]$phase) {
  $cmd = '"' + (Join-Path $instDir $exe) + '" "%1"'
  Report ((RegDefault "$classes\$progId") -eq 'PDF-Dokument') "$phase ProgID Beschreibung"
  Report ((RegDefault "$classes\$progId\shell\open\command") -eq $cmd) "$phase ProgID open\command"
  Report ($null -ne (RegDefault "$classes\$progId\DefaultIcon")) "$phase ProgID DefaultIcon"
  Report (RegHasValue "$classes\.pdf\OpenWithProgids" $progId) "$phase .pdf\OpenWithProgids"
  Report (RegHasValue "$classes\Applications\$exe\SupportedTypes" '.pdf') "$phase Applications\SupportedTypes"
  Report ((RegValue $caps 'ApplicationDescription') -eq 'PDFs und Präsentationen vorführen') "$phase Capabilities Beschreibung"
  Report ((RegValue "$caps\FileAssociations" '.pdf') -eq $progId) "$phase Capabilities FileAssociations"
  Report ($null -ne (RegValue 'HKCU:\Software\RegisteredApplications' $Produkt)) "$phase RegisteredApplications"
  Report ((RegDefault "$classes\.pdf") -eq $script:pdfVorher) "$phase .pdf Standardwert unveraendert"
}
function Test-Weg([string]$phase) {
  Report (-not (Test-Path -LiteralPath "$classes\$progId")) "$phase ProgID weg"
  Report (-not (RegHasValue "$classes\.pdf\OpenWithProgids" $progId)) "$phase OpenWithProgids ohne ProgID"
  Report (-not (Test-Path -LiteralPath "$classes\Applications\$exe")) "$phase Applications weg"
  Report (-not (Test-Path -LiteralPath "HKCU:\Software\Jakobs Medien\$Produkt")) "$phase Capabilities weg"
  Report (-not (RegHasValue 'HKCU:\Software\RegisteredApplications' $Produkt)) "$phase RegisteredApplications weg"
  Report ((RegDefault "$classes\.pdf") -eq $script:pdfVorher) "$phase .pdf Standardwert unveraendert"
}

$script:pdfVorher = RegDefault "$classes\.pdf"
Write-Host "info .pdf Standardwert vorher: '$($script:pdfVorher)'"
try {
  $p = Start-Process -FilePath $Installer -ArgumentList '/S' -Wait -PassThru
  Report ($p.ExitCode -eq 0) "Installation (Exit $($p.ExitCode))"
  Test-Eintraege 'install'

  $p = Start-Process -FilePath $Installer -ArgumentList '/S' -Wait -PassThru
  Report ($p.ExitCode -eq 0) "Update (Exit $($p.ExitCode))"
  Test-Eintraege 'update'
}
finally {
  if (Test-Path -LiteralPath $uninst) {
    Start-Process -FilePath $uninst -ArgumentList '/S' | Out-Null
    $ende = (Get-Date).AddSeconds(30)
    while ((Test-Path -LiteralPath (Join-Path $instDir $exe)) -and (Get-Date) -lt $ende) { Start-Sleep -Milliseconds 500 }
    Start-Sleep -Seconds 2
  }
  Report (-not (Test-Path -LiteralPath (Join-Path $instDir $exe))) 'Deinstallation entfernt die Exe'
  Test-Weg 'uninstall'
}
if ($script:fails -gt 0) { Write-Host "$($script:fails) FAIL"; exit 1 }
Write-Host 'alles ok'
exit 0
