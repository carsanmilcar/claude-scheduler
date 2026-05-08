' Silent launcher for tray.ps1 — no console window flash on startup.
' Double-click this file to run Claude Scheduler in the background.

Set shell = CreateObject("WScript.Shell")
strPath = WScript.ScriptFullName
strFolder = Left(strPath, InStrRev(strPath, "\") - 1)
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strFolder & "\tray.ps1""", 0, False
