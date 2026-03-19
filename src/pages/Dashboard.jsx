import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useEntries } from '../hooks/useEntries'
import { useExpenses } from '../hooks/useExpenses'
import { useCurrencyRates } from '../hooks/useCurrency'
import { updateBankroll } from '../firebase/firestore'
import { computeStats, fmt, fmtNoSign, lastN } from '../utils/stats'
import AppLayout from '../components/layout/AppLayout'
import KpiCard from '../components/dashboard/KpiCard'
import BankrollCard from '../components/dashboard/BankrollCard'
import { ProfitAreaChart, DepositProfitBarChart, ChartCard } from '../components/dashboard/Charts'
import EntriesTable from '../components/entries/EntriesTable'
import EntryModal from '../components/entries/EntryModal'
import ExpenseModal from '../components/entries/ExpenseModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import CryptoSummaryCard from '../components/dashboard/CryptoSummaryCard'
import {
  TrendingUp, TrendingDown, Star, PlusCircle,
  CalendarDays, Percent, Trophy, Download, ArrowUpCircle, RefreshCw
} from 'lucide-react'
import { getYear, format } from 'date-fns'
import clsx from 'clsx'

const CURRENT_YEAR = getYear(new Date())
const YEARS = ['alltime', ...Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)]
const CURRENCIES = ['€', '$', '£', 'CHF', 'CAD']

