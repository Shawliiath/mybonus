import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, firebaseUser => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid)
        const unsubDoc = onSnapshot(ref, snap => {
          if (snap.exists()) setUserData(snap.data())
          setLoading(false)
        })
        return () => unsubDoc()
      } else {
        setUserData(null)
        setLoading(false)
      }
    })
    return () => unsubAuth()
  }, [])

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
