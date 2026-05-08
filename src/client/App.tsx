import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, LayoutGrid } from 'lucide-react'
import Dashboard from './pages/Dashboard.tsx'
import TaskForm from './pages/TaskForm.tsx'
import LogViewer from './pages/LogViewer.tsx'
import { api } from './http.ts'

function Nav() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30_000,
  })

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'
    }`

  return (
    <header className="border-b border-gray-800 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-violet-400 tracking-tight">Claude Scheduler</span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={linkCls}>
              <LayoutGrid size={14} /> Dashboard
            </NavLink>
            <NavLink to="/tasks/new" className={linkCls}>
              <Plus size={14} /> Nueva tarea
            </NavLink>
          </nav>
        </div>
        {health && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
            {health.activeJobs} programada{health.activeJobs !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks/new" element={<TaskForm />} />
            <Route path="/tasks/:id/edit" element={<TaskForm />} />
            <Route path="/tasks/:id/logs" element={<LogViewer />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
