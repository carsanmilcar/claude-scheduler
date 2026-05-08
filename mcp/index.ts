#!/usr/bin/env node
/**
 * MCP server that exposes a `schedule_session` tool to Claude Code.
 * Talks to the local claude-scheduler daemon over HTTP. If the daemon
 * isn't running, launches scripts/tray.vbs and waits for it to come up.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const TRAY_VBS = path.join(PROJECT_ROOT, 'scripts', 'tray.vbs')
const DAEMON_URL = process.env.CLAUDE_SCHEDULER_URL ?? 'http://localhost:3333'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read the current Claude Code session ID from the env var that the CLI
 * exposes to every subprocess. Returns null if missing or malformed.
 *
 * Deliberately does not fall back to filesystem listing — guessing from
 * `~/.claude/projects/` exposes other sessions and can pick the wrong one
 * when the subprocess cwd doesn't match the session's cwd.
 */
function getSessionId(): string | null {
  const id = process.env.CLAUDE_CODE_SESSION_ID
  return id && UUID_RE.test(id) ? id : null
}

/** True if `when` looks like a cron expression (5 space-separated fields). */
function isCron(when: string): boolean {
  return when.trim().split(/\s+/).length === 5
}

async function daemonHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${DAEMON_URL}/api/health`, {
      signal: AbortSignal.timeout(1500),
    })
    return res.ok
  } catch {
    return false
  }
}

async function ensureDaemonRunning(): Promise<void> {
  if (await daemonHealthy()) return

  if (!fs.existsSync(TRAY_VBS)) {
    throw new Error(`Daemon is down and tray launcher not found at ${TRAY_VBS}`)
  }

  // Launch tray.vbs detached
  spawn('wscript.exe', [TRAY_VBS], { detached: true, stdio: 'ignore' }).unref()

  // Poll for up to 15s
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000))
    if (await daemonHealthy()) return
  }
  throw new Error('Daemon did not come up within 15s after launching tray.vbs')
}

// ─── MCP server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'claude-scheduler', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'schedule_session',
      description:
        'Register a reminder to resume a Claude Code session at a specific time. ' +
        'Use this when the user asks to schedule, queue, remind, or come back to the current conversation later. ' +
        'Auto-detects the current repo and session — caller should normally only provide name, when, and an optional prompt.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Short human-readable label for the task (e.g. "morning review")',
          },
          when: {
            type: 'string',
            description:
              'When to fire. Either an ISO datetime for one-shot ("2026-05-10T09:00:00") ' +
              'or a 5-field cron expression for recurring ("0 9 * * 1-5" = weekdays 9am). ' +
              'Cron uses local time.',
          },
          prompt: {
            type: 'string',
            description: 'Optional initial message to send to Claude when the session resumes.',
          },
          session_id: {
            type: 'string',
            description:
              'Optional session UUID. If omitted, the server reads CLAUDE_CODE_SESSION_ID ' +
              'from the environment (the active session). If that is also absent, falls ' +
              'back to --continue (latest session in the repo). Pass an empty string to ' +
              'force --continue regardless of env.',
          },
          repo_path: {
            type: 'string',
            description:
              'Optional absolute repo path. If omitted, uses CLAUDE_PROJECT_DIR ' +
              'env var or the MCP server cwd.',
          },
        },
        required: ['name', 'when'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'schedule_session') {
    throw new Error(`Unknown tool: ${req.params.name}`)
  }

  const args = (req.params.arguments ?? {}) as {
    name?: string
    when?: string
    prompt?: string
    session_id?: string
    repo_path?: string
  }

  if (!args.name?.trim()) throw new Error('`name` is required')
  if (!args.when?.trim()) throw new Error('`when` is required')

  const repoPath =
    args.repo_path?.trim() ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd()

  // Resolve session_id: explicit > env var > null (= --continue)
  let sessionId: string | null
  if (args.session_id === '') {
    sessionId = null  // explicit empty = force --continue
  } else if (args.session_id) {
    sessionId = args.session_id
  } else {
    sessionId = getSessionId()
  }

  // Translate `when` into the API shape
  const when = args.when.trim()
  const body: Record<string, unknown> = {
    name: args.name.trim(),
    repo_path: repoPath,
    prompt: args.prompt?.trim() || '',
    session_id: sessionId,
  }

  if (isCron(when)) {
    body.cron_expr = when
  } else {
    const date = new Date(when)
    if (isNaN(date.getTime())) {
      throw new Error(
        `Couldn't parse \`when\`: "${when}". Expected ISO datetime or 5-field cron.`,
      )
    }
    body.next_run_at = date.toISOString()
  }

  await ensureDaemonRunning()

  const res = await fetch(`${DAEMON_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Daemon rejected the task: ${err.error ?? res.statusText}`)
  }

  const task = await res.json() as {
    id: string; name: string; cron_expr: string | null; next_run_at: string | null
  }

  const fires = task.cron_expr
    ? `recurring (cron: ${task.cron_expr})`
    : `once at ${new Date(task.next_run_at!).toLocaleString()}`

  return {
    content: [
      {
        type: 'text',
        text:
          `Scheduled "${task.name}" — ${fires}.\n` +
          `Session: ${sessionId ?? 'latest in repo (--continue)'}\n` +
          `Manage at ${DAEMON_URL}`,
      },
    ],
  }
})

// ─── Run ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
