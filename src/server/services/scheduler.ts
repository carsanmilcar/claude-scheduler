import cron from 'node-cron'
import db from '../db.js'
import { triggerTask } from './runner.js'
import type { Task } from '../types.js'

const jobs = new Map<string, cron.ScheduledTask>()
// Tracks which one-shot task IDs are "armed" (waiting for the minute poller to fire them)
const armedOneshots = new Set<string>()

export function initScheduler(): void {
  const tasks = db.prepare('SELECT * FROM tasks WHERE is_active = 1').all() as unknown as Task[]
  for (const task of tasks) {
    scheduleTask(task)
  }

  // Single cron that checks one-shot tasks every minute — avoids setTimeout 32-bit overflow
  cron.schedule('* * * * *', () => {
    if (armedOneshots.size === 0) return
    const now = new Date().toISOString()
    const due = db.prepare(`
      SELECT * FROM tasks
      WHERE id IN (${[...armedOneshots].map(() => '?').join(',')})
        AND is_active = 1
        AND next_run_at <= ?
    `).all(...armedOneshots, now) as unknown as Task[]

    for (const task of due) {
      console.log(`[scheduler] Firing one-shot: ${task.name}`)
      armedOneshots.delete(task.id)
      try { triggerTask(task.id) } catch (e) { console.error(e) }
      db.prepare(`UPDATE tasks SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(task.id)
    }
  })

  console.log(`[scheduler] Loaded ${tasks.length} active tasks`)
}

export function scheduleTask(task: Task): void {
  cancelTask(task.id)
  if (!task.is_active) return

  if (task.cron_expr) {
    if (!cron.validate(task.cron_expr)) {
      console.warn(`[scheduler] Invalid cron for "${task.name}": ${task.cron_expr}`)
      return
    }
    const job = cron.schedule(task.cron_expr, () => {
      console.log(`[scheduler] Firing recurring: ${task.name}`)
      try { triggerTask(task.id) } catch (e) { console.error(e) }
    })
    jobs.set(task.id, job)
    console.log(`[scheduler] Scheduled recurring "${task.name}" (${task.cron_expr})`)
  } else if (task.next_run_at) {
    const fireAt = new Date(task.next_run_at)
    if (fireAt <= new Date()) {
      console.log(`[scheduler] One-shot "${task.name}" is in the past, deactivating`)
      db.prepare(`UPDATE tasks SET is_active = 0 WHERE id = ?`).run(task.id)
      return
    }
    armedOneshots.add(task.id)
    console.log(`[scheduler] Armed one-shot "${task.name}" for ${task.next_run_at}`)
  }
}

export function cancelTask(taskId: string): void {
  const job = jobs.get(taskId)
  if (job) { job.stop(); jobs.delete(taskId) }
  armedOneshots.delete(taskId)
}

export function getActiveJobCount(): number {
  return jobs.size + armedOneshots.size
}
