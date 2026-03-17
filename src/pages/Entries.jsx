import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useEntries } from '../hooks/useEntries'
import { computeStats, fmt, fmtNoSign } from '../utils/stats'
import AppLayout from '../components/layout/AppLayout'
import EntriesTable from '../components/entries/EntriesTable'
import EntryModal from '../components/entries/EntryModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { PlusCircle, Filter, Clock } from 'lucide-react'
import { getYear } from 'date-fns'
import clsx from 'clsx'

const CURRENT_YEAR = getYear(new Date())
const YEARS = ['alltime', ...Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)]

export default function Entries() {
  const { userData } = useAuth()
  const currency = userData?.preferences?.currency || '€'
  const [yearFilter, setYearFilter]     = useState(CURRENT_YEAR)
  const [sortOrder, setSortOrder]       = useState('desc')
  const [profitFilter, setProfitFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen]       = useState(false)
  const [editEntry, setEditEntry]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const { entries, loading, add, update, remove } = useEntries(
    yearFilter === 'alltime' ? {} : { year: yearFilter }
  )
  const filtered = useMemo(() => {
    let list = [...entries]
    
    // Filtre par statut
    if (statusFilter === 'pending') list = list.filter(e => e.status === 'pending')
    if (statusFilter === 'completed') list = list.filter(e => e.status === 'completed')
    
    // Filtre par profit (uniquement pour les completed)
    if (profitFilter === 'positive') list = list.filter(e => e.status === 'completed' && e.profit >= 0)
    if (profitFilter === 'negative') list = list.filter(e => e.status === 'completed' && e.profit < 0)
    
    list.sort((a, b) => sortOrder === 'desc' ? b.weekStart?.localeCompare(a.weekStart) : a.weekStart?.localeCompare(b.weekStart))
    return list
  }, [entries, profitFilter, statusFilter, sortOrder])
  
  const stats = useMemo(() => computeStats(filtered), [filtered])

  const handleDeleteConfirm = async () => {
    setDeleting(true); await remove(deleteTarget.id); setDeleting(false); setDeleteTarget(null)
  }

  const filterBtn = (active) => clsx(
    'px-2.5 sm:px-3 py-1.5 transition-all text-xs whitespace-nowrap',
    active ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
  )

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Historique</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {filtered.length} entrée{filtered.length !== 1 ? 's' : ''}
              {stats.pendingCount > 0 && (
                <span className="ml-2 text-orange-500">· {stats.pendingCount} en attente</span>
              )}
            </p>
          </div>
          <button onClick={() => { setEditEntry(null); setModalOpen(true) }}
            className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl px-4 py-2 text-sm transition-all shadow-lg shadow-brand-500/25">
            <PlusCircle size={16} />Ajouter
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
            <Filter size={13} /><span>Filtres</span>
          </div>
          
          {/* Year filter */}
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value === 'alltime' ? 'alltime' : Number(e.target.value))}
            className="w-full sm:w-auto bg-surface-muted border border-surface-border rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500/60 transition-all">
            {YEARS.map(y => <option key={y} value={y}>{y === 'alltime' ? '🗓 Alltime' : y}</option>)}
          </select>
          
          {/* Status filter */}
          <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden overflow-x-auto">
            {[{v:'all',l:'Tout'},{v:'completed',l:'✓ Complété'},{v:'pending',l:'⏱ En attente'}].map(({v,l}) => (
              <button key={v} onClick={() => setStatusFilter(v)} className={filterBtn(statusFilter === v)}>{l}</button>
            ))}
          </div>
          
          {/* Profit filter */}
          <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden overflow-x-auto">
            {[{v:'all',l:'Tout'},{v:'positive',l:'✓ Positifs'},{v:'negative',l:'✗ Négatifs'}].map(({v,l}) => (
              <button 
                key={v} 
                onClick={() => setProfitFilter(v)} 
                disabled={statusFilter === 'pending'}
                className={clsx(filterBtn(profitFilter === v), statusFilter === 'pending' && 'opacity-40 cursor-not-allowed')}
              >
                {l}
              </button>
            ))}
          </div>
          
          {/* Sort filter */}
          <div className="flex rounded-xl bg-surface-muted border border-surface-border overflow-hidden overflow-x-auto">
            {[{v:'desc',l:'↓ Récent'},{v:'asc',l:'↑ Ancien'}].map(({v,l}) => (
              <button key={v} onClick={() => setSortOrder(v)} className={filterBtn(sortOrder === v)}>{l}</button>
            ))}
          </div>
        </div>

        {/* Pending alert */}
        {stats.pendingCount > 0 && statusFilter !== 'completed' && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-orange-500 flex-shrink-0" />
              <span className="text-orange-600 dark:text-orange-400 text-xs sm:text-sm">
                {stats.pendingCount} entrée{stats.pendingCount > 1 ? 's' : ''} en attente · Dépôt : {fmtNoSign(stats.pendingDeposit, currency)}
              </span>
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && statusFilter !== 'pending' && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Dépôt', value: fmtNoSign(stats.totalDeposit, currency), color: 'text-blue-500 dark:text-blue-400' },
              { label: 'Profit', value: fmt(stats.totalProfit, currency), color: stats.totalProfit >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500' },
              { label: 'ROI', value: `${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(2)}%`, color: stats.avgRoi >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-card border border-surface-border rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-center">
                <p className="text-xs text-zinc-500 mb-1">{label}</p>
                <p className={clsx('font-mono font-semibold text-xs sm:text-sm', color)}>{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-5 overflow-hidden">
          <EntriesTable 
            entries={filtered} 
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