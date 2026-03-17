import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getExpenses, addExpense, updateExpense, deleteExpense } from '../firebase/firestore'

export function useExpenses(filters = {}) {
  const { user }            = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const fetchExpenses = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getExpenses(user.uid, filters)
      setExpenses(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, JSON.stringify(filters)])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const add    = async (expense) => { try { await addExpense(user.uid, expense);             await fetchExpenses() } catch (err) { throw err } }
  const update = async (id, data) => { try { await updateExpense(user.uid, id, data);        await fetchExpenses() } catch (err) { throw err } }
  const remove = async (id) =>       { try { await deleteExpense(user.uid, id);              await fetchExpenses() } catch (err) { throw err } }

  return { expenses, loading, error, add, update, remove, refresh: fetchExpenses }
}
