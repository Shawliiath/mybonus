import { AlertTriangle } from 'lucide-react'

export default function ConfirmDialog({ open, onConfirm, onCancel, title, message, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-sm shadow-2xl animate-slide-up p-6 text-center">
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">{title}</h3>
        <p className="text-sm text-zinc-500 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-surface-muted hover:opacity-80 border border-surface-border rounded-xl py-2.5 text-sm font-medium transition-all text-zinc-700 dark:text-zinc-300">Annuler</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-xl py-2.5 text-sm transition-all disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
