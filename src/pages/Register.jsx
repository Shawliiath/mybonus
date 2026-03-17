import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerWithEmail, loginWithGoogle } from '../firebase/auth'
import { TrendingUp, Mail, Lock, User } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault(); setError('')
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 6)  { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    setLoading(true)
    try { await registerWithEmail(email, password, name); navigate('/dashboard') }
    catch (err) { setError(getErrorMessage(err.code)) }
    finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setError(''); setLoading(true)
    try { await loginWithGoogle(); navigate('/dashboard') }
    catch (err) { setError(getErrorMessage(err.code)) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-600/8 rounded-full blur-3xl" />
      </div>
      <div className="w-full max-w-md relative animate-slide-up">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
            <TrendingUp size={20} className="text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">MyBonus</span>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl">
          <h1 className="text-center text-xl font-semibold mb-1">Créer un compte</h1>
          <p className="text-center text-zinc-500 text-sm mb-8">Commence à tracker tes performances</p>
          <button onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-surface-muted hover:bg-zinc-700 border border-surface-border rounded-xl py-3 px-4 text-sm font-medium transition-all mb-6 disabled:opacity-50">
            <GoogleIcon />Continuer avec Google
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-zinc-600 text-xs">ou</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            <Field icon={<User size={16} />} type="text" placeholder="Prénom ou pseudo" value={name} onChange={e => setName(e.target.value)} required />
            <Field icon={<Mail size={16} />} type="email" placeholder="adresse@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            <Field icon={<Lock size={16} />} type="password" placeholder="Mot de passe (6 min)" value={password} onChange={e => setPassword(e.target.value)} required />
            <Field icon={<Lock size={16} />} type="password" placeholder="Confirmer le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl py-3 transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50">
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
          <p className="text-center text-sm text-zinc-500 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ icon, ...props }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>
      <input {...props} className="w-full bg-surface-muted border border-surface-border rounded-xl py-3 pl-10 pr-4 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all" />
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

function getErrorMessage(code) {
  const m = { 'auth/email-already-in-use': 'Cet email est déjà utilisé.', 'auth/invalid-email': 'Email invalide.', 'auth/weak-password': 'Mot de passe trop faible.', 'auth/popup-closed-by-user': 'Connexion annulée.' }
  return m[code] || 'Une erreur est survenue.'
}
