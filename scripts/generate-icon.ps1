# Generates assets/icon.ico — a violet clock face used by the system-tray icon.
# Run from PowerShell when you want to regenerate or tweak the design.

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'assets\icon.ico'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null

function New-ClockBitmap {
    param([int]$size)

    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Brand violet (matches the dashboard's bg-violet-600 = #7c3aed)
    $violet = [System.Drawing.Color]::FromArgb(124, 58, 237)
    $white  = [System.Drawing.Color]::White

    # Filled violet circle
    $g.FillEllipse(
        (New-Object System.Drawing.SolidBrush $violet),
        1, 1, $size - 2, $size - 2)

    # White inner ring (clock face border)
    $ringInset = [Math]::Max(2, [int]($size * 0.13))
    $strokeW = [Math]::Max(1.5, $size / 32)
    $ringPen = New-Object System.Drawing.Pen $white, $strokeW
    $g.DrawEllipse($ringPen, $ringInset, $ringInset, $size - 2*$ringInset, $size - 2*$ringInset)

    # Hour ticks at 12, 3, 6, 9 — only large enough to show on bigger sizes
    if ($size -ge 32) {
        $tickBrush = New-Object System.Drawing.SolidBrush $white
        $cx = $size / 2.0; $cy = $size / 2.0
        $r1 = ($size / 2.0) - $ringInset - ($size * 0.07)
        for ($i = 0; $i -lt 12; $i++) {
            $angle = ($i * 30 - 90) * [Math]::PI / 180
            $x1 = $cx + $r1 * [Math]::Cos($angle)
            $y1 = $cy + $r1 * [Math]::Sin($angle)
            $tickSize = if ($i % 3 -eq 0) { [int]($size * 0.07) } else { [int]($size * 0.035) }
            if ($tickSize -lt 1) { $tickSize = 1 }
            $g.FillEllipse($tickBrush, $x1 - $tickSize/2, $y1 - $tickSize/2, $tickSize, $tickSize)
        }
    }

    # Hands at 10:10
    $handPen = New-Object System.Drawing.Pen $white, ([Math]::Max(2, $size / 16))
    $handPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handPen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round

    $cx = $size / 2.0; $cy = $size / 2.0

    # Hour hand → 10
    $hourAngle = (10 * 30 - 90) * [Math]::PI / 180
    $hourLen   = ($size / 2.0) * 0.45
    $g.DrawLine($handPen, $cx, $cy,
        $cx + $hourLen * [Math]::Cos($hourAngle),
        $cy + $hourLen * [Math]::Sin($hourAngle))

    # Minute hand → 2
    $minAngle = (2 * 30 - 90) * [Math]::PI / 180
    $minLen   = ($size / 2.0) * 0.62
    $g.DrawLine($handPen, $cx, $cy,
        $cx + $minLen * [Math]::Cos($minAngle),
        $cy + $minLen * [Math]::Sin($minAngle))

    # Centre pivot
    $pivot = [Math]::Max(2, [int]($size * 0.09))
    $g.FillEllipse((New-Object System.Drawing.SolidBrush $white),
        $cx - $pivot/2, $cy - $pivot/2, $pivot, $pivot)

    $g.Dispose()
    return $bmp
}

# Use a single 64x64 bitmap — Windows downsamples cleanly for tray (16x16 / 24x24).
$bmp = New-ClockBitmap -size 64

# Convert to a proper Icon handle and save — this writes a valid single-size ICO.
$hicon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hicon)

$fs = [System.IO.File]::Create($out)
$icon.Save($fs)
$fs.Close()

Write-Host "Wrote $out ($([math]::Round((Get-Item $out).Length / 1KB, 1)) KB)"
