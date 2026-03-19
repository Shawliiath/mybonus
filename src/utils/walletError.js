/**
 * walletError.js
 * Classifie les erreurs wallet en messages clairs.
 *
 * Cas particulier : sur Safari/iOS, un 429 de CoinGecko déclenche une erreur CORS
 * avec le message "Load failed" — indiscernable d'une vraie erreur réseau.
 * On utilise un compteur de "Load failed" consécutifs : si ≥ 2 en moins de 30s,
 * on assume que c'est du rate-limit (le réseau fonctionne mais l'API nous bloque).
 */

const _loadFails = { count: 0, lastTs: 0 }

function trackLoadFail() {
  const now = Date.now()
  if (now - _loadFails.lastTs > 30_000) _loadFails.count = 0 // reset si > 30s sans erreur
  _loadFails.count++
  _loadFails.lastTs = now
  return _loadFails.count
}

export function classifyWalletError(e) {
  const msg = (e?.message ?? '').toLowerCase()

  // Explicitement rate-limit
  if (msg.includes('429') || msg.includes('rate-limit') || msg.includes('too many') || msg === 'rate-limit' || msg === 'backoff') {
    _loadFails.count = 0
    return {
      type: 'rate-limit',
            text: 'Trop de requêtes — patiente quelques secondes puis réessaie.',
      sub:  'Les données précédentes sont affichées si disponibles.',
    }
  }

  // "Load failed" = CORS block, probablement causé par un 429
  if (msg === 'load failed' || msg.includes('load failed')) {
    const count = trackLoadFail()
    if (count >= 2) {
      return {
        type: 'rate-limit',
                text: 'Trop de requêtes vers l\'API — patiente quelques secondes puis réessaie.',
        sub:  'Les données précédentes sont affichées si disponibles.',
      }
    }
    // Premier "Load failed" isolé : peut être réseau
    return {
      type: 'network',
            text: 'Impossible de joindre le serveur. Vérifie ta connexion.',
      sub:  null,
    }
  }

  // Vrai timeout ou coupure réseau
  if (
    msg.includes('timeout') || msg.includes('aborted') || msg.includes('abort') ||
    msg.includes('failed to fetch') || msg.includes('networkerror') ||
    msg.includes('network') || msg.includes('connexion')
  ) {
    return {
      type: 'network',
            text: 'Pas de connexion réseau. Vérifie ta connexion internet.',
      sub:  null,
    }
  }

  // Provider indisponible
  if (msg.includes('rpc') || msg.includes('helius') || msg.includes('blockstream') || msg.includes('blockscout')) {
    return {
      type: 'provider',
            text: 'Le fournisseur de données est temporairement indisponible.',
      sub:  'Réessaie dans un moment.',
    }
  }

  return {
    type: 'generic',
        text: 'Erreur lors du chargement du wallet.',
    sub:  'Réessaie dans un moment.',
  }
}
