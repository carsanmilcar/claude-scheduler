const BASE = '/api'

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface Task {
  id: string
  name: string
  repo_path: string
  prompt: string
  session_id: string | null
  cron_expr: string | null
  next_run_at: string | null
  is_active: number
  created_at: string
  updated_at: string
  last_run_at?: string
  last_run_status?: string
}

export interface Run {
  id: string
  task_id: string
  started_at: string
  ended_at: string | null
  status: 'running' | 'completed' | 'failed' | 'skipped'
  exit_code: number | null
  pid: number | null
  window_title: string | null
}

export interface RunLog {
  runId: string
  taskId: string
  taskName: string
  startedAt: string
  endedAt: string | null
  status: string
  exitCode: number | null
  command: string
  repoPath: string
}

export interface CreateTaskInput {
  name: string
  repo_path: string
  prompt?: string
  session_id?: string
  cron_expr?: string
  next_run_at?: string
  is_active?: number
}

export const api = {
  tasks: {
    list: ()                         => req<Task[]>('GET', '/tasks'),
    get: (id: string)                => req<Task>('GET', `/tasks/${id}`),
    create: (body: CreateTaskInput)  => req<Task>('POST', '/tasks', body),
    update: (id: string, body: Partial<CreateTaskInput>) => req<Task>('PUT', `/tasks/${id}`, body),
    delete: (id: string)             => req<void>('DELETE', `/tasks/${id}`),
    toggle: (id: string)             => req<Task>('PATCH', `/tasks/${id}/toggle`),
    runNow: (id: string)             => req<{ runId: string; skipped: boolean }>('POST', `/tasks/${id}/run`),
    runs: (id: string)               => req<Run[]>('GET', `/tasks/${id}/runs`),
  },
  runs: {
    get: (id: string)       => req<Run>('GET', `/runs/${id}`),
    log: (id: string)       => req<RunLog>('GET', `/runs/${id}/log`),
    openFolder: (id: string) => req<void>('POST', `/runs/${id}/open-folder`),
  },
  health: () => req<{ status: string; activeJobs: number; uptime: number }>('GET', '/health'),
}
