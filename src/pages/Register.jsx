import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerWithEmail, loginWithGoogle } from '../firebase/auth'
import { TrendingUp, Mail, Lock, User } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handle = (fn) => async () => {
    setError(''); setLoading(true)
    try { await fn(); navigate('/dashboard') }
    catch (err) { setError(getErrorMessage(err.code)) }
    finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault(); setError('')
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 6)  { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    setLoading(true)
    try { await registerWithEmail(email, password, name); navigate('/dashboard') }
    catch (err) { setError(getErrorMessage(err.code)) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-slide-up">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center shadow-xl shadow-brand-500/30">
            <TrendingUp size={26} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">MyBonus</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Crée ton compte gratuitement</p>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-2xl space-y-4">

          <form onSubmit={handleRegister} className="space-y-3">
            <Field icon={<User size={15} />} type="text" placeholder="Prénom ou pseudo"
              value={name} onChange={e => setName(e.target.value)} required />
            <Field icon={<Mail size={15} />} type="email" placeholder="Adresse email"
              value={email} onChange={e => setEmail(e.target.value)} required />
            <Field icon={<Lock size={15} />} type="password" placeholder="Mot de passe (6 min)"
              value={password} onChange={e => setPassword(e.target.value)} required />
            <Field icon={<Lock size={15} />} type="password" placeholder="Confirmer le mot de passe"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />

            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 mt-1">
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-zinc-600 text-xs">ou continuer avec</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          {/* Social */}
          <button onClick={handle(loginWithGoogle)} disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 bg-surface-muted hover:bg-zinc-700 border border-surface-border rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-50">
            <GoogleIcon />Continuer avec Google
          </button>

          <p className="text-center text-xs text-zinc-600 pt-1">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Se connecter
            </Link>
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
      <input {...props}
        className="w-full bg-surface-muted border border-surface-border rounded-xl py-3 pl-9 pr-4 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all text-white" />
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}


function getErrorMessage(code) {
  const m = {
    'auth/email-already-in-use':    'Cet email est déjà utilisé.',
    'auth/invalid-email':           'Email invalide.',
    'auth/weak-password':           'Mot de passe trop faible.',
    'auth/popup-closed-by-user':    'Connexion annulée.',
    'auth/cancelled-popup-request': 'Connexion annulée.',
  }
  return m[code] || 'Une erreur est survenue.'
}
