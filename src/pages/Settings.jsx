import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateUserPreferences } from '../firebase/firestore'
import AppLayout from '../components/layout/AppLayout'
import { Settings as SettingsIcon, Check, DollarSign, User, Calendar, Target, TrendingUp, Bell } from 'lucide-react'
import clsx from 'clsx'

const CURRENCIES = ['€', '$', '£', '₿', 'CHF', 'CAD']
const WEEK_STARTS = [
  { value: 'monday', label: 'Lundi' }, 
  { value: 'saturday', label: 'Samedi' }
]
const DEFAULT_GOALS = [
  { value: 200, label: '200' },
  { value: 500, label: '500' },
  { value: 1000, label: '1000' },
  { value: 2000, label: '2000' },
]
const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Plus récent' },
  { value: 'date-asc', label: 'Plus ancien' },
  { value: 'amount-desc', label: 'Montant ↓' },
  { value: 'amount-asc', label: 'Montant ↑' },
]

export default function Settings() {
  const { user, userData } = useAuth()
  const prefs = userData?.preferences || {}
  
  const [currency, setCurrency] = useState(prefs.currency || '€')
  const [weekStart, setWeekStart] = useState(prefs.weekStart || 'monday')
  const [monthlyGoal, setMonthlyGoal] = useState(prefs.monthlyGoal || 500)
  const [customGoal, setCustomGoal] = useState('')
  const [defaultSort, setDefaultSort] = useState(prefs.defaultSort || 'date-desc')
  const [showNotifications, setShowNotifications] = useState(prefs.showNotifications ?? true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateUserPreferences(user.uid, { 
      currency, 
      weekStart, 
      monthlyGoal: Number(monthlyGoal),
      defaultSort,
      showNotifications
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCustomGoal = () => {
    const value = Number(customGoal)
    if (value > 0) {
      setMonthlyGoal(value)
      setCustomGoal('')
    }
  }

  const btnClass = (active) => clsx(
    'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
    active ? 'bg-brand-500/15 border-brand-500/30 text-brand-600 dark:text-brand-400' : 'bg-surface-muted border-surface-border text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
  )

  const hasChanges = 
    currency !== (prefs.currency || '€') ||
    weekStart !== (prefs.weekStart || 'monday') ||
    monthlyGoal !== (prefs.monthlyGoal || 500) ||
    defaultSort !== (prefs.defaultSort || 'date-desc') ||
    showNotifications !== (prefs.showNotifications ?? true)

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Paramètres</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Personnalise ton expérience</p>
        </div>

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

        <Section icon={DollarSign} title="Devise">
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map(c => (
              <button 
                key={c} 
                onClick={() => setCurrency(c)} 
                className={clsx(btnClass(currency === c), 'font-mono')}
              >
                {c}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Target} title="Objectif mensuel">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {DEFAULT_GOALS.map(g => (
                <button 
                  key={g.value} 
                  onClick={() => setMonthlyGoal(g.value)} 
                  className={btnClass(monthlyGoal === g.value)}
                >
                  {g.label} {currency}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Personnalisé..."
                className="flex-1 px-4 py-2 rounded-xl text-sm bg-surface-muted border border-surface-border text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-brand-500/50"
              />
              <button
                onClick={handleCustomGoal}
                disabled={!customGoal || Number(customGoal) <= 0}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-500/10 border border-brand-500/30 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Définir
              </button>
            </div>
            {monthlyGoal && (
              <p className="text-xs text-zinc-500">
                Objectif actuel : <span className="font-semibold text-brand-600 dark:text-brand-400">{monthlyGoal} {currency}</span>
              </p>
            )}
          </div>
        </Section>

        <Section icon={TrendingUp} title="Tri par défaut des entrées">
          <div className="grid grid-cols-2 gap-2">
            {SORT_OPTIONS.map(opt => (
              <button 
                key={opt.value} 
                onClick={() => setDefaultSort(opt.value)} 
                className={btnClass(defaultSort === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Calendar} title="Début du weekend">
          <div className="flex gap-2">
            {WEEK_STARTS.map(ws => (
              <button 
                key={ws.value} 
                onClick={() => setWeekStart(ws.value)} 
                className={btnClass(weekStart === ws.value)}
              >
                {ws.label}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Bell} title="Notifications">
          <label className="flex items-center justify-between cursor-pointer group">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Afficher les notifications</p>
              <p className="text-xs text-zinc-500">Messages de succès et confirmations</p>
            </div>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={clsx(
                'relative w-12 h-7 rounded-full transition-colors',
                showNotifications ? 'bg-brand-500' : 'bg-zinc-300 dark:bg-zinc-600'
              )}
            >
              <span
                className={clsx(
                  'absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform',
                  showNotifications && 'translate-x-5'
                )}
              />
            </button>
          </label>
        </Section>

        <button 
          onClick={handleSave} 
          disabled={saving || !hasChanges}
          className={clsx(
            'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all w-full justify-center',
            saved 
              ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30' 
              : hasChanges
              ? 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
          )}
        >
          {saved ? (
            <>
              <Check size={16} /> Enregistré !
            </>
          ) : saving ? (
            'Enregistrement…'
          ) : hasChanges ? (
            'Sauvegarder les modifications'
          ) : (
            'Aucune modification'
          )}
        </button>
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
