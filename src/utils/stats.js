export function computeStats(entries) {
  // Les anciennes entrées sans status sont considérées comme "completed"
  const completedEntries = entries.filter(e => !e.status || e.status === 'completed')
  const pendingEntries = entries.filter(e => e.status === 'pending')
  
  if (!completedEntries.length) return { 
    totalDeposit: 0, 
    totalProfit: 0, 
    avgRoi: 0, 
    bestWeek: null, 
    worstWeek: null, 
    winRate: 0, 
    weekCount: 0,
    pendingCount: pendingEntries.length,
    pendingDeposit: pendingEntries.reduce((s, e) => s + (e.deposit || 0), 0)
  }
  
  const totalDeposit = completedEntries.reduce((s, e) => s + (e.deposit || 0), 0)
  const totalProfit  = completedEntries.reduce((s, e) => s + (e.profit  || 0), 0)
  const avgRoi       = totalDeposit ? (totalProfit / totalDeposit) * 100 : 0
  const sorted       = [...completedEntries].sort((a, b) => (b.profit || 0) - (a.profit || 0))
  const wins         = completedEntries.filter(e => (e.profit || 0) >= 0).length
  
  return { 
    totalDeposit, 
    totalProfit, 
    avgRoi, 
    bestWeek: sorted[0] || null, 
    worstWeek: sorted[sorted.length - 1] || null, 
    winRate: (wins / completedEntries.length) * 100, 
    weekCount: completedEntries.length,
    pendingCount: pendingEntries.length,
    pendingDeposit: pendingEntries.reduce((s, e) => s + (e.deposit || 0), 0)
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

export function lastN(entries, n = 12) {
  // Pour les charts, on prend uniquement les completed (y compris anciennes sans status)
  const completedEntries = entries.filter(e => !e.status || e.status === 'completed')
  return [...completedEntries].sort((a, b) => a.weekStart?.localeCompare(b.weekStart)).slice(-n)
}