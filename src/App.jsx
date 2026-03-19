import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { WalletProvider } from './context/WalletContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Entries from './pages/Entries'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'
import SharedView from './pages/SharedView'
import Portfolio from './pages/Portfolio'
import Market from './pages/Market'

function ProtectedApp() {
  return (
    <WalletProvider>
      <ProtectedRoute />
    </WalletProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"        element={<Login />} />
            <Route path="/register"     element={<Register />} />
            <Route path="/share/:token" element={<SharedView />} />
            <Route element={<ProtectedApp />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/entries"   element={<Entries />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/market"    element={<Market />} />
              <Route path="/settings"  element={<Settings />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
