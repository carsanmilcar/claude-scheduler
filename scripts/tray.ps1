# Claude Scheduler tray app
# Launches the Node daemon hidden and creates a system-tray icon to control it.
# Run via tray.vbs for a fully invisible startup.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Log uncaught errors so the user can debug if the tray fails to appear
$errorLog = Join-Path $root 'data\tray-error.log'
trap {
    New-Item -ItemType Directory -Force -Path (Split-Path $errorLog) | Out-Null
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $($_ | Out-String)" |
        Out-File $errorLog -Append -Encoding utf8
    exit 1
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# If a server is already running, just open the dashboard and exit
try {
    Invoke-WebRequest -Uri 'http://localhost:3333/api/health' -TimeoutSec 1 -UseBasicParsing | Out-Null
    Start-Process 'http://localhost:3333'
    exit 0
} catch {
    # not running, continue to start
}

# Build the client if missing
if (-not (Test-Path "$root\dist\client\index.html")) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm', 'run', 'build' `
        -WorkingDirectory $root -Wait -WindowStyle Hidden
}

# Start the daemon, redirect stdout/stderr to a log file
$logFile = Join-Path $root 'data\daemon.log'
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null

$env:NODE_ENV = 'production'
$env:PORT = '3333'
$daemon = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', "npx tsx src\server\index.ts > `"$logFile`" 2>&1" `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru
$daemonPid = $daemon.Id

# Give the server a moment to bind the port
Start-Sleep -Seconds 2

# Tray icon
$notify = New-Object System.Windows.Forms.NotifyIcon
$iconPath = Join-Path $root 'assets\icon.ico'
if (Test-Path $iconPath) {
    $notify.Icon = New-Object System.Drawing.Icon $iconPath
} else {
    $notify.Icon = [System.Drawing.SystemIcons]::Application
}
$notify.Text = 'Claude Scheduler'
$notify.Visible = $true

# Context menu
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$miOpen   = $menu.Items.Add('Open Dashboard')
$miLogs   = $menu.Items.Add('Open Logs Folder')
$miServer = $menu.Items.Add('Show Server Log')
$null = $menu.Items.Add('-')
$miQuit   = $menu.Items.Add('Quit')

$miOpen.add_Click({ Start-Process 'http://localhost:3333' })
$miLogs.add_Click({ Start-Process explorer.exe (Join-Path $root 'data\logs') })
$miServer.add_Click({ Start-Process notepad.exe $logFile })

$miQuit.add_Click({
    $notify.Visible = $false
    $notify.Dispose()
    # Kill the daemon and its descendants
    try { & taskkill.exe /F /T /PID $daemonPid 2>$null | Out-Null } catch {}
    [System.Windows.Forms.Application]::Exit()
})

$notify.ContextMenuStrip = $menu
$notify.add_DoubleClick({ Start-Process 'http://localhost:3333' })

# Block on the WinForms message loop
[System.Windows.Forms.Application]::Run()
