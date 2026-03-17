import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateUserPreferences, updateBankroll } from '../firebase/firestore'
import AppLayout from '../components/layout/AppLayout'
import { Settings as SettingsIcon, Check, DollarSign, User, Wallet, Target } from 'lucide-react'
import clsx from 'clsx'

const CURRENCIES  = ['€', '$', '£', '₿', 'CHF', 'CAD']
const WEEK_STARTS = [{ value: 'monday', label: 'Lundi' }, { value: 'saturday', label: 'Samedi' }]

export default function Settings() {
  const { user, userData } = useAuth()
  const prefs        = userData?.preferences || {}
  const bankrollData = userData?.bankroll    || { amount: 0 }

  const [currency,      setCurrency]      = useState(prefs.currency     || '€')
  const [weekStart,     setWeekStart]     = useState(prefs.weekStart    || 'monday')
  const [monthlyGoal,   setMonthlyGoal]   = useState(prefs.monthlyGoal != null ? prefs.monthlyGoal.toString() : '')
  const [bankrollInput, setBankrollInput] = useState(bankrollData.amount?.toString() || '0')
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const bankrollAmount = parseFloat(bankrollInput)
    const goalAmount     = parseFloat(monthlyGoal) || 0
    await Promise.all([
      updateUserPreferences(user.uid, { ...prefs, currency, weekStart, monthlyGoal: goalAmount }),
      !isNaN(bankrollAmount) && bankrollAmount !== bankrollData.amount
        ? updateBankroll(user.uid, bankrollAmount)
        : Promise.resolve(),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const btnClass = (active) => clsx(
    'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
    active
      ? 'bg-brand-500/15 border-brand-500/30 text-brand-600 dark:text-brand-400'
      : 'bg-surface-muted border-surface-border text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
  )

  const inputClass = 'w-full bg-surface-muted border border-surface-border rounded-xl py-2.5 pl-10 pr-4 text-sm font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all'

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Paramètres</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Personnalise ton expérience</p>
        </div>

        {/* Profil */}
        <Section icon={User} title="Profil">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xl">
              {(userData?.displayName || user?.displayName || 'U')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">{userData?.displayName || user?.displayName}</p>
              <p className="text-sm text-zinc-500">{user?.email}</p>
            </div>
          </div>
        </Section>

        {/* Bankroll de base */}
        <Section icon={Wallet} title="Bankroll de base">
          <p className="text-xs text-zinc-500 mb-3">
            Ton capital de départ. Les profits s'y ajoutent automatiquement pour calculer ta bankroll totale.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-mono">{currency}</span>
            <input
              type="number" step="0.01" min="0"
              value={bankrollInput}
              onChange={e => setBankrollInput(e.target.value)}
              className={inputClass}
              placeholder="1852.00"
            />
          </div>
        </Section>

        {/* Objectif mensuel */}
        <Section icon={Target} title="Objectif de profit mensuel">
          <p className="text-xs text-zinc-500 mb-3">
            Une barre de progression s'affichera sur le dashboard pour suivre ta progression du mois en cours.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-mono">{currency}</span>
            <input
              type="number" step="0.01" min="0"
              value={monthlyGoal}
              onChange={e => setMonthlyGoal(e.target.value)}
              className={inputClass}
              placeholder="500.00"
            />
          </div>
        </Section>

        {/* Devise */}
        <Section icon={DollarSign} title="Devise principale">
          <p className="text-xs text-zinc-500 mb-3">
            Devise de stockage. Tu peux afficher n'importe quelle autre devise en temps réel depuis le dashboard.
          </p>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map(c => (
              <button key={c} onClick={() => setCurrency(c)} className={clsx(btnClass(currency === c), 'font-mono')}>{c}</button>
            ))}
          </div>
        </Section>

        {/* Début du weekend */}
        <Section icon={SettingsIcon} title="Début du weekend">
          <div className="flex gap-2">
            {WEEK_STARTS.map(ws => (
              <button key={ws.value} onClick={() => setWeekStart(ws.value)} className={btnClass(weekStart === ws.value)}>
                {ws.label}
              </button>
            ))}
          </div>
        </Section>

<div className="flex justify-center">
  <button onClick={handleSave} disabled={saving}
    className={clsx('flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all',
      saved
        ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30'
        : 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25')}>
    {saved ? <><Check size={16} /> Enregistré !</> : saving ? 'Enregistrement…' : 'Sauvegarder'}
  </button>
</div>
      </div>
    </AppLayout>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
      </div>
      {children}
    </div>
  )
}
