import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useEntries } from '../hooks/useEntries'
import { computeStats, fmt, fmtNoSign, lastN } from '../utils/stats'
import AppLayout from '../components/layout/AppLayout'
import KpiCard from '../components/dashboard/KpiCard'
import { ProfitAreaChart, DepositProfitBarChart, ChartCard } from '../components/dashboard/Charts'
import EntriesTable from '../components/entries/EntriesTable'
import EntryModal from '../components/entries/EntryModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TrendingUp, TrendingDown, Wallet, Star, PlusCircle, CalendarDays, Percent, Trophy, Download, Clock, Target } from 'lucide-react'
import { getYear, format, getMonth, getYear as getYearFromDate } from 'date-fns'
import { fr } from 'date-fns/locale'

const CURRENT_YEAR = getYear(new Date())
const YEARS = ['alltime', ...Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)]

function exportCSV(entries, currency) {
  const header = ['Weekend', 'Statut', 'Dépôt', 'Retrait', 'Profit', 'ROI (%)', 'Note']
  const rows = entries.map(e => {
    const roi = e.status === 'completed' && e.deposit ? ((e.profit / e.deposit) * 100).toFixed(2) : ''
    return [
      e.weekStart, 
      e.status === 'pending' ? 'En attente' : 'Complété',
      e.deposit, 
      e.withdrawal || '',
      e.profit || '', 
      roi, 
      e.note || ''
    ]
  })
  const csv = [header, ...rows].map(r => r.join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `mybonus-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Dashboard() {
  const { userData } = useAuth()
  const currency = userData?.preferences?.currency || '€'
  const [yearFilter, setYearFilter] = useState(CURRENT_YEAR)
  const [chartMode, setChartMode]   = useState('area')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editEntry, setEditEntry]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]     = useState(false)

  const { entries, loading, add, update, remove } = useEntries(
    yearFilter === 'alltime' ? {} : { year: yearFilter }
  )
  const stats     = useMemo(() => computeStats(entries), [entries])
  const chartData = useMemo(() => lastN(entries, 16), [entries])

  // Calculate monthly progress towards goal
  const monthlyGoal = userData?.preferences?.monthlyGoal || 500
  const currentMonth = getMonth(new Date())
  const currentYear = getYearFromDate(new Date())
  
  const monthlyStats = useMemo(() => {
    const monthlyEntries = entries.filter(e => {
      if (!e.weekStart || e.status !== 'completed') return false
      const date = new Date(e.weekStart)
      return getMonth(date) === currentMonth && getYearFromDate(date) === currentYear
    })
    
    const monthlyProfit = monthlyEntries.reduce((sum, e) => sum + (e.profit || 0), 0)
    const progress = monthlyGoal > 0 ? (monthlyProfit / monthlyGoal) * 100 : 0
    
    return {
      profit: monthlyProfit,
      progress: Math.min(progress, 100),
      isComplete: monthlyProfit >= monthlyGoal,
      entriesCount: monthlyEntries.length
    }
  }, [entries, monthlyGoal, currentMonth, currentYear])

  const handleDeleteConfirm = async () => {
    setDeleting(true); await remove(deleteTarget.id); setDeleting(false); setDeleteTarget(null)
  }

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {entries.length} semaine{entries.length !== 1 ? 's' : ''} · <span className="text-zinc-400">{yearFilter === 'alltime' ? 'Toutes les années' : yearFilter}</span>
              {stats.pendingCount > 0 && (
                <span className="ml-2 text-orange-500">· {stats.pendingCount} en attente</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Year filter */}
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value === 'alltime' ? 'alltime' : Number(e.target.value))}
              className="bg-surface-muted border border-surface-border rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500/60 transition-all">
              {YEARS.map(y => <option key={y} value={y}>{y === 'alltime' ? '🗓 Alltime' : y}</option>)}
            </select>

            {/* Export CSV */}
            {entries.length > 0 && (
              <button onClick={() => exportCSV(entries, currency)}
                className="flex items-center gap-2 bg-surface-muted hover:bg-zinc-700 border border-surface-border rounded-xl px-3 py-2 text-sm font-medium transition-all text-zinc-400 hover:text-white ">
                <Download size={15} /><span className="hidden sm:inline">CSV</span>
              </button>
            )}

            {/* Add */}
            <button onClick={() => { setEditEntry(null); setModalOpen(true) }}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl px-4 py-2 text-sm transition-all shadow-lg shadow-brand-500/25 ml-auto">
              <PlusCircle size={16} />Ajouter
            </button>
          </div>
        </div>

        {/* Pending deposits alert */}
        {stats.pendingCount > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  {stats.pendingCount} entrée{stats.pendingCount > 1 ? 's' : ''} en attente
                </p>
                <p className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-0.5 truncate">
                  Dépôt total : {fmtNoSign(stats.pendingDeposit, currency)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Goal Progress */}
        {monthlyGoal > 0 && (
          <div className={`bg-surface-card border rounded-2xl p-4 sm:p-5 ${
            monthlyStats.isComplete 
              ? 'border-green-500/30 bg-green-500/5' 
              : 'border-surface-border'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={16} className={monthlyStats.isComplete ? 'text-green-400' : 'text-brand-400'} />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Objectif {format(new Date(), 'MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <div className="text-right">
                <p className={`text-xl sm:text-2xl font-bold font-mono ${
                  monthlyStats.isComplete ? 'text-green-400' : 'text-brand-400'
                }`}>
                  {fmt(monthlyStats.profit, currency)}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  / {fmtNoSign(monthlyGoal, currency)}
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    monthlyStats.isComplete 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                      : 'bg-gradient-to-r from-brand-500 to-brand-400'
                  }`}
                  style={{ width: `${monthlyStats.progress}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">
                  {monthlyStats.entriesCount} semaine{monthlyStats.entriesCount > 1 ? 's' : ''}
                </span>
                <span className={`font-semibold ${
                  monthlyStats.isComplete ? 'text-green-400' : 'text-brand-400'
                }`}>
                  {monthlyStats.progress.toFixed(0)}%
                  {monthlyStats.isComplete && ' 🎉'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard label="Dépôt total"  value={fmtNoSign(stats.totalDeposit, currency)} icon={Wallet}       color="blue"  sub={`${stats.weekCount} semaines`} loading={loading} />
          <KpiCard label="Profit total" value={fmt(stats.totalProfit, currency)} icon={stats.totalProfit >= 0 ? TrendingUp : TrendingDown} color={stats.totalProfit >= 0 ? 'green' : 'red'} loading={loading} />
          <KpiCard label="ROI moyen"    value={`${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(2)}%`} icon={Percent} color={stats.avgRoi >= 0 ? 'green' : 'red'} loading={loading} />
          <KpiCard label="Win rate"     value={`${stats.winRate.toFixed(0)}%`} icon={Trophy} color="amber" sub={`${entries.filter(e => e.status === 'completed' && e.profit >= 0).length} positifs`} loading={loading} />
        </div>

        {/* Charts */}
        {!loading && chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Évolution du profit"
              actions={
                <div className="flex rounded-lg bg-surface-muted border border-surface-border overflow-hidden text-xs">
                  {['area','bar'].map(m => (
                    <button key={m} onClick={() => setChartMode(m)}
                      className={`px-3 py-1.5 transition-all ${chartMode === m ? 'bg-brand-500/20 text-brand-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      {m === 'area' ? 'Courbe' : 'Barres'}
                    </button>
                  ))}
                </div>
              }>
              {chartMode === 'area' ? <ProfitAreaChart data={chartData} currency={currency} /> : <DepositProfitBarChart data={chartData} currency={currency} />}
            </ChartCard>

            <div className="space-y-4">
              <div className="bg-surface-card border border-brand-500/20 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={15} className="text-amber-400" />
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Meilleure semaine</span>
                </div>
                {stats.bestWeek ? (
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xl sm:text-2xl font-bold font-mono text-brand-400">{fmt(stats.bestWeek.profit, currency)}</p>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <CalendarDays size={11} />{stats.bestWeek.weekStart ? new Date(stats.bestWeek.weekStart).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    {stats.bestWeek.deposit > 0 && <span className="text-xs font-mono bg-brand-500/15 text-brand-400 px-2 py-1 rounded-lg">+{((stats.bestWeek.profit / stats.bestWeek.deposit) * 100).toFixed(2)}%</span>}
                  </div>
                ) : <p className="text-zinc-500 text-sm">—</p>}
              </div>

              <div className="bg-surface-card border border-red-500/20 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={15} className="text-red-400" />
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pire semaine</span>
                </div>
                {stats.worstWeek && stats.worstWeek.id !== stats.bestWeek?.id ? (
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xl sm:text-2xl font-bold font-mono text-red-400">{fmt(stats.worstWeek.profit, currency)}</p>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <CalendarDays size={11} />{stats.worstWeek.weekStart ? new Date(stats.worstWeek.weekStart).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    {stats.worstWeek.deposit > 0 && <span className="text-xs font-mono bg-red-500/15 text-red-400 px-2 py-1 rounded-lg">{((stats.worstWeek.profit / stats.worstWeek.deposit) * 100).toFixed(2)}%</span>}
                  </div>
                ) : <p className="text-zinc-500 text-sm">—</p>}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h3 className="text-sm font-semibold text-zinc-400">
              Entrées — {yearFilter === 'alltime' ? 'Toutes' : yearFilter}
            </h3>
            <button onClick={() => { setEditEntry(null); setModalOpen(true) }} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
              <PlusCircle size={13} /> Ajouter
            </button>
          </div>
          <EntriesTable 
            entries={entries} 
            onEdit={e => { setEditEntry(e); setModalOpen(true) }} 
            onDelete={setDeleteTarget} 
            onValidate={async (entry) => {
              await update(entry.id, { status: 'completed' })
            }}
            currency={currency} 
            loading={loading} 
          />
        </div>
      </div>

      <EntryModal open={modalOpen} onClose={() => { setModalOpen(false); setEditEntry(null) }}
        onSubmit={editEntry ? async d => { await update(editEntry.id, d); setEditEntry(null) } : add} initial={editEntry} />
      <ConfirmDialog open={!!deleteTarget} title="Supprimer ?" message="Cette action est irréversible."
        onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </AppLayout>
  )
}