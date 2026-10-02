@echo off
rem JM Zoom Bridge - Doppelklick startet das Start-Skript in einem eigenen Fenster.
rem Reines ASCII: cmd.exe liest diese Datei in der OEM-Codepage.
rem
rem "start" statt eines direkten Aufrufs: liefe PowerShell UNTER dieser
rem Batchdatei, fragte cmd.exe nach jedem Strg+C "Batchvorgang abbrechen (J/N)?"
rem und schloesse danach das Fenster, egal was man antwortet (gemessen,
rem 01.10.2026). In einem eigenen Fenster gibt es keine Batchdatei mehr, die
rem fragen koennte; start.ps1 wartet am Ende selbst auf Enter.
start "JM Zoom Bridge" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
