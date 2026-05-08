import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type CreateTaskInput } from '../http.ts'
import CronBuilder from '../components/CronBuilder.tsx'

export default function TaskForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id

  const { data: existing } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.tasks.get(id!),
    enabled: isEdit,
  })

  const [form, setForm] = useState<CreateTaskInput>({
    name: '',
    repo_path: '',
    prompt: '',
    session_id: '',
    cron_expr: undefined,
    next_run_at: undefined,
    is_active: 1,
  })

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        repo_path: existing.repo_path,
        prompt: existing.prompt ?? '',
        session_id: existing.session_id ?? '',
        cron_expr: existing.cron_expr ?? undefined,
        next_run_at: existing.next_run_at ?? undefined,
        is_active: existing.is_active,
      })
    }
  }, [existing])

  const save = useMutation({
    mutationFn: () => {
      const payload: CreateTaskInput = {
        ...form,
        session_id: form.session_id?.trim() || undefined,
        prompt: form.prompt?.trim() || undefined,
      }
      return isEdit ? api.tasks.update(id!, payload) : api.tasks.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      navigate('/')
    },
  })

  const field = (key: keyof CreateTaskInput) => ({
    value: (form[key] ?? '') as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <form
      onSubmit={e => { e.preventDefault(); save.mutate() }}
      className="max-w-2xl space-y-6"
    >
      <h1 className="text-lg font-semibold">{isEdit ? 'Editar tarea' : 'Nueva tarea'}</h1>

      {save.isError && (
        <div className="rounded-md bg-red-900/40 border border-red-800 px-4 py-2 text-sm text-red-300">
          {(save.error as Error).message}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input {...field('name')} required placeholder="my-task" className="input-field" />
        </div>

        <div>
          <label className="label">Ruta del repo</label>
          <input
            {...field('repo_path')}
            required
            placeholder="C:\Users\you\repos\my-project"
            className="input-field font-mono text-sm"
          />
        </div>

        <div>
          <label className="label">Prompt <span className="text-gray-500 font-normal">(opcional)</span></label>
          <textarea
            {...field('prompt')}
            rows={3}
            placeholder="Continúa con el modelo V5, revisa los resultados de la última evaluación..."
            className="input-field resize-none"
          />
        </div>

        <div>
          <label className="label">
            Session ID{' '}
            <span className="text-gray-500 font-normal">
              (opcional — déjalo vacío para usar <code className="text-xs bg-gray-800 px-1 rounded">--continue</code>)
            </span>
          </label>
          <input
            {...field('session_id')}
            placeholder="abc123def456..."
            className="input-field font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Ejecuta <code className="bg-gray-800 px-1 rounded">claude --resume</code> en el repo para un picker interactivo,
            o mira los ficheros JSONL en <code className="bg-gray-800 px-1 rounded">~/.claude/projects/</code>.
          </p>
        </div>

        <div>
          <label className="label">Horario</label>
          <CronBuilder
            cronExpr={form.cron_expr ?? ''}
            nextRunAt={form.next_run_at ?? ''}
            onChange={(cron_expr, next_run_at) =>
              setForm(prev => ({
                ...prev,
                cron_expr: cron_expr ?? undefined,
                next_run_at: next_run_at ?? undefined,
              }))
            }
          />
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, is_active: prev.is_active ? 0 : 1 }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.is_active ? 'bg-violet-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-400">Activa</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={save.isPending} className="btn-primary">
          {save.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear tarea'}
        </button>
        <button type="button" onClick={() => navigate('/')} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  )
}
