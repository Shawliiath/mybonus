import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useEntries } from '../hooks/useEntries'
import { useExpenses } from '../hooks/useExpenses'
import { useCurrencyRates } from '../hooks/useCurrency'
import { computeStats, fmt, fmtNoSign } from '../utils/stats'
import AppLayout from '../components/layout/AppLayout'
import EntriesTable from '../components/entries/EntriesTable'
import EntryModal from '../components/entries/EntryModal'
import ExpenseModal from '../components/entries/ExpenseModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { PlusCircle, Filter, ArrowUpCircle, TrendingUp } from 'lucide-react'
import { getYear } from 'date-fns'
import clsx from 'clsx'

const CURRENT_YEAR = getYear(new Date())
const YEARS = ['alltime', ...Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)]
const CAT_LABELS = { fees: { label: 'Frais', emoji: '💸' }, withdrawal: { label: 'Retrait', emoji: '🏦' }, taxes: { label: 'Impôts', emoji: '📋' }, other: { label: 'Autre', emoji: '📌' } }

export default function Entries() {
  const { userData } = useAuth()
  const storedCurrency = userData?.preferences?.currency || '€'

  const [yearFilter,    setYearFilter]    = useState('alltime')
  const [sortOrder,     setSortOrder]     = useState('desc')
  const [profitFilter,  setProfitFilter]  = useState('all')
  const [activeTab,     setActiveTab]     = useState('entries') // 'entries' | 'expenses'
  const [entryModal,    setEntryModal]    = useState(false)
  const [editEntry,     setEditEntry]     = useState(null)
  const [expenseModal,  setExpenseModal]  = useState(false)
  const [editExpense,   setEditExpense]   = useState(null)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleteType,    setDeleteType]    = useState('entry')
  const [deleting,      setDeleting]      = useState(false)
  const [viewCurrency,  setViewCurrency]  = useState(null)

  const displayCurrency = viewCurrency || storedCurrency
  const filtersArg = yearFilter === 'alltime' ? {} : { year: yearFilter }

  const { entries,  loading: loadE, add: addEntry,   update: updateEntry,   remove: removeEntry }   = useEntries(filtersArg)
  const { expenses, loading: loadX, add: addExpense, update: updateExpense, remove: removeExpense } = useExpenses(filtersArg)
  const { convert } = useCurrencyRates(storedCurrency)

  const convertedEntries = useMemo(() => {
    if (displayCurrency === storedCurrency || !convert) return entries
    return entries.map(e => ({
      ...e,
      deposit: convert(e.deposit, storedCurrency, displayCurrency),
      profit:  convert(e.profit,  storedCurrency, displayCurrency),
    }))
  }, [entries, storedCurrency, displayCurrency, convert])

  const convertedExpenses = useMemo(() => {
    if (displayCurrency === storedCurrency || !convert) return expenses
    return expenses.map(e => ({
      ...e,
      amount: convert(e.amount, storedCurrency, displayCurrency),
    }))
  }, [expenses, storedCurrency, displayCurrency, convert])

  const filteredEntries = useMemo(() => {
    let list = [...convertedEntries]
    if (profitFilter === 'positive') list = list.filter(e => e.profit >= 0)
    if (profitFilter === 'negative') list = list.filter(e => e.profit < 0)
    list.sort((a, b) => sortOrder === 'desc' ? b.weekStart?.localeCompare(a.weekStart) : a.weekStart?.localeCompare(b.weekStart))
    return list
  }, [convertedEntries, profitFilter, sortOrder])

  const filteredExpenses = useMemo(() => {
    let list = [...convertedExpenses]
    list.sort((a, b) => sortOrder === 'desc' ? b.date?.localeCompare(a.date) : a.date?.localeCompare(b.date))
    return list
  }, [convertedExpenses, sortOrder])

  const stats = useMemo(() => computeStats(filteredEntries, filteredExpenses), [filteredEntries, filteredExpenses])

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    if (deleteType === 'entry') await removeEntry(deleteTarget.id)
    else                         await removeExpense(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const filterBtn = (active) => clsx(
    'px-3 py-1.5 transition-all text-xs',
    active ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
  )

  const CURRENCIES = ['€', '$', '£', 'CHF', 'CAD']

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto space-y-5 sm:space-y-6 animate-fade-in">
        {/* Header ligne 1 : titre + boutons */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Historique</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {filteredEntries.length} entrée{filteredEntries.length !== 1 ? 's' : ''}
              {filteredExpenses.length > 0 && ` · ${filteredExpenses.length} sortie${filteredExpenses.length !== 1 ? 's' : ''}`}
            </p>
          </div>
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

        {/* Filtres ligne 2 */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value === 'alltime' ? 'alltime' : Number(e.target.value))}
            className="bg-surface-muted border border-surface-border rounded-xl px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500/60 transition-all">
            {YEARS.map(y => <option key={y} value={y}>{y === 'alltime' ? 'Alltime' : y}</option>)}
          </select>
          <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden text-xs">
            {[{ v: 'all', l: 'Tout' }, { v: 'positive', l: '✓ Pos' }, { v: 'negative', l: '✗ Nég' }].map(({ v, l }) => (
              <button key={v} onClick={() => setProfitFilter(v)} className={filterBtn(profitFilter === v)}>{l}</button>
            ))}
          </div>
          <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden text-xs">
            {[{ v: 'desc', l: '↓ Récent' }, { v: 'asc', l: '↑ Ancien' }].map(({ v, l }) => (
              <button key={v} onClick={() => setSortOrder(v)} className={filterBtn(sortOrder === v)}>{l}</button>
            ))}
          </div>
          <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden text-xs">
            {CURRENCIES.map(c => (
              <button key={c} onClick={() => setViewCurrency(c === storedCurrency ? null : c)}
                className={clsx('px-2 py-1.5 transition-all font-mono', (viewCurrency || storedCurrency) === c ? 'bg-brand-500/20 text-brand-400' : 'text-zinc-500 hover:text-zinc-300')}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Résumé stats */}
        {!loadE && !loadX && (filteredEntries.length > 0 || filteredExpenses.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Dépôt',    value: fmtNoSign(stats.totalDeposit, displayCurrency),  color: 'text-blue-500 dark:text-blue-400' },
              { label: 'Profit',   value: fmt(stats.totalProfit, displayCurrency),           color: stats.totalProfit >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500' },
              { label: 'Sorties',  value: fmtNoSign(stats.totalExpenses, displayCurrency),  color: 'text-red-500' },
              { label: 'Net',      value: fmt(stats.netProfit, displayCurrency),             color: stats.netProfit >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-zinc-500 mb-1">{label}</p>
                <p className={clsx('font-mono font-semibold text-sm', color)}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Onglets */}
        <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden w-fit">
          <button onClick={() => setActiveTab('entries')}
            className={clsx('px-4 py-2 text-sm font-medium transition-all flex items-center gap-2',
              activeTab === 'entries' ? 'bg-brand-500/20 text-brand-400' : 'text-zinc-500 hover:text-zinc-300')}>
            <TrendingUp size={14} />Entrées ({filteredEntries.length})
          </button>
          <button onClick={() => setActiveTab('expenses')}
            className={clsx('px-4 py-2 text-sm font-medium transition-all flex items-center gap-2',
              activeTab === 'expenses' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500 hover:text-zinc-300')}>
            <ArrowUpCircle size={14} />Sorties ({filteredExpenses.length})
          </button>
        </div>

        {/* Contenu onglet */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          {activeTab === 'entries' ? (
            <EntriesTable
              entries={filteredEntries}
              onEdit={e => { setEditEntry(e); setEntryModal(true) }}
              onDelete={e => { setDeleteTarget(e); setDeleteType('entry') }}
              currency={displayCurrency}
              loading={loadE}
            />
          ) : (
            <ExpensesTableFull
              expenses={filteredExpenses}
              onEdit={e => { setEditExpense(e); setExpenseModal(true) }}
              onDelete={e => { setDeleteTarget(e); setDeleteType('expense') }}
              currency={displayCurrency}
              loading={loadX}
            />
          )}
        </div>
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

function ExpensesTableFull({ expenses, onEdit, onDelete, currency, loading }) {
  const { Pencil, Trash2 } = { Pencil: ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, Trash2: ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> }

  if (loading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-surface-muted rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.2 }} />)}</div>
  if (!expenses.length) return (
    <div className="text-center py-16 text-zinc-400">
      <ArrowUpCircle size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">Aucune sortie pour cette période</p>
    </div>
  )
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
                <td className="py-3.5 px-3 pl-0 text-zinc-400 whitespace-nowrap text-xs font-medium">
                  {exp.date ? new Date(exp.date).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td className="py-3.5 px-3">
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 w-fit">
                    {cat.emoji} {cat.label}
                  </span>
                </td>
                <td className="py-3.5 px-3 font-mono text-red-400 font-semibold whitespace-nowrap">
                  -{exp.amount?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {currency}
                </td>
                <td className="py-3.5 px-3 text-zinc-500 max-w-[200px] truncate text-xs">{exp.note || <span className="italic">—</span>}</td>
                <td className="py-3.5 pr-0 pl-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(exp)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-muted transition-all"><Pencil size={14} /></button>
                    <button onClick={() => onDelete(exp)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
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
