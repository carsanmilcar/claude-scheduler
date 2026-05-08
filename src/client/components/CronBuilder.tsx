import { useState, useEffect, useMemo } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'date-fns/locale'
import { CronExpressionParser } from 'cron-parser'
import cronstrue from 'cronstrue/i18n'
import { Calendar, Repeat, Clock } from 'lucide-react'
import 'react-day-picker/dist/style.css'

type ScheduleType = 'none' | 'once' | 'daily' | 'weekly' | 'custom'

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const SHORT_DATE = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
})
const formatLong = (d: Date) => SHORT_DATE.format(d)

function parseCronToType(expr: string | null): ScheduleType {
  if (!expr) return 'none'
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return 'custom'
  const [, , dom, month, dow] = parts
  if (dom === '*' && month === '*' && dow === '*') return 'daily'
  if (dom === '*' && month === '*' && dow !== '*') return 'weekly'
  return 'custom'
}

function timeFromCron(expr: string): string {
  const [min, hour] = expr.trim().split(/\s+/)
  return `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
}

function daysFromCron(expr: string): number[] {
  const dow = expr.trim().split(/\s+/)[4]
  if (dow === '*') return []
  return dow.split(',').map(Number).filter(n => !isNaN(n))
}

function combineDateTime(date: Date | undefined, time: string): Date | null {
  if (!date) return null
  const [hh, mm] = time.split(':')
  const out = new Date(date)
  out.setHours(parseInt(hh) || 0, parseInt(mm) || 0, 0, 0)
  return out
}

function nextFires(cronExpr: string, n: number): Date[] {
  try {
    const it = CronExpressionParser.parse(cronExpr)
    const out: Date[] = []
    for (let k = 0; k < n; k++) out.push(it.next().toDate())
    return out
  } catch { return [] }
}

function humanize(cronExpr: string): string {
  try { return cronstrue.toString(cronExpr, { locale: 'es' }) }
  catch { return '' }
}

const PRESETS: Array<{ label: string; compute: () => Date }> = [
  { label: '+1 hora',  compute: () => { const d = new Date(); d.setHours(d.getHours()+1, 0, 0, 0); return d } },
  { label: '+3 horas', compute: () => { const d = new Date(); d.setHours(d.getHours()+3, 0, 0, 0); return d } },
  { label: 'Mañana 9:00', compute: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(9, 0, 0, 0); return d } },
  { label: 'Próx lunes 9:00', compute: () => {
    const d = new Date()
    const daysUntil = ((1 - d.getDay()) + 7) % 7 || 7
    d.setDate(d.getDate() + daysUntil)
    d.setHours(9, 0, 0, 0)
    return d
  }},
]

interface Props {
  cronExpr: string
  nextRunAt: string
  onChange: (cron_expr: string | null, next_run_at: string | null) => void
}

export default function CronBuilder({ cronExpr, nextRunAt, onChange }: Props) {
  const initType = cronExpr ? parseCronToType(cronExpr) : nextRunAt ? 'once' : 'none'

  const [type, setType] = useState<ScheduleType>(initType)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    nextRunAt ? new Date(nextRunAt) : undefined
  )
  const [time, setTime] = useState(() => {
    if (cronExpr) return timeFromCron(cronExpr)
    if (nextRunAt) {
      const d = new Date(nextRunAt)
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    return '09:00'
  })
  const [days, setDays] = useState<number[]>(() => cronExpr ? daysFromCron(cronExpr) : [1, 2, 3, 4, 5])
  const [custom, setCustom] = useState(cronExpr && parseCronToType(cronExpr) === 'custom' ? cronExpr : '0 9 * * 1-5')

  // Build & propagate the effective schedule
  useEffect(() => {
    const [hh, mm] = time.split(':')
    const min = parseInt(mm) || 0
    const hour = parseInt(hh) || 0

    if (type === 'none') return onChange(null, null)
    if (type === 'once') {
      const dt = combineDateTime(selectedDate, time)
      return onChange(null, dt ? dt.toISOString() : null)
    }
    if (type === 'daily')  return onChange(`${min} ${hour} * * *`, null)
    if (type === 'weekly') {
      const dow = days.length ? [...days].sort().join(',') : '1'
      return onChange(`${min} ${hour} * * ${dow}`, null)
    }
    if (type === 'custom') return onChange(custom.trim() || null, null)
  }, [type, time, days, custom, selectedDate])

  const applyPreset = (d: Date) => {
    setSelectedDate(d)
    setTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)
  }

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  // Effective cron for preview (daily/weekly/custom)
  const effectiveCron = useMemo(() => {
    if (type === 'daily') {
      const [hh, mm] = time.split(':')
      return `${parseInt(mm) || 0} ${parseInt(hh) || 0} * * *`
    }
    if (type === 'weekly') {
      const [hh, mm] = time.split(':')
      const dow = days.length ? [...days].sort().join(',') : '1'
      return `${parseInt(mm) || 0} ${parseInt(hh) || 0} * * ${dow}`
    }
    if (type === 'custom') return custom.trim()
    return null
  }, [type, time, days, custom])

  const fires = useMemo(() => effectiveCron ? nextFires(effectiveCron, 3) : [], [effectiveCron])
  const human = useMemo(() => effectiveCron ? humanize(effectiveCron) : '', [effectiveCron])
  const oncePreview = combineDateTime(selectedDate, time)

  return (
    <div className="space-y-4">
      {/* Type pills */}
      <div className="flex flex-wrap gap-2">
        {(['none', 'once', 'daily', 'weekly', 'custom'] as ScheduleType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              type === t ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'none' ? 'Sin horario' : t === 'once' ? 'Una vez' :
             t === 'daily' ? 'Diaria' : t === 'weekly' ? 'Semanal' : 'Cron'}
          </button>
        ))}
      </div>

      {/* ONCE: presets + calendar + time + preview */}
      {type === 'once' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.label} type="button"
                onClick={() => applyPreset(p.compute())}
                className="preset-chip">
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-6 items-start">
            <div className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
              <DayPicker
                mode="single"
                locale={es as any}
                weekStartsOn={1}
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase tracking-wide font-medium">Hora</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="input-field w-32 font-mono" />
            </div>
          </div>

          {oncePreview && (
            <div className="flex items-start gap-2 rounded-md bg-violet-500/10 border border-violet-500/30 px-3 py-2 text-sm text-violet-200">
              <Calendar size={16} className="mt-0.5 flex-shrink-0" />
              <span>Saltará el <strong className="text-violet-100">{formatLong(oncePreview)}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* DAILY / WEEKLY: time + days + preview */}
      {(type === 'daily' || type === 'weekly') && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 uppercase tracking-wide font-medium">Hora</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="input-field w-32 font-mono" />
          </div>
          {type === 'weekly' && (
            <div className="flex gap-2">
              {DAYS_ES.map((label, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`w-12 h-10 rounded-md text-xs font-medium transition-colors ${
                    days.includes(i) ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CUSTOM */}
      {type === 'custom' && (
        <div className="space-y-1">
          <input type="text" value={custom} onChange={e => setCustom(e.target.value)}
            placeholder="0 9 * * 1-5"
            className="input-field font-mono" />
          <p className="text-xs text-gray-500">Cron estándar: minuto hora día mes día-semana</p>
        </div>
      )}

      {/* Recurring preview */}
      {(type === 'daily' || type === 'weekly' || type === 'custom') && effectiveCron && fires.length > 0 && (
        <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-violet-300">
            <Repeat size={14} />
            <span>{human || effectiveCron}</span>
          </div>
          <div className="space-y-1 pl-6">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Próximas ejecuciones</div>
            {fires.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                <Clock size={12} className="text-gray-500" />
                <span className="font-mono">{formatLong(d)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
