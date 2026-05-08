import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import db, { DATA_DIR } from '../db.js'
import type { Run } from '../types.js'

const router = Router()

router.get('/:id', (req, res) => {
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(req.params.id)
  if (!run) return res.status(404).json({ error: 'Not found' })
  res.json(run)
})

router.get('/:id/log', (req, res) => {
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(req.params.id) as Run | undefined
  if (!run) return res.status(404).json({ error: 'Not found' })

  const logPath = path.join(DATA_DIR, 'logs', run.task_id, `${run.id}.json`)
  if (!fs.existsSync(logPath)) return res.status(404).json({ error: 'Log not found' })

  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'))
  res.json(log)
})

router.post('/:id/open-folder', (req, res) => {
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(req.params.id) as Run | undefined
  if (!run) return res.status(404).json({ error: 'Not found' })

  const logDir = path.join(DATA_DIR, 'logs', run.task_id)
  try {
    execSync(`explorer.exe "${logDir}"`)
    res.json({ ok: true })
  } catch {
    res.json({ ok: true })  // explorer often returns non-zero even on success
  }
})

export default router
