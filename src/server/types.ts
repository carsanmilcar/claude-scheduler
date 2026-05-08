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

export interface CreateTaskBody {
  name: string
  repo_path: string
  prompt?: string
  session_id?: string
  cron_expr?: string
  next_run_at?: string
}
