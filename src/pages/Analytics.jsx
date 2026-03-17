import { useState, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useEntries } from '../hooks/useEntries'
import { useExpenses } from '../hooks/useExpenses'
import { addEntry } from '../firebase/firestore'
import { computeStats, fmt } from '../utils/stats'
import AppLayout from '../components/layout/AppLayout'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO, getYear, getMonth, getWeek, startOfYear, eachWeekOfInterval, endOfYear } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Upload, TrendingUp, Flame } from 'lucide-react'
import clsx from 'clsx'

const CURRENT_YEAR = getYear(new Date())

// ── Heatmap ──────────────────────────────────────────────────────────────────

function Heatmap({ entries, year, currency = '€' }) {
  const [active, setActive] = useState(null)

  const weeks = eachWeekOfInterval(
    { start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) },
    { weekStartsOn: 1 }
  )

  const byWeek = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      if (!e.weekStart) return
      const d = new Date(e.weekStart)
      if (getYear(d) !== year) return
      const key = `${getYear(d)}-W${String(getWeek(d, { weekStartsOn: 1 })).padStart(2, '0')}`
      map[key] = (map[key] || 0) + e.profit
    })
    return map
  }, [entries, year])

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  const getColor = (val) => {
    if (val === undefined) return 'bg-surface-muted'
    if (val > 500)  return 'bg-brand-500'
    if (val > 200)  return 'bg-brand-500/70'
    if (val > 50)   return 'bg-brand-500/40'
    if (val > 0)    return 'bg-brand-500/20'
    if (val < -200) return 'bg-red-500/80'
    if (val < -50)  return 'bg-red-500/50'
    if (val < 0)    return 'bg-red-500/25'
    return 'bg-surface-muted'
  }

  const monthPositions = useMemo(() => {
    const positions = {}
    weeks.forEach((w, i) => {
      const m = getMonth(w)
      if (positions[m] === undefined) positions[m] = i
    })
    return positions
  }, [weeks])

  const fmtVal = (val) => val === undefined
    ? '—'
    : `${val >= 0 ? '+' : ''}${val.toFixed(0)} ${currency}`

  return (
    <div>
      {/* Barre d'info — hover desktop / tap mobile */}
      <div className={clsx(
        'mb-3 px-3 py-2 rounded-xl text-xs font-mono transition-all min-h-[32px] flex items-center',
        active
          ? active.val === undefined
            ? 'bg-surface-muted text-zinc-500'
            : active.val >= 0
              ? 'bg-brand-500/10 border border-brand-500/20 text-brand-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          : 'bg-surface-muted/50 text-zinc-600'
      )}>
        {active
          ? `Sem. ${active.i + 1} · ${format(active.week, 'dd MMM', { locale: fr })} : ${fmtVal(active.val)}`
          : 'Passe sur une semaine pour voir le détail'
        }
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-2">
        <div style={{ minWidth: '520px' }}>
          {/* Labels mois */}
          <div className="flex gap-1 mb-1 text-[10px] text-zinc-600">
            {weeks.map((w, i) => {
              const m = getMonth(w)
              const isFirst = monthPositions[m] === i
              return (
                <div key={i} className="w-3.5 text-center shrink-0">
                  {isFirst ? MONTHS[m] : ''}
                </div>
              )
            })}
          </div>
          {/* Cellules */}
          <div className="flex gap-1">
            {weeks.map((w, i) => {
              const key = `${getYear(w)}-W${String(getWeek(w, { weekStartsOn: 1 })).padStart(2, '0')}`
              const val = byWeek[key]
              const isActive = active?.i === i
              return (
                <div
                  key={i}
                  onMouseEnter={() => setActive({ i, val, week: w })}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => setActive(active?.i === i ? null : { i, val, week: w })}
                  className={clsx(
                    'w-3.5 h-3.5 rounded-sm shrink-0 transition-all cursor-pointer',
                    getColor(val),
                    isActive && 'ring-1 ring-white/40 scale-125'
                  )}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-2 mt-3 text-[10px] text-zinc-600 flex-wrap">
        <span>Moins</span>
        {['bg-red-500/50', 'bg-red-500/25', 'bg-surface-muted', 'bg-brand-500/20', 'bg-brand-500/50', 'bg-brand-500'].map(c => (
          <div key={c} className={clsx('w-3 h-3 rounded-sm shrink-0', c)} />
        ))}
        <span>Plus</span>
      </div>
    </div>
  )
}

// ── Graphique bankroll ────────────────────────────────────────────────────────

function BankrollChart({ entries, baseAmount, currency }) {
  const data = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.weekStart?.localeCompare(b.weekStart))
    let cumul = baseAmount || 0
    return sorted.map(e => {
      cumul += e.profit || 0
      return {
        label:    e.weekStart ? format(parseISO(e.weekStart), 'dd MMM', { locale: fr }) : '',
        bankroll: Math.round(cumul * 100) / 100,
      }
    })
  }, [entries, baseAmount])

  if (!data.length) return <p className="text-zinc-500 text-sm text-center py-8">Pas de données</p>

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="text-zinc-400 mb-1">{label}</p>
        <p className="font-mono font-semibold text-white">
          {payload[0]?.value?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="bankrollGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#232738" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="bankroll" stroke="#22c55e" strokeWidth={2} fill="url(#bankrollGrad)" dot={false}
          activeDot={{ r: 4, fill: '#22c55e', stroke: '#0f1117', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Import CSV ────────────────────────────────────────────────────────────────

function parseCSVImport(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const results = []
  const errors  = []
  lines.forEach((line, i) => {
    const cols = line.split(/[;,]/).map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 3) { errors.push(`Ligne ${i + 1}: pas assez de colonnes`); return }
    const [weekStart, depositRaw, profitRaw, note] = cols
    const deposit = parseFloat(depositRaw.replace(',', '.'))
    const profit  = parseFloat(profitRaw.replace(',', '.'))
    if (!weekStart || isNaN(deposit) || isNaN(profit)) { errors.push(`Ligne ${i + 1}: données invalides`); return }
    if (!/^\d{4}-\d{2}-\d{2}/.test(weekStart)) { errors.push(`Ligne ${i + 1}: date invalide (format YYYY-MM-DD)`); return }
    results.push({ weekStart: weekStart.slice(0, 10), deposit, profit, note: note || '' })
  })
  return { results, errors }
}

function CSVImport({ userId, onDone }) {
  const [status,   setStatus]   = useState('idle')
  const [preview,  setPreview]  = useState([])
  const [errors,   setErrors]   = useState([])
  const [progress, setProgress] = useState(0)
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { results, errors } = parseCSVImport(ev.target.result)
      setPreview(results); setErrors(errors); setStatus('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImport = async () => {
    setStatus('importing')
    for (let i = 0; i < preview.length; i++) {
      await addEntry(userId, preview[i])
      setProgress(Math.round(((i + 1) / preview.length) * 100))
    }
    setStatus('done')
    setTimeout(() => { setStatus('idle'); setPreview([]); onDone?.() }, 2000)
  }

  return (
    <div>
      {status === 'idle' && (
        <div>
          <p className="text-xs text-zinc-500 mb-3">
            Format : <code className="bg-surface-muted px-1.5 py-0.5 rounded text-zinc-300 text-[11px] break-all">YYYY-MM-DD;dépôt;profit;note</code>
            <br />Une ligne par semaine, sans en-tête.
          </p>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-surface-muted hover:bg-zinc-700 border border-surface-border rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all">
            <Upload size={15} />Choisir un fichier CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        </div>
      )}

      {status === 'preview' && (
        <div className="space-y-3">
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 space-y-1">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          {preview.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">{preview.length} ligne{preview.length > 1 ? 's' : ''} à importer :</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-surface-muted rounded-lg px-3 py-2 gap-2">
                    <span className="text-zinc-400 shrink-0">{r.weekStart}</span>
                    <span className="text-zinc-500 hidden sm:block">{r.deposit} dép.</span>
                    <span className={clsx('font-mono shrink-0', r.profit >= 0 ? 'text-brand-400' : 'text-red-400')}>
                      {r.profit >= 0 ? '+' : ''}{r.profit}
                    </span>
                  </div>
                ))}
                {preview.length > 10 && <p className="text-xs text-zinc-600 text-center py-1">… et {preview.length - 10} autres</p>}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleImport}
                  className="flex-1 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl py-2 text-sm transition-all">
                  Importer {preview.length} entrée{preview.length > 1 ? 's' : ''}
                </button>
                <button onClick={() => { setStatus('idle'); setPreview([]); setErrors([]) }}
                  className="px-4 bg-surface-muted border border-surface-border rounded-xl text-sm text-zinc-400">
                  Annuler
                </button>
              </div>
            </div>
          )}
          {preview.length === 0 && errors.length > 0 && (
            <button onClick={() => { setStatus('idle'); setErrors([]) }} className="text-xs text-zinc-500 underline">Réessayer</button>
          )}
        </div>
      )}

      {status === 'importing' && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Import en cours… {progress}%</p>
          <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {status === 'done' && <p className="text-sm text-brand-400">✓ Import terminé !</p>}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Analytics() {
  const { user, userData } = useAuth()
  const currency   = userData?.preferences?.currency || '€'
  const baseAmount = userData?.bankroll?.amount || 0
  const [year, setYear] = useState('alltime')
  const YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i)

  const { entries,  loading: loadE, refresh } = useEntries({})
  const { expenses, loading: loadX }          = useExpenses({})
  const loading = loadE || loadX

  const yearEntries = useMemo(() => {
    const confirmed = entries.filter(e => e.status !== 'pending')
    if (year === 'alltime') return confirmed
    return confirmed.filter(e => e.weekStart && getYear(new Date(e.weekStart)) === year)
  }, [entries, year])

  const stats = useMemo(() => computeStats(yearEntries, []), [yearEntries])

  const streak = useMemo(() => {
    const confirmed = entries.filter(e => e.status !== 'pending')
    const sorted = [...confirmed].sort((a, b) => b.weekStart?.localeCompare(a.weekStart))
    let count = 0
    for (const e of sorted) { if ((e.profit || 0) >= 0) count++; else break }
    return count
  }, [entries])

  const heatmapYear = year === 'alltime' ? CURRENT_YEAR : year

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Analytics</h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Vue approfondie de tes performances</p>
          </div>
          <select value={year} onChange={e => setYear(e.target.value === 'alltime' ? 'alltime' : Number(e.target.value))}
            className="bg-surface-muted border border-surface-border rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none transition-all shrink-0">
            <option value="alltime">Alltime</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div className="bg-surface-card border border-amber-500/20 rounded-2xl px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Flame size={17} className="text-amber-400" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-white font-mono">{streak} semaine{streak > 1 ? 's' : ''} 🔥</p>
              <p className="text-xs text-zinc-500">Streak positif en cours</p>
            </div>
          </div>
        )}

        {/* Stats rapides */}
        {!loading && yearEntries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Semaines',   value: stats.weekCount,  color: 'text-zinc-300' },
              { label: 'Profit net', value: fmt(stats.netProfit, currency), color: stats.netProfit >= 0 ? 'text-brand-400' : 'text-red-400' },
              { label: 'Win rate',   value: `${stats.winRate.toFixed(0)}%`, color: 'text-amber-400' },
              { label: 'ROI moyen',  value: `${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(2)}%`, color: stats.avgRoi >= 0 ? 'text-brand-400' : 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-card border border-surface-border rounded-xl px-3 sm:px-4 py-3 text-center">
                <p className="text-xs text-zinc-500 mb-1">{label}</p>
                <p className={clsx('font-mono font-semibold text-sm', color)}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Évolution de la bankroll */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-brand-400" />
            Évolution de la bankroll
          </h2>
          {loading
            ? <div className="h-48 bg-surface-muted rounded-xl animate-pulse" />
            : <BankrollChart entries={entries.filter(e => e.status !== 'pending')} baseAmount={baseAmount} currency={currency} />
          }
        </div>

        {/* Heatmap */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4">Heatmap {heatmapYear}</h2>
          {loading
            ? <div className="h-12 bg-surface-muted rounded-xl animate-pulse" />
            : <Heatmap entries={entries.filter(e => e.status !== 'pending')} year={heatmapYear} currency={currency} />
          }
        </div>

        {/* Import CSV */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
            <Upload size={14} />Import CSV
          </h2>
          <CSVImport userId={user.uid} onDone={refresh} />
        </div>

      </div>
    </AppLayout>
  )
}
