import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { scheduleTask, cancelTask } from '../services/scheduler.js'
import { triggerTask } from '../services/runner.js'
import type { Task, CreateTaskBody } from '../types.js'

const router = Router()

const asTask = (row: unknown) => row as Task

router.get('/', (_req, res) => {
  const tasks = db.prepare(`
    SELECT t.*,
      (SELECT started_at FROM runs WHERE task_id = t.id ORDER BY started_at DESC LIMIT 1) as last_run_at,
      (SELECT status    FROM runs WHERE task_id = t.id ORDER BY started_at DESC LIMIT 1) as last_run_status
    FROM tasks t
    ORDER BY t.created_at DESC
  `).all()
  res.json(tasks)
})

router.post('/', (req, res) => {
  const body = req.body as CreateTaskBody
  if (!body.name?.trim()) return res.status(400).json({ error: 'name is required' })
  if (!body.repo_path?.trim()) return res.status(400).json({ error: 'repo_path is required' })

  const id = uuidv4()
  db.prepare(`
    INSERT INTO tasks (id, name, repo_path, prompt, session_id, cron_expr, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.name.trim(),
    body.repo_path.trim(),
    body.prompt?.trim() ?? '',
    body.session_id?.trim() || null,
    body.cron_expr?.trim() || null,
    body.next_run_at || null,
  )

  const task = asTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id))
  scheduleTask(task)
  res.status(201).json(task)
})

router.get('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ error: 'Not found' })
  res.json(task)
})

router.put('/:id', (req, res) => {
  const body = req.body as Partial<CreateTaskBody> & { is_active?: number }
  const existing = asTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id))
  if (!existing) return res.status(404).json({ error: 'Not found' })

  db.prepare(`
    UPDATE tasks SET
      name        = ?,
      repo_path   = ?,
      prompt      = ?,
      session_id  = ?,
      cron_expr   = ?,
      next_run_at = ?,
      is_active   = ?,
      updated_at  = datetime('now')
    WHERE id = ?
  `).run(
    body.name?.trim()        ?? existing.name,
    body.repo_path?.trim()   ?? existing.repo_path,
    body.prompt?.trim()      ?? existing.prompt,
    body.session_id?.trim()  || null,
    body.cron_expr?.trim()   || null,
    body.next_run_at         ?? existing.next_run_at,
    body.is_active           ?? existing.is_active,
    req.params.id,
  )

  const updated = asTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id))
  cancelTask(req.params.id)
  scheduleTask(updated)
  res.json(updated)
})

router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ error: 'Not found' })
  cancelTask(req.params.id)
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

router.patch('/:id/toggle', (req, res) => {
  const task = asTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id))
  if (!task) return res.status(404).json({ error: 'Not found' })

  const newActive = task.is_active ? 0 : 1
  db.prepare(`UPDATE tasks SET is_active = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newActive, req.params.id)

  const updated = asTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id))
  if (newActive) {
    scheduleTask(updated)
  } else {
    cancelTask(req.params.id)
  }
  res.json(updated)
})

router.post('/:id/run', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!task) return res.status(404).json({ error: 'Not found' })

  try {
    const result = triggerTask(req.params.id)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id/runs', (req, res) => {
  const runs = db.prepare(`
    SELECT * FROM runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 100
  `).all(req.params.id)
  res.json(runs)
})

export default router
