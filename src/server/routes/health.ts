import { Router } from 'express'
import { DATA_DIR } from '../db.js'
import { getActiveJobCount } from '../services/scheduler.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    activeJobs: getActiveJobCount(),
    dataDir: DATA_DIR,
    uptime: Math.floor(process.uptime()),
  })
})

export default router
