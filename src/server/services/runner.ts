import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import db, { DATA_DIR } from '../db.js'
import type { Task, RunLog } from '../types.js'

const WINDOW_TITLE_PREFIX = 'ClaudeScheduler_'

// Returns the value wrapped in single quotes with embedded apostrophes doubled —
// the standard escape for PowerShell single-quoted strings.
const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`

// Escape PowerShell metacharacters inside a double-quoted string: `, ", $.
const psDoubleQuoteEscape = (s: string) => s.replace(/[`"$]/g, '`$&')

function isWindowOpen(taskName: string): boolean {
  const title = psQuote(`${WINDOW_TITLE_PREFIX}${taskName}`)
  try {
    execSync(
      `powershell.exe -NoProfile -Command "$w = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq ${title} }; if ($w) { exit 0 } else { exit 1 }"`,
      { stdio: 'pipe', timeout: 5000 }
    )
    return true
  } catch (e: any) {
    if (e.status === 1) return false
    return false
  }
}

function buildLauncherCommand(task: Task): string {
  const title = psQuote(`${WINDOW_TITLE_PREFIX}${task.name}`)
  const sessionFlag = task.session_id
    ? `--resume ${psQuote(task.session_id)}`
    : '--continue'
  const promptArg = task.prompt
    ? ` "${psDoubleQuoteEscape(task.prompt)}"`
    : ''

  // Minimal: just set title, cd, and launch claude — no wrappers, clean UI
  return [
    `$host.UI.RawUI.WindowTitle = ${title}`,
    `Set-Location ${psQuote(task.repo_path)}`,
    `claude --dangerously-skip-permissions ${sessionFlag}${promptArg}`,
  ].join('; ')
}

function writeRunLog(log: RunLog): void {
  const taskLogDir = path.join(DATA_DIR, 'logs', log.taskId)
  fs.mkdirSync(taskLogDir, { recursive: true })
  fs.writeFileSync(
    path.join(taskLogDir, `${log.runId}.json`),
    JSON.stringify(log, null, 2),
    'utf8'
  )
}

export function triggerTask(taskId: string): { runId: string; skipped: boolean } {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as unknown as Task | undefined
  if (!task) throw new Error(`Task ${taskId} not found`)

  const windowTitle = `${WINDOW_TITLE_PREFIX}${task.name}`

  if (isWindowOpen(task.name)) {
    const runId = uuidv4()
    db.prepare(`INSERT INTO runs (id, task_id, status, window_title) VALUES (?, ?, 'skipped', ?)`)
      .run(runId, taskId, windowTitle)
    writeRunLog({
      runId, taskId, taskName: task.name,
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
      status: 'skipped', exitCode: null,
      command: '(skipped — window already open)', repoPath: task.repo_path,
    })
    return { runId, skipped: true }
  }

  const runId = uuidv4()
  const psCommand = buildLauncherCommand(task)
  const claudeCmd = `claude --dangerously-skip-permissions ${task.session_id ? `--resume ${task.session_id}` : '--continue'}${task.prompt ? ` "${task.prompt}"` : ''}`

  db.prepare(`INSERT INTO runs (id, task_id, status, window_title) VALUES (?, ?, 'running', ?)`)
    .run(runId, taskId, windowTitle)
  writeRunLog({
    runId, taskId, taskName: task.name,
    startedAt: new Date().toISOString(), endedAt: null,
    status: 'running', exitCode: null,
    command: claudeCmd, repoPath: task.repo_path,
  })

  // cmd /c start opens a real visible console window on Windows
  const proc = spawn('cmd.exe', [
    '/c', 'start', 'powershell.exe',
    '-NoExit', '-ExecutionPolicy', 'Bypass',
    '-Command', psCommand,
  ], { detached: true, stdio: 'ignore' })

  proc.unref()

  // cmd.exe exits immediately after start — we can't track the PS pid from here.
  // Mark run as running; it'll stay that way until the user closes the window.
  // (Future: inject the PS pid via a temp file written by the launcher script)

  return { runId, skipped: false }
}
