import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import { api, type Run } from '../http.ts'
import StatusBadge from '../components/StatusBadge.tsx'

function formatDuration(start: string, end: string | null) {
  if (!end) return 'corriendo...'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60_000)}m`
}

function RunDetail({ run }: { run: Run }) {
  const { data: log } = useQuery({
    queryKey: ['run-log', run.id],
    queryFn: () => api.runs.log(run.id),
    refetchInterval: run.status === 'running' ? 5_000 : false,
  })

  const openFolder = useMutation({ mutationFn: () => api.runs.openFolder(run.id) })

  if (!log) return <div className="text-gray-500 text-sm p-4">Cargando log...</div>

  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 p-4 space-y-3 text-sm">
      <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
        <div className="text-gray-500">Tarea</div>
        <div className="text-gray-200">{log.taskName}</div>
        <div className="text-gray-500">Inicio</div>
        <div className="text-gray-200">{new Date(log.startedAt).toLocaleString('es-ES')}</div>
        <div className="text-gray-500">Fin</div>
        <div className="text-gray-200">{log.endedAt ? new Date(log.endedAt).toLocaleString('es-ES') : '—'}</div>
        <div className="text-gray-500">Exit code</div>
        <div className={log.exitCode === 0 ? 'text-green-400' : 'text-red-400'}>
          {log.exitCode ?? '—'}
        </div>
        <div className="text-gray-500">Repo</div>
        <div className="text-gray-200 font-mono text-xs break-all">{log.repoPath}</div>
      </div>
      <div>
        <div className="text-gray-500 text-xs mb-1">Comando</div>
        <div className="bg-gray-950 rounded p-2 font-mono text-xs text-violet-300 break-all">
          {log.command}
        </div>
      </div>
      <button
        onClick={() => openFolder.mutate()}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300"
      >
        <FolderOpen size={12} /> Abrir carpeta de logs
      </button>
    </div>
  )
}

export default function LogViewer() {
  const { id } = useParams<{ id: string }>()
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)

  const { data: task } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.tasks.get(id!),
  })

  const { data: runs = [] } = useQuery({
    queryKey: ['runs', id],
    queryFn: () => api.tasks.runs(id!),
    refetchInterval: 5_000,
  })

  useEffect(() => {
    if (runs.length && !selectedRun) setSelectedRun(runs[0])
  }, [runs])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-sm">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <h1 className="text-lg font-semibold">{task?.name ?? 'Logs'}</h1>
      </div>

      {!runs.length && (
        <div className="text-gray-500 text-sm">Aún no hay ejecuciones.</div>
      )}

      <div className="grid grid-cols-[280px_1fr] gap-4">
        <div className="space-y-1">
          {runs.map(run => (
            <button
              key={run.id}
              onClick={() => setSelectedRun(run)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedRun?.id === run.id
                  ? 'bg-gray-800 border border-gray-700'
                  : 'hover:bg-gray-900 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={run.status} />
                <span className="text-xs text-gray-500">
                  {formatDuration(run.started_at, run.ended_at)}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(run.started_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </button>
          ))}
        </div>

        <div>
          {selectedRun ? (
            <RunDetail run={selectedRun} />
          ) : (
            <div className="text-gray-500 text-sm">Selecciona una ejecución para ver detalles.</div>
          )}
        </div>
      </div>
    </div>
  )
}
