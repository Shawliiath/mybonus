import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getEntries, addEntry, updateEntry, deleteEntry } from '../firebase/firestore'

export function useEntries(filters = {}) {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchEntries = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getEntries(user.uid, filters)
      setEntries(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, JSON.stringify(filters)])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const add    = async (entry) => { await addEntry(user.uid, entry); fetchEntries() }
  const update = async (id, data) => { await updateEntry(user.uid, id, data); fetchEntries() }
  const remove = async (id) => { await deleteEntry(user.uid, id); fetchEntries() }

  return { entries, loading, error, add, update, remove, refresh: fetchEntries }
}
