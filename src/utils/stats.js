export function computeStats(entries, expenses = []) {
  const totalDeposit  = entries.reduce((s, e) => s + (e.deposit || 0), 0)
  const totalProfit   = entries.reduce((s, e) => s + (e.profit  || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const netProfit     = totalProfit - totalExpenses
  const avgRoi        = totalDeposit ? (netProfit / totalDeposit) * 100 : 0
  const sorted        = [...entries].sort((a, b) => (b.profit || 0) - (a.profit || 0))
  const wins          = entries.filter(e => (e.profit || 0) >= 0).length

  if (!entries.length) return {
    totalDeposit: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0,
    avgRoi: 0, bestWeek: null, worstWeek: null, winRate: 0, weekCount: 0,
  }

  return {
    totalDeposit,
    totalProfit,
    totalExpenses,
    netProfit,
    avgRoi,
    bestWeek:  sorted[0]                    || null,
    worstWeek: sorted[sorted.length - 1]   || null,
    winRate:   (wins / entries.length) * 100,
    weekCount: entries.length,
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
  return [...entries].sort((a, b) => a.weekStart?.localeCompare(b.weekStart)).slice(-n)
}
