import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { logout } from '../../firebase/auth'
import { TrendingUp, LayoutDashboard, PlusCircle, List, Settings, LogOut, Menu, X, ChevronRight, Sun, Moon } from 'lucide-react'
import clsx from 'clsx'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/entries',   icon: List,             label: 'Historique' },
  { to: '/add',       icon: PlusCircle,       label: 'Ajouter' },
  { to: '/settings',  icon: Settings,         label: 'Paramètres' },
]

export default function AppLayout({ children }) {
  const { user, userData } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const initial = (userData?.displayName || user?.displayName || 'U')[0].toUpperCase()
  const isDark = theme === 'dark'

  const handleLogout = async () => { await logout(); navigate('/login') }

  const NavItems = ({ onClick }) => NAV.map(({ to, icon: Icon, label }) => (
    <NavLink key={to} to={to} onClick={onClick}
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
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-md shadow-brand-500/30">
            <TrendingUp size={16} className="text-white" />
          </div>
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
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center"><TrendingUp size={14} className="text-white" /></div>
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

      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 min-h-screen">{children}</main>
    </div>
  )
}
