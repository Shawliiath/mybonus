/**
 * SendModal — interface d'envoi crypto
 * Design : bottom sheet sur mobile, centered modal sur desktop
 * Adapté pour Trust Wallet DApp browser + MetaMask + Phantom
 */
import { useState, useCallback, useEffect } from 'react'
import { X, ArrowRight, ExternalLink, CheckCircle2, Loader2, ChevronDown, Copy, Check } from 'lucide-react'
import clsx from 'clsx'
import { useSendEth, useSendSol, useSendBtc } from '../../hooks/useSendCrypto'

// ── Helpers ───────────────────────────────────────────────────────────────────

function explorerUrl(chain, hash) {
  if (chain === 'eth') return `https://etherscan.io/tx/${hash}`
  if (chain === 'sol') return `https://solscan.io/tx/${hash}`
  if (chain === 'btc') return `https://mempool.space/tx/${hash}`
  return '#'
}

function fmtAmount(v, symbol) {
  if (!v && v !== 0) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} ${symbol}`
}

const CHAIN_COLOR = {
  eth: '#627EEA',
  sol: '#9945FF',
  btc: '#F7931A',
}

const CHAIN_LABEL = { eth: 'Ethereum', sol: 'Solana', btc: 'Bitcoin' }
const PLACEHOLDER  = { eth: '0x...', sol: '5eykt4UsFv8...', btc: 'bc1q...' }

// ── Composant principal ────────────────────────────────────────────────────────

export default function SendModal({ chain, symbol, maxAmount, onClose }) {
  const [toAddress, setToAddress] = useState('')
  const [amount,    setAmount]    = useState('')
  const [copied,    setCopied]    = useState(false)

  const eth = useSendEth()
  const sol = useSendSol()
  const btc = useSendBtc()
  const hook = chain === 'eth' ? eth : chain === 'sol' ? sol : btc

  // Ferme sur Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && hook.status !== 'pending') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, hook.status])

  const handleMax = useCallback(() => {
    const margin = chain === 'eth' ? 0.0005 : chain === 'sol' ? 0.001 : 0
    const max    = Math.max(0, maxAmount - margin)
    setAmount(parseFloat(max.toFixed(8)).toString())
  }, [maxAmount, chain])

  const handleReset = useCallback(() => {
    hook.reset()
    setToAddress('')
    setAmount('')
  }, [hook])

  const handleCopyHash = useCallback(() => {
    if (!hook.txHash) return
    navigator.clipboard.writeText(hook.txHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [hook.txHash])

  const isActive  = hook.status === 'pending' || hook.status === 'confirming'
  const isDone    = hook.status === 'confirmed'
  const isError   = hook.status === 'error'
  const canSend   = toAddress.trim().length > 0 && parseFloat(amount) > 0 && !isActive
  const chainColor = CHAIN_COLOR[chain] ?? '#22c55e'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={!isActive ? onClose : undefined}
      />

      {/* Panel — bottom sheet sur mobile, centré sur desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div className="relative w-full sm:max-w-sm bg-surface-card sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl">

          {/* Barre de drag mobile */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-zinc-700" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-border">
            <div className="flex items-center gap-3">
              {/* Indicateur chain */}
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: chainColor, boxShadow: `0 0 8px ${chainColor}88` }}
              />
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Envoyer {symbol}</p>
                <p className="text-xs text-zinc-500">{CHAIN_LABEL[chain]}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={hook.status === 'pending'}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-surface-muted transition-all disabled:opacity-30">
              <X size={16} />
            </button>
          </div>

          {/* Corps */}
          <div className="px-5 py-5 space-y-4">

            {/* État : en cours */}
            {isActive && (
              <div className="rounded-2xl overflow-hidden border border-surface-border">
                <div className="px-4 py-4 flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-surface-border flex items-center justify-center">
                      <Loader2 size={18} className="animate-spin text-zinc-400" />
                    </div>
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface-card animate-pulse"
                      style={{ backgroundColor: chainColor }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {hook.status === 'pending' ? 'En attente de signature' : 'Confirmation en cours'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {hook.status === 'pending'
                        ? 'Ouvre ton wallet et confirme la transaction'
                        : 'Transaction envoyée au réseau'}
                    </p>
                  </div>
                </div>
                {/* Montant envoyé */}
                <div className="px-4 py-3 bg-surface-muted flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Montant</span>
                  <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-white">
                    {fmtAmount(amount, symbol)}
                  </span>
                </div>
                <div className="px-4 py-3 bg-surface-muted border-t border-surface-border flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Vers</span>
                  <span className="text-xs font-mono text-zinc-400 truncate max-w-[180px]">
                    {toAddress.slice(0, 8)}...{toAddress.slice(-6)}
                  </span>
                </div>
                {hook.status === 'confirming' && (
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 border-t border-surface-border text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    Fermer (la transaction continue en arrière-plan)
                  </button>
                )}
              </div>
            )}

            {/* État : confirmé */}
            {isDone && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">Transaction envoyée</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{fmtAmount(amount, symbol)}</p>
                  </div>
                </div>
                {hook.txHash && (
                  <div className="rounded-xl border border-surface-border bg-surface-muted p-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-zinc-500 truncate">
                      {hook.txHash.slice(0, 16)}...{hook.txHash.slice(-8)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={handleCopyHash} className="p-1.5 rounded-lg hover:bg-surface-border transition-colors text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                      <a href={explorerUrl(chain, hook.txHash)} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-surface-border transition-colors text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={handleReset}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-surface-border text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
                    Nouveau transfert
                  </button>
                  <button onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ backgroundColor: chainColor }}>
                    Fermer
                  </button>
                </div>
              </div>
            )}

            {/* État : erreur */}
            {isError && (
              <div className="space-y-3">
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <p className="text-sm text-red-400">{hook.error}</p>
                </div>
                <button onClick={handleReset}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all">
                  Réessayer
                </button>
              </div>
            )}

            {/* Formulaire — masqué pendant les états actifs */}
            {!isActive && !isDone && !isError && (
              <div className="space-y-4">

                {/* Solde disponible */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-zinc-500">Solde disponible</span>
                  <button onClick={handleMax} className="text-xs font-mono text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    {fmtAmount(maxAmount, symbol)}
                  </button>
                </div>

                {/* Montant — champ principal */}
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    className="w-full bg-surface-muted border border-surface-border rounded-2xl px-4 py-4 text-2xl font-mono font-bold text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none transition-all text-center pr-20"
                    style={{ borderColor: amount && parseFloat(amount) > 0 ? chainColor + '66' : undefined }}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-400">{symbol}</span>
                    <button
                      onClick={handleMax}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-surface-border text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors uppercase tracking-wider">
                      Max
                    </button>
                  </div>
                </div>

                {/* Adresse destination */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-500 px-1">Adresse de destination</label>
                  <input
                    type="text"
                    value={toAddress}
                    onChange={e => setToAddress(e.target.value)}
                    placeholder={PLACEHOLDER[chain]}
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-3 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none transition-all"
                    style={{ borderColor: toAddress.length > 10 ? chainColor + '55' : undefined }}
                  />
                </div>

                {/* Note BTC */}
                {chain === 'btc' && (
                  <p className="text-xs text-zinc-500 px-1">
                    L'envoi BTC necessite un wallet connecté en mode signer via WalletConnect.
                  </p>
                )}

                {/* Bouton envoyer */}
                <button
                  onClick={() => hook.send(toAddress, amount)}
                  disabled={!canSend}
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: canSend ? chainColor : undefined,
                    background: canSend ? `linear-gradient(135deg, ${chainColor}, ${chainColor}cc)` : undefined,
                  }}>
                  <ArrowRight size={16} />
                  Envoyer {amount && parseFloat(amount) > 0 ? fmtAmount(amount, symbol) : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
