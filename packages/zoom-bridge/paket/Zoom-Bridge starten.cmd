@echo off
rem JM Zoom Bridge - Doppelklick startet das Start-Skript in diesem Fenster.
rem Reines ASCII: cmd.exe liest diese Datei in der OEM-Codepage.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
