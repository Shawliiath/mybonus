export function computeStats(entries, expenses = []) {
  // Les entrées "pending" sont exclues des calculs stats
  const confirmed = entries.filter(e => e.status !== 'pending')

  const totalDeposit  = confirmed.reduce((s, e) => s + (e.deposit || 0), 0)
  const totalProfit   = confirmed.reduce((s, e) => s + (e.profit  || 0), 0)
  const totalExpenses = expenses.reduce((s, e)  => s + (e.amount  || 0), 0)
  const netProfit     = totalProfit - totalExpenses
  const avgRoi        = totalDeposit ? (netProfit / totalDeposit) * 100 : 0
  const sorted        = [...confirmed].sort((a, b) => (b.profit || 0) - (a.profit || 0))
  const wins          = confirmed.filter(e => (e.profit || 0) >= 0).length

  if (!confirmed.length) return {
    totalDeposit: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0,
    avgRoi: 0, bestWeek: null, worstWeek: null, winRate: 0, weekCount: 0,
    pendingCount: entries.filter(e => e.status === 'pending').length,
  }

  return {
    totalDeposit,
    totalProfit,
    totalExpenses,
    netProfit,
    avgRoi,
    bestWeek:     sorted[0]                  || null,
    worstWeek:    sorted[sorted.length - 1]  || null,
    winRate:      (wins / confirmed.length) * 100,
    weekCount:    confirmed.length,
    pendingCount: entries.filter(e => e.status === 'pending').length,
  }
}

export function fmt(value, currency = '€', decimals = 2) {
  const n = Number(value)
  if (isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' ' + currency
}

export function fmtNoSign(value, currency = '€', decimals = 2) {
  const n = Number(value)
  if (isNaN(n)) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' ' + currency
}

export function lastN(entries, n = 16) {
  // Exclure les pending du graphique aussi
  return [...entries]
    .filter(e => e.status !== 'pending')
    .sort((a, b) => a.weekStart?.localeCompare(b.weekStart))
    .slice(-n)
}
