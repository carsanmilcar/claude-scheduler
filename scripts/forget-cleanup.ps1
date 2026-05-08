# Run by the Claude Code SessionEnd hook.
# Deletes any session JSONLs that were marked for deletion via the /forget command.
#
# If a JSONL is still locked (Claude hasn't released the handle yet), the flag
# is left in place and the next SessionEnd attempt will retry.

$ErrorActionPreference = 'Stop'

$marksDir = Join-Path $env:USERPROFILE '.claude\forget-marks'
if (-not (Test-Path $marksDir)) { exit 0 }

$flags = Get-ChildItem $marksDir -Filter '*.flag' -ErrorAction SilentlyContinue
if (-not $flags) { exit 0 }

foreach ($flag in $flags) {
    $jsonlPath = ''
    try {
        $jsonlPath = (Get-Content $flag.FullName -Raw).Trim()
    } catch {
        # Flag unreadable — drop it
        Remove-Item $flag.FullName -Force -ErrorAction SilentlyContinue
        continue
    }

    if ($jsonlPath -and (Test-Path $jsonlPath)) {
        try {
            Remove-Item $jsonlPath -Force -ErrorAction Stop
        } catch {
            # File still locked. Leave flag in place; next SessionEnd retries.
            "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  retry-pending: $jsonlPath  ($($_.Exception.Message))" |
                Out-File (Join-Path $marksDir 'errors.log') -Append -Encoding utf8
            continue
        }
    }

    # JSONL is gone (or never existed) — flag did its job
    Remove-Item $flag.FullName -Force -ErrorAction SilentlyContinue
}
