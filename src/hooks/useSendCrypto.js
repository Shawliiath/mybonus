/**
 * useSendCrypto
 * ETH : connector.getProvider() + eth_sendTransaction
 *       Deep link Trust Wallet déclenché SYNCHRONIQUEMENT (avant tout await)
 *       pour passer le popup blocker iOS Safari
 * SOL : walletProvider.sendTransaction
 * BTC : walletProvider.sendTransfer
 */
import { useCallback, useState } from 'react'
import { useAccount } from 'wagmi'
import { parseEther, isAddress } from 'viem'
import { useAppKitProvider, useAppKitAccount } from '@reown/appkit/react'
import { useAppKitConnection } from '@reown/appkit-adapter-solana/react'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'

function parseError(e) {
  const msg = (e?.shortMessage ?? e?.message ?? '').toLowerCase()
  if (msg.includes('rejected') || msg.includes('denied') || msg.includes('user rejected'))
    return 'Transaction refusée dans le wallet.'
  if (msg.includes('insufficient') || msg.includes('funds'))
    return 'Solde insuffisant pour couvrir la transaction et les frais.'
  return e?.shortMessage ?? e?.message ?? 'Erreur inconnue'
}

// ─── Hook ETH ─────────────────────────────────────────────────────────────────
export function useSendEth() {
  const [status, setStatus] = useState('idle')
  const [txHash, setTxHash] = useState(null)
  const [error,  setError]  = useState(null)

  const { address, connector } = useAccount()

  const send = useCallback(async (toAddress, amountEth) => {
    setError(null); setStatus('idle'); setTxHash(null)
    if (!isAddress(toAddress))                    { setError('Adresse ETH invalide'); return }
    if (!amountEth || parseFloat(amountEth) <= 0) { setError('Montant invalide'); return }
    if (!address || !connector)                   { setError('Wallet non connecté'); return }

    try {
      setStatus('pending')

      // connector.getProvider() — méthode documentée Trust Wallet developers
      const provider = await connector.getProvider()

      const valueHex = '0x' + parseEther(String(amountEth)).toString(16)

      // Gas estimation
      let gasHex = '0x5208' // 21000 — transfert ETH natif
      try {
        gasHex = await provider.request({
          method: 'eth_estimateGas',
          params: [{ from: address, to: toAddress, value: valueHex }],
        })
      } catch { /* garde 21000 */ }

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from:  address,
          to:    toAddress,
          value: valueHex,
          gas:   gasHex,
          data:  '0x',       // requis par Trust Wallet — sans ce champ la tx est ignorée
        }],
      })

      // Ferme la fenêtre Trust Wallet ouverte si la transaction est passée
      setTxHash(hash)
      setStatus('confirming')

      // Poll confirmation
      const poll = async () => {
        try {
          const receipt = await provider.request({
            method: 'eth_getTransactionReceipt',
            params: [hash],
          })
          if (receipt?.blockHash) { setStatus('confirmed') }
          else setTimeout(poll, 4000)
        } catch { setTimeout(poll, 4000) }
      }
      setTimeout(poll, 5000)

    } catch (e) {
      setError(parseError(e))
      setStatus('error')
    }
  }, [address, connector])

  const reset = useCallback(() => { setStatus('idle'); setTxHash(null); setError(null) }, [])
  return { send, status, txHash, error, isPending: status === 'pending' || status === 'confirming', reset }
}

// ─── Hook SOL ─────────────────────────────────────────────────────────────────
export function useSendSol() {
  const [status, setStatus] = useState('idle')
  const [txHash, setTxHash] = useState(null)
  const [error,  setError]  = useState(null)

  const { walletProvider } = useAppKitProvider('solana')
  const { connection }     = useAppKitConnection()
  const { address }        = useAppKitAccount({ namespace: 'solana' })

  const send = useCallback(async (toAddress, amountSol) => {
    setError(null); setStatus('idle'); setTxHash(null)
    if (!toAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(toAddress.trim()))
      { setError('Adresse Solana invalide'); return }
    if (!amountSol || parseFloat(amountSol) <= 0) { setError('Montant invalide'); return }
    if (!walletProvider || !connection || !address) { setError('Wallet Solana non connecté en mode signer'); return }

    try {
      setStatus('pending')
      const fromPubkey    = new PublicKey(address)
      const toPubkey      = new PublicKey(toAddress.trim())
      const lamports      = Math.round(parseFloat(amountSol) * LAMPORTS_PER_SOL)
      const { blockhash } = await connection.getLatestBlockhash()
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: fromPubkey })
        .add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports }))
      const signature = await walletProvider.sendTransaction(tx, connection)
      setTxHash(signature)
      setStatus('confirming')
      await connection.confirmTransaction(signature, 'confirmed')
      setStatus('confirmed')
    } catch (e) {
      setError(parseError(e))
      setStatus('error')
    }
  }, [walletProvider, connection, address])

  const reset = useCallback(() => { setStatus('idle'); setTxHash(null); setError(null) }, [])
  return { send, status, txHash, error, isPending: status === 'pending' || status === 'confirming', reset }
}

// ─── Hook BTC ─────────────────────────────────────────────────────────────────
export function useSendBtc() {
  const [status, setStatus] = useState('idle')
  const [txHash, setTxHash] = useState(null)
  const [error,  setError]  = useState(null)

  const { walletProvider } = useAppKitProvider('bip122')
  const { address }        = useAppKitAccount({ namespace: 'bip122' })

  const send = useCallback(async (toAddress, amountBtc) => {
    setError(null); setStatus('idle'); setTxHash(null)
    if (!toAddress?.trim())                        { setError('Adresse Bitcoin invalide'); return }
    if (!amountBtc || parseFloat(amountBtc) <= 0) { setError('Montant invalide'); return }
    if (!walletProvider || !address)               { setError('Wallet Bitcoin non connecté en mode signer.'); return }

    try {
      setStatus('pending')
      const satoshis  = Math.round(parseFloat(amountBtc) * 1e8).toString()
      const signature = await walletProvider.sendTransfer({ recipient: toAddress.trim(), amount: satoshis })
      setTxHash(signature)
      setStatus('confirmed')
    } catch (e) {
      setError(parseError(e))
      setStatus('error')
    }
  }, [walletProvider, address])

  const reset = useCallback(() => { setStatus('idle'); setTxHash(null); setError(null) }, [])
  return { send, status, txHash, error, isPending: status === 'pending', reset }
}
