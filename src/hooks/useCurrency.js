import { useState, useEffect, useCallback } from 'react'

// Taux de change en cache mémoire (valide 1h)
const rateCache = { rates: null, base: null, fetchedAt: null }
const CACHE_TTL = 60 * 60 * 1000 // 1h

// API gratuite, sans clé requise
const API_URL = 'https://api.frankfurter.app/latest'

export function useCurrencyRates(baseCurrency = '€') {
  const [rates, setRates]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  // Map symboles → codes ISO
  const toISO = (symbol) => {
    const map = { '€': 'EUR', '$': 'USD', '£': 'GBP', '₿': 'BTC', 'CHF': 'CHF', 'CAD': 'CAD' }
    return map[symbol] || symbol
  }

  const fetchRates = useCallback(async (base) => {
    const isoBase = toISO(base)
    // Vérifier cache
    if (
      rateCache.rates &&
      rateCache.base === isoBase &&
      rateCache.fetchedAt &&
      Date.now() - rateCache.fetchedAt < CACHE_TTL
    ) {
      setRates(rateCache.rates)
      return
    }

    // BTC pas supporté par l'API — taux factices pour l'affichage
    if (isoBase === 'BTC') {
      const btcRates = { EUR: 0.000015, USD: 0.000016, GBP: 0.000012, CHF: 0.000015, CAD: 0.000022 }
      setRates(btcRates)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`${API_URL}?from=${isoBase}`)
      const data = await res.json()
      if (!data.rates) throw new Error('API error')

      // Ajouter BTC approximatif
      const enriched = { ...data.rates, BTC: 0.000015 / (data.rates.EUR || 1) }
      rateCache.rates    = enriched
      rateCache.base     = isoBase
      rateCache.fetchedAt = Date.now()
      setRates(enriched)
    } catch (err) {
      setError('Impossible de récupérer les taux de change.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRates(baseCurrency)
  }, [baseCurrency, fetchRates])

  // Convertit une valeur de fromCurrency vers toCurrency
  const convert = useCallback((value, fromCurrency, toCurrency) => {
    if (!value && value !== 0) return null
    if (fromCurrency === toCurrency) return value
    if (!rates) return value // Pas encore chargé → retourner brut

    const isoFrom = toISO(fromCurrency)
    const isoTo   = toISO(toCurrency)
    const isoBase = toISO(baseCurrency)

    // Calcul via la devise de base
    let valueInBase = value
    if (isoFrom !== isoBase) {
      const rateFromBase = rates[isoFrom]
      if (!rateFromBase) return value
      valueInBase = value / rateFromBase
    }
    if (isoTo === isoBase) return valueInBase
    const rateToBase = rates[isoTo]
    if (!rateToBase) return valueInBase
    return valueInBase * rateToBase
  }, [rates, baseCurrency])

  return { rates, loading, error, convert, refresh: () => fetchRates(baseCurrency) }
}

// Hook simple pour convertir toutes les entrées vers la devise cible
export function useConvertedEntries(entries, fromCurrency, toCurrency, convert) {
  if (!entries || fromCurrency === toCurrency) return entries
  return entries.map(entry => ({
    ...entry,
    deposit: convert(entry.deposit, fromCurrency, toCurrency),
    profit:  convert(entry.profit,  fromCurrency, toCurrency),
    _originalCurrency: fromCurrency,
  }))
}

export function useConvertedExpenses(expenses, fromCurrency, toCurrency, convert) {
  if (!expenses || fromCurrency === toCurrency) return expenses
  return expenses.map(exp => ({
    ...exp,
    amount: convert(exp.amount, fromCurrency, toCurrency),
    _originalCurrency: fromCurrency,
  }))
}
