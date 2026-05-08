import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import './db.js'  // initialize DB
import { initScheduler } from './services/scheduler.js'
import tasksRouter from './routes/tasks.js'
import runsRouter from './routes/runs.js'
import healthRouter from './routes/health.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT ?? '3333', 10)
const IS_PROD = process.env.NODE_ENV === 'production'

const app = express()

app.use(express.json())

app.use('/api/tasks', tasksRouter)
app.use('/api/runs', runsRouter)
app.use('/api/health', healthRouter)

if (IS_PROD) {
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`[server] Running on http://localhost:${PORT}`)
  if (!IS_PROD) console.log('[server] Dev mode — use Vite on :5173 for the UI')
  initScheduler()
})