function exportCSV(entries, expenses, currency) {
  const header = ['Type', 'Date', 'Dépôt', 'Profit/Montant', 'ROI (%)', 'Catégorie', 'Note']
  const entryRows = entries.map(e => {
    const roi = e.deposit ? ((e.profit / e.deposit) * 100).toFixed(2) : ''
    return ['Entrée', e.weekStart, e.deposit, e.profit, roi, '', e.note || '']
  })
  const expenseRows = expenses.map(e => ['Sortie', e.date, '', -e.amount, '', e.category, e.note || ''])
  const csv = [header, ...entryRows, ...expenseRows].map(r => r.join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `mybonus-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Dashboard() {
  const { user, userData } = useAuth()
  const storedCurrency = userData?.preferences?.currency || '€'
  const bankrollData   = userData?.bankroll || { amount: 0 }
  const monthlyGoal    = userData?.preferences?.monthlyGoal || 0

  const [yearFilter,   setYearFilter]   = useState('alltime')
  const [chartMode,    setChartMode]    = useState('area')
  const [viewCurrency, setViewCurrency] = useState(null)
  const [entryModal,   setEntryModal]   = useState(false)
  const [editEntry,    setEditEntry]    = useState(null)
  const [expenseModal, setExpenseModal] = useState(false)
  const [editExpense,  setEditExpense]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteType,   setDeleteType]   = useState('entry')
  const [deleting,     setDeleting]     = useState(false)

  const displayCurrency = viewCurrency || storedCurrency
  const filtersArg = yearFilter === 'alltime' ? {} : { year: yearFilter }

  const { entries,  loading: loadingEntries,  add: addEntry,   update: updateEntry,   remove: removeEntry }   = useEntries(filtersArg)
  const { expenses, loading: loadingExpenses, add: addExpense, update: updateExpense, remove: removeExpense } = useExpenses(filtersArg)
  const loading = loadingEntries || loadingExpenses

  const { convert, error: ratesError } = useCurrencyRates('€')

  const convertedEntries = useMemo(() => {
    if (displayCurrency === '€' || !convert) return entries
    return entries.map(e => ({
      ...e,
      deposit: convert(e.deposit, '€', displayCurrency),
      profit:  convert(e.profit,  '€', displayCurrency),
    }))
  }, [entries, storedCurrency, displayCurrency, convert])

  const convertedExpenses = useMemo(() => {
    if (displayCurrency === '€' || !convert) return expenses
    return expenses.map(e => ({
      ...e,
      amount: convert(e.amount, '€', displayCurrency),
    }))
  }, [expenses, storedCurrency, displayCurrency, convert])

  const convertedBankroll = useMemo(() => {
    if (displayCurrency === '€' || !convert) return bankrollData.amount
    return convert(bankrollData.amount, '€', displayCurrency)
  }, [bankrollData.amount, storedCurrency, displayCurrency, convert])

  const convertedGoal = useMemo(() => {
    if (!monthlyGoal) return 0
    if (displayCurrency === '€' || !convert) return monthlyGoal
    return convert(monthlyGoal, '€', displayCurrency)
  }, [monthlyGoal, storedCurrency, displayCurrency, convert])

  const stats     = useMemo(() => computeStats(convertedEntries, convertedExpenses), [convertedEntries, convertedExpenses])
  const chartData = useMemo(() => lastN(convertedEntries, 16), [convertedEntries])

  const currentMonthProfit = useMemo(() => {
    const now = new Date()
    const m = now.getMonth()
    const y = now.getFullYear()
    return convertedEntries
      .filter(e => e.status !== 'pending')
      .filter(e => {
        if (!e.weekStart) return false
        const d = new Date(e.weekStart)
        return d.getMonth() === m && d.getFullYear() === y
      })
      .reduce((s, e) => s + (e.profit || 0), 0)
  }, [convertedEntries])

  const goalPct = convertedGoal > 0 ? Math.min((currentMonthProfit / convertedGoal) * 100, 100) : 0

  const handleBankrollUpdate = async (amount) => { await updateBankroll(user.uid, amount) }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    if (deleteType === 'entry') await removeEntry(deleteTarget.id)
    else                         await removeExpense(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto space-y-5 sm:space-y-6 animate-fade-in">

        {/* Header — ligne 1 : titre + actions principales */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
              <p className="text-zinc-500 text-sm mt-0.5">
                {entries.length} semaine{entries.length !== 1 ? 's' : ''}
                {expenses.length > 0 && ` · ${expenses.length} sortie${expenses.length !== 1 ? 's' : ''}`}
                {' · '}<span className="text-zinc-400">{yearFilter === 'alltime' ? 'Alltime' : yearFilter}</span>
              </p>
            </div>
            {/* Boutons principaux — toujours visibles */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => { setEditExpense(null); setExpenseModal(true) }}
                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl px-3 py-2 text-sm transition-all">
                <ArrowUpCircle size={15} />Sortie
              </button>
              <button onClick={() => { setEditEntry(null); setEntryModal(true) }}
                className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl px-3 py-2 text-sm transition-all shadow-lg shadow-brand-500/25">
                <PlusCircle size={15} />Ajouter
              </button>
            </div>
          </div>

          {/* Ligne 2 : filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden text-xs">
              {CURRENCIES.map(c => (
                <button key={c} onClick={() => setViewCurrency(c === storedCurrency ? null : c)}
                  className={clsx('px-2 py-1.5 transition-all font-mono',
                    (viewCurrency || storedCurrency) === c ? 'bg-brand-500/20 text-brand-400' : 'text-zinc-500 hover:text-zinc-300')}>
                  {c}
                </button>
              ))}
            </div>
            <select value={yearFilter}
              onChange={e => setYearFilter(e.target.value === 'alltime' ? 'alltime' : Number(e.target.value))}
              className="bg-surface-muted border border-surface-border rounded-xl px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500/60 transition-all">
              {YEARS.map(y => <option key={y} value={y}>{y === 'alltime' ? 'Alltime' : y}</option>)}
            </select>
            {(entries.length > 0 || expenses.length > 0) && (
              <button onClick={() => exportCSV(entries, expenses, storedCurrency)}
                className="flex items-center gap-1.5 bg-surface-muted hover:bg-zinc-700 border border-surface-border rounded-xl px-3 py-1.5 text-sm transition-all text-zinc-400 hover:text-white">
                <Download size={14} />CSV
              </button>
            )}
          </div>
        </div>

        {/* Objectif mensuel */}
        {convertedGoal > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl px-4 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Trophy size={13} className="text-amber-400" />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Objectif du mois</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-mono">
                <span className={clsx(currentMonthProfit >= 0 ? 'text-brand-400' : 'text-red-400')}>
                  {fmt(currentMonthProfit, displayCurrency)}
                </span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-500">{fmtNoSign(convertedGoal, displayCurrency)}</span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-700', goalPct >= 100 ? 'bg-amber-400' : 'bg-brand-500')}
                style={{ width: `${Math.max(goalPct, 0)}%` }}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">
              {goalPct >= 100
                ? '🎉 Objectif atteint !'
                : `${goalPct.toFixed(0)}% — encore ${fmtNoSign(Math.max(convertedGoal - currentMonthProfit, 0), displayCurrency)}`}
            </p>
          </div>
        )}

        {ratesError && displayCurrency !== storedCurrency && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-sm text-amber-400 flex items-center gap-2">
            <RefreshCw size={13} />{ratesError} — affichage en {storedCurrency}.
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <BankrollCard
            bankroll={{ amount: convertedBankroll }}
            netProfit={stats.netProfit}
            currency={displayCurrency}
            onUpdate={handleBankrollUpdate}
            loading={loading}
          />
          <KpiCard label="Profit brut" value={fmt(stats.totalProfit, displayCurrency)} icon={stats.totalProfit >= 0 ? TrendingUp : TrendingDown} color={stats.totalProfit >= 0 ? 'green' : 'red'} loading={loading} />
          <KpiCard label="Sorties" value={fmtNoSign(stats.totalExpenses, displayCurrency)} icon={ArrowUpCircle} color="red" sub={`${expenses.length} op.`} loading={loading} />
          <KpiCard label="ROI net" value={`${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(2)}%`} icon={Percent} color={stats.avgRoi >= 0 ? 'green' : 'red'} loading={loading} />
          <KpiCard label="Win rate" value={`${stats.winRate.toFixed(0)}%`} icon={Trophy} color="amber" sub={`${convertedEntries.filter(e => e.profit >= 0).length} positifs`} loading={loading} />
        </div>

        {/* Bloc résumé crypto */}
        <CryptoSummaryCard />

        {/* Charts */}
        {!loading && chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4">
            <ChartCard title="Évolution du profit"
              actions={
                <div className="flex rounded-lg bg-surface-muted border border-surface-border overflow-hidden text-xs">
                  {['area', 'bar'].map(m => (
                    <button key={m} onClick={() => setChartMode(m)}
                      className={clsx('px-3 py-1.5 transition-all', chartMode === m ? 'bg-brand-500/20 text-brand-400' : 'text-zinc-500 hover:text-zinc-300')}>
                      {m === 'area' ? 'Courbe' : 'Barres'}
                    </button>
                  ))}
                </div>
              }>
              {chartMode === 'area'
                ? <ProfitAreaChart data={chartData} currency={displayCurrency} />
                : <DepositProfitBarChart data={chartData} currency={displayCurrency} />
              }
            </ChartCard>

            <div className="space-y-4">
              <div className="bg-surface-card border border-brand-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={15} className="text-amber-400" />
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Meilleure entrée</span>
                </div>
                {stats.bestWeek ? (
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold font-mono text-brand-400">{fmt(stats.bestWeek.profit, displayCurrency)}</p>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <CalendarDays size={11} />{stats.bestWeek.weekStart ? new Date(stats.bestWeek.weekStart).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    {stats.bestWeek.deposit > 0 && (
                      <span className="text-xs font-mono bg-brand-500/15 text-brand-400 px-2 py-1 rounded-lg">
                        +{((stats.bestWeek.profit / stats.bestWeek.deposit) * 100).toFixed(2)}%
                      </span>
                    )}
                  </div>
                ) : <p className="text-zinc-500 text-sm">—</p>}
              </div>

              <div className="bg-surface-card border border-red-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={15} className="text-red-400" />
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pire entrée</span>
                </div>
                {stats.worstWeek && stats.worstWeek.id !== stats.bestWeek?.id ? (
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold font-mono text-red-400">{fmt(stats.worstWeek.profit, displayCurrency)}</p>
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <CalendarDays size={11} />{stats.worstWeek.weekStart ? new Date(stats.worstWeek.weekStart).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    {stats.worstWeek.deposit > 0 && (
                      <span className="text-xs font-mono bg-red-500/15 text-red-400 px-2 py-1 rounded-lg">
                        {((stats.worstWeek.profit / stats.worstWeek.deposit) * 100).toFixed(2)}%
                      </span>
                    )}
                  </div>
                ) : <p className="text-zinc-500 text-sm">—</p>}
              </div>
            </div>
          </div>
        )}

        {/* Table entrées */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-zinc-400">
              Entrées — {yearFilter === 'alltime' ? 'Toutes' : yearFilter}
            </h3>
            <button onClick={() => { setEditEntry(null); setEntryModal(true) }}
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
              <PlusCircle size={13} /> Ajouter
            </button>
          </div>
          <EntriesTable
            entries={convertedEntries}
            onEdit={e => { setEditEntry(e); setEntryModal(true) }}
            onDelete={e => { setDeleteTarget(e); setDeleteType('entry') }}
            onConfirm={e => updateEntry(e.id, { status: 'confirmed' })}
            onCancel={e => { setDeleteTarget(e); setDeleteType('entry') }}
            currency={displayCurrency}
            loading={loadingEntries}
          />
        </div>

        {/* Table sorties */}
        {(expenses.length > 0 || loadingExpenses) && (
          <div className="bg-surface-card border border-red-500/15 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <ArrowUpCircle size={14} className="text-red-400" />
                <h3 className="text-sm font-semibold text-zinc-400">
                  Sorties — {yearFilter === 'alltime' ? 'Toutes' : yearFilter}
                </h3>
              </div>
              <button onClick={() => { setEditExpense(null); setExpenseModal(true) }}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                <PlusCircle size={13} /> Ajouter
              </button>
            </div>
            <ExpensesTable
              expenses={convertedExpenses}
              onEdit={e => { setEditExpense(e); setExpenseModal(true) }}
              onDelete={e => { setDeleteTarget(e); setDeleteType('expense') }}
              currency={displayCurrency}
              loading={loadingExpenses}
            />
          </div>
        )}
      </div>

      <EntryModal
        open={entryModal}
        onClose={() => { setEntryModal(false); setEditEntry(null) }}
        onSubmit={editEntry ? async d => { await updateEntry(editEntry.id, d); setEditEntry(null) } : addEntry}
        initial={editEntry}
      />
      <ExpenseModal
        open={expenseModal}
        onClose={() => { setExpenseModal(false); setEditExpense(null) }}
        onSubmit={editExpense ? async d => { await updateExpense(editExpense.id, d); setEditExpense(null) } : addExpense}
        initial={editExpense}
        currency={storedCurrency}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer ?"
        message="Cette action est irréversible."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </AppLayout>
  )
}

// ── Table sorties inline ───────────────────────────────────────────────────

const CAT_LABELS = {
  fees:       { label: 'Frais',   emoji: '💸' },
  withdrawal: { label: 'Retrait', emoji: '🏦' },
  taxes:      { label: 'Impôts',  emoji: '📋' },
  other:      { label: 'Autre',   emoji: '📌' },
}

function ExpensesTable({ expenses, onEdit, onDelete, currency, loading }) {
  if (loading) return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-12 bg-surface-muted rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
      ))}
    </div>
  )
  if (!expenses.length) return (
    <div className="text-center py-10 text-zinc-500">
      <ArrowUpCircle size={28} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">Aucune sortie</p>
    </div>
  )

  const PencilIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  const TrashIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            {['Date', 'Catégorie', 'Montant', 'Note', ''].map(h => (
              <th key={h} className="text-left text-xs text-zinc-500 font-medium py-3 px-3 first:pl-0 last:pr-0 last:text-right">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {expenses.map(exp => {
            const cat = CAT_LABELS[exp.category] || CAT_LABELS.other
            return (
              <tr key={exp.id} className="hover:bg-surface-muted/40 transition-colors group">
                <td className="py-3 px-3 pl-0 text-zinc-400 whitespace-nowrap text-xs">
                  {exp.date ? new Date(exp.date).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td className="py-3 px-3">
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                    {cat.emoji} {cat.label}
                  </span>
                </td>
                <td className="py-3 px-3 font-mono text-red-400 font-semibold whitespace-nowrap">
                  -{exp.amount?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                </td>
                <td className="py-3 px-3 text-zinc-500 max-w-[160px] truncate text-xs">{exp.note || <span className="italic">—</span>}</td>
                <td className="py-3 pr-0 pl-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(exp)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-muted transition-all"><PencilIcon /></button>
                    <button onClick={() => onDelete(exp)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><TrashIcon /></button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
