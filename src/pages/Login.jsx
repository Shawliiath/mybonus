import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginWithEmail, loginWithGoogle } from '../firebase/auth'
import { Mail, Lock } from 'lucide-react'


function AppLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{borderRadius: size * 0.18 + 'px'}}>
      <defs>
        <linearGradient id="lb" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#060a12"/><stop offset="100%" stopColor="#0e1828"/></linearGradient>
        <linearGradient id="lu" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80"/><stop offset="100%" stopColor="#15803d"/></linearGradient>
        <linearGradient id="ld" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185"/><stop offset="100%" stopColor="#be123c"/></linearGradient>
        <linearGradient id="la" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.25"/><stop offset="100%" stopColor="#22c55e" stopOpacity="0"/></linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#lb)"/>
      <path d="M34,365 L68,329 L135,276 L202,268 L269,238 L336,183 L403,160 L465,101 L479,88 L479,415 L34,415 Z" fill="url(#la)"/>
      <path d="M34,365 L68,329 L135,276 L202,268 L269,238 L336,183 L403,160 L465,101 L479,88" fill="none" stroke="#22c55e" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity="0.55"/>
      <line x1="68" y1="300" x2="68" y2="390" stroke="#fb7185" strokeWidth="14"/><rect x="54" y="310" width="28" height="38" rx="3" fill="url(#ld)"/>
      <line x1="135" y1="265" x2="135" y2="380" stroke="#4ade80" strokeWidth="14"/><rect x="121" y="272" width="28" height="92" rx="3" fill="url(#lu)"/>
      <line x1="202" y1="248" x2="202" y2="318" stroke="#fb7185" strokeWidth="14"/><rect x="188" y="255" width="28" height="26" rx="3" fill="url(#ld)"/>
      <line x1="269" y1="178" x2="269" y2="305" stroke="#4ade80" strokeWidth="14"/><rect x="255" y="186" width="28" height="104" rx="3" fill="url(#lu)"/>
      <line x1="336" y1="148" x2="336" y2="248" stroke="#fb7185" strokeWidth="14"/><rect x="322" y="158" width="28" height="52" rx="3" fill="url(#ld)"/>
      <line x1="403" y1="112" x2="403" y2="218" stroke="#4ade80" strokeWidth="14"/><rect x="389" y="120" width="28" height="80" rx="3" fill="url(#lu)"/>
      <line x1="465" y1="72" x2="465" y2="148" stroke="#4ade80" strokeWidth="14"/><rect x="451" y="80" width="28" height="42" rx="3" fill="url(#lu)"/>
      <circle cx="256" cy="462" r="42" fill="#22c55e" fillOpacity="0.08" stroke="#22c55e" strokeWidth="10" strokeOpacity="0.4"/>
      <text x="256" y="478" textAnchor="middle" fontFamily="Georgia, serif" fontSize="54" fontWeight="700" fill="#22c55e" fillOpacity="0.95">&#x20BF;</text>
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handle = (fn) => async () => {
    setError(''); setLoading(true)
    try { await fn(); navigate('/dashboard') }
    catch (err) { setError(getErrorMessage(err.code)) }
    finally { setLoading(false) }
  }

  const handleEmail = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await loginWithEmail(email, password); navigate('/dashboard') }
    catch (err) { setError(getErrorMessage(err.code)) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-slide-up">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <AppLogo size={56} />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">MyBonus</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Connecte-toi à ton espace</p>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-2xl space-y-4">

          {/* Email / password */}
          <form onSubmit={handleEmail} className="space-y-3">
            <Field icon={<Mail size={15} />} type="email" placeholder="Adresse email"
              value={email} onChange={e => setEmail(e.target.value)} required />
            <Field icon={<Lock size={15} />} type="password" placeholder="Mot de passe"
              value={password} onChange={e => setPassword(e.target.value)} required />

            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 mt-1">
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-zinc-600 text-xs">ou continuer avec</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          {/* Social buttons */}
          <button onClick={handle(loginWithGoogle)} disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 bg-surface-muted hover:bg-zinc-700 border border-surface-border rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-50">
            <GoogleIcon />Continuer avec Google
          </button>

          {/* Register link */}
          <p className="text-center text-xs text-zinc-600 pt-1">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              S'inscrire
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
    'auth/user-not-found':     'Aucun compte avec cet email.',
    'auth/wrong-password':     'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/too-many-requests':  'Trop de tentatives. Réessaie plus tard.',
    'auth/popup-closed-by-user': 'Connexion annulée.',
    'auth/cancelled-popup-request': 'Connexion annulée.',
  }
  return m[code] || 'Une erreur est survenue.'
}
