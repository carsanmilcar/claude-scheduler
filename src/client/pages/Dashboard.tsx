import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import cronstrue from 'cronstrue/i18n'
import {
  Play, FileText, Pencil, Pause, Power, Trash2, Plus,
  Folder, Repeat, Calendar, Clock,
} from 'lucide-react'
import { api, type Task } from '../http.ts'
import StatusBadge from '../components/StatusBadge.tsx'

const FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'ahora'
  if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)}m`
  if (diff < 86_400_000) return `hace ${Math.round(diff / 3_600_000)}h`
  return FORMATTER.format(date)
}

function formatAbs(iso: string | null | undefined): string {
  if (!iso) return '—'
  return FORMATTER.format(new Date(iso))
}

function humanizeCron(expr: string): string {
  try { return cronstrue.toString(expr, { locale: 'es' }) }
  catch { return expr }
}

function taskStatus(t: Task): string {
  if (!t.is_active) return 'idle'
  if (t.last_run_status === 'running') return 'running'
  if (t.cron_expr || t.next_run_at) return 'scheduled'
  return 'idle'
}

function repoLabel(repoPath: string): string {
  return repoPath.split(/[\\/]/).filter(Boolean).pop() ?? repoPath
}

export default function Dashboard() {
  const qc = useQueryClient()
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.tasks.list,
    refetchInterval: 5_000,
  })

  const runNow = useMutation({
    mutationFn: (id: string) => api.tasks.runNow(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      if (result.skipped) {
        alert('Saltado — la ventana de Claude para esta tarea ya está abierta.')
      }
    },
  })
  const toggle = useMutation({
    mutationFn: (id: string) => api.tasks.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  if (isLoading) {
    return <div className="text-gray-500 text-sm">Cargando...</div>
  }

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center mb-4">
          <Calendar size={28} className="text-violet-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-200 mb-1">Aún no hay tareas</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm">
          Crea tu primera tarea o usa <code className="text-violet-400 bg-gray-900 px-1 rounded">/remind</code> desde
          cualquier sesión de Claude Code.
        </p>
        <Link to="/tasks/new" className="btn-primary">
          <Plus size={16} /> Crear tarea
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tareas</h1>
        <Link to="/tasks/new" className="btn-primary text-sm">
          <Plus size={16} /> Nueva tarea
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tasks.map(task => {
          const status = taskStatus(task)
          return (
            <div key={task.id}
              className="group rounded-lg bg-gray-900/50 border border-gray-800 hover:border-gray-700
                         hover:bg-gray-900 transition-colors p-4 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-100 truncate">{task.name}</div>
                  {task.prompt && (
                    <div className="text-xs text-gray-400 line-clamp-2 mt-1" title={task.prompt}>
                      {task.prompt}
                    </div>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
                <div className="flex items-center gap-1.5" title={task.repo_path}>
                  <Folder size={12} className="text-gray-500" />
                  <span className="font-mono truncate max-w-[12ch]">{repoLabel(task.repo_path)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {task.cron_expr ? (
                    <>
                      <Repeat size={12} className="text-gray-500" />
                      <span title={task.cron_expr}>{humanizeCron(task.cron_expr)}</span>
                    </>
                  ) : task.next_run_at ? (
                    <>
                      <Calendar size={12} className="text-gray-500" />
                      <span>{formatAbs(task.next_run_at)}</span>
                    </>
                  ) : (
                    <span className="text-gray-600">Sin horario</span>
                  )}
                </div>
                {task.last_run_at && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-gray-500" />
                    <span>Última: {formatRelative(task.last_run_at)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-gray-800 pt-3 -mx-4 px-4 -mb-4 pb-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => runNow.mutate(task.id)}
                    disabled={runNow.isPending}
                    title="Ejecutar ahora"
                    className="icon-btn hover:text-green-400">
                    <Play size={16} />
                  </button>
                  <Link to={`/tasks/${task.id}/logs`} title="Ver logs" className="icon-btn">
                    <FileText size={16} />
                  </Link>
                  <Link to={`/tasks/${task.id}/edit`} title="Editar" className="icon-btn">
                    <Pencil size={16} />
                  </Link>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggle.mutate(task.id)}
                    title={task.is_active ? 'Desactivar' : 'Activar'}
                    className={`icon-btn ${task.is_active ? 'hover:text-yellow-400' : 'hover:text-violet-400'}`}>
                    {task.is_active ? <Pause size={16} /> : <Power size={16} />}
                  </button>
                  <button onClick={() => {
                      if (confirm(`¿Eliminar "${task.name}"?`)) del.mutate(task.id)
                    }}
                    title="Eliminar"
                    className="icon-btn hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
