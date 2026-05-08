const colors: Record<string, string> = {
  running:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  failed:    'bg-red-500/20 text-red-300 border-red-500/30',
  skipped:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  idle:      'bg-gray-500/20 text-gray-400 border-gray-500/30',
  scheduled: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
}

const labels: Record<string, string> = {
  running:   'corriendo',
  completed: 'completada',
  failed:    'fallida',
  skipped:   'saltada',
  idle:      'inactiva',
  scheduled: 'programada',
}

export default function StatusBadge({ status }: { status: string }) {
  const cls = colors[status] ?? colors.idle
  const label = labels[status] ?? status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}
