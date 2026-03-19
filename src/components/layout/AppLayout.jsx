import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { logout } from '../../firebase/auth'
import { LayoutDashboard, List, Settings, LogOut, Menu, X, ChevronRight, Sun, Moon, BarChart2, Wallet, Globe } from 'lucide-react'
import clsx from 'clsx'


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

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/entries',   icon: List,            label: 'Historique' },
  { to: '/analytics', icon: BarChart2,        label: 'Analytics' },
  { to: '/market',    icon: Globe,            label: 'Crypto' },
  { to: '/portfolio', icon: Wallet,           label: 'Wallets' },
  { to: '/settings',  icon: Settings,         label: 'Paramètres' },
]

export default function AppLayout({ children, onNavClick }) {
  const { user, userData } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const initial = (userData?.displayName || user?.displayName || 'U')[0].toUpperCase()
  const isDark = theme === 'dark'

  const handleLogout = async () => { await logout(); navigate('/login') }

  const NavItems = ({ onClick }) => NAV.map(({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} onClick={(e) => {
      if (onNavClick) { e.preventDefault(); onNavClick(to) }
      if (onClick) onClick()
    }}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
        isActive
          ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
          : isDark
            ? 'text-zinc-400 hover:text-white hover:bg-surface-muted'
            : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
      )}>
      {({ isActive }) => (
        <>
          <Icon size={17} className={isActive ? 'text-brand-400' : isDark ? 'text-zinc-500 group-hover:text-zinc-300' : 'text-zinc-400 group-hover:text-zinc-700'} />
          {label}
          {isActive && <ChevronRight size={14} className="ml-auto text-brand-400/50" />}
        </>
      )}
    </NavLink>
  ))

  const sidebarBg = isDark ? 'bg-surface-card border-surface-border' : 'bg-white border-zinc-200'
  const headerBg  = isDark ? 'bg-surface-card border-surface-border' : 'bg-white border-zinc-200'

  return (
    <div className={clsx('min-h-screen flex', isDark ? 'bg-surface' : 'bg-zinc-50')}>

      {/* ── Desktop sidebar ── */}
      <aside className={clsx('hidden lg:flex flex-col w-60 border-r fixed h-full z-20', sidebarBg)}>
        <div className={clsx('flex items-center gap-3 px-5 h-16 border-b', isDark ? 'border-surface-border' : 'border-zinc-200')}>
          <AppLogo size={32} />
          <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white">MyBonus</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1"><NavItems /></nav>

        <div className={clsx('px-3 pb-4 border-t pt-4', isDark ? 'border-surface-border' : 'border-zinc-200')}>
          {/* Theme toggle */}
          <button onClick={toggle}
            className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all mb-2',
              isDark ? 'text-zinc-400 hover:text-white hover:bg-surface-muted' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100')}>
            {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-400" />}
            {isDark ? 'Mode clair' : 'Mode sombre'}
          </button>

          {/* User */}
          <div className={clsx('flex items-center gap-3 px-3 py-2 rounded-xl mb-2', isDark ? 'bg-surface-muted' : 'bg-zinc-100')}>
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">{initial}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate text-zinc-900 dark:text-white">{userData?.displayName || user?.displayName}</p>
              <p className={clsx('text-xs truncate', isDark ? 'text-zinc-600' : 'text-zinc-400')}>{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/5 text-sm transition-all">
            <LogOut size={16} />Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Mobile header ── */}
      <header className={clsx('lg:hidden fixed top-0 left-0 right-0 h-14 border-b flex items-center justify-between px-4 z-20', headerBg)}>
        <div className="flex items-center gap-2">
          <AppLogo size={28} />
          <span className="font-bold tracking-tight text-zinc-900 dark:text-white">MyBonus</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className={clsx('p-2 rounded-lg transition-all', isDark ? 'text-zinc-400 hover:text-white hover:bg-surface-muted' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100')}>
            {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-400" />}
          </button>
          <button onClick={() => setMobileOpen(true)} className={clsx('p-1 transition-colors', isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900')}>
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className={clsx('absolute left-0 top-0 bottom-0 w-64 border-r flex flex-col', sidebarBg)}>
            <div className={clsx('flex items-center justify-between px-5 h-14 border-b', isDark ? 'border-surface-border' : 'border-zinc-200')}>
              <span className="font-bold">MyBonus</span>
              <button onClick={() => setMobileOpen(false)}><X size={20} className="text-zinc-500" /></button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1"><NavItems onClick={() => setMobileOpen(false)} /></nav>
            <div className={clsx('px-3 pb-4 border-t pt-4', isDark ? 'border-surface-border' : 'border-zinc-200')}>
              <button onClick={toggle} className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm mb-2 transition-all', isDark ? 'text-zinc-400 hover:text-white hover:bg-surface-muted' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100')}>
                {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-400" />}
                {isDark ? 'Mode clair' : 'Mode sombre'}
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-zinc-500 hover:text-red-400 text-sm transition-colors"><LogOut size={16} />Déconnexion</button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 min-h-screen overflow-x-hidden w-full">{children}</main>
    </div>
  )
}
