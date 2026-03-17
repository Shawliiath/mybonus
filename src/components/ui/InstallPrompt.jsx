import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Vérifier si l'utilisateur a déjà refusé
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) {
        setShowPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Vérifier si déjà installé
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowPrompt(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    console.log(`User response: ${outcome}`)
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showPrompt) return null

  return (
    <div className="fixed left-4 right-4 z-50 animate-slide-up lg:left-auto lg:right-4 lg:max-w-sm mb-safe"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="bg-surface-card border border-brand-500/30 rounded-2xl p-4 shadow-2xl shadow-brand-500/20 backdrop-blur-sm">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={16} />
        </button>
        
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/30">
            <Download size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Installer MyBonus</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Accède rapidement à ton dashboard depuis ton écran d'accueil
            </p>
          </div>
        </div>

        <button
          onClick={handleInstall}
          className="w-full bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-brand-500/25"
        >
          Installer l'app
        </button>
      </div>
    </div>
  )
}
