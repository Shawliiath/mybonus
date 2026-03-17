import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, getDocs,
  serverTimestamp, getDoc, setDoc,
} from 'firebase/firestore'
import { db } from './config'

// ─── Entries ────────────────────────────────────────────────────────────────

export async function addEntry(userId, entry) {
  const ref = collection(db, 'users', userId, 'entries')
  return addDoc(ref, { ...entry, type: 'entry', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export async function updateEntry(userId, entryId, data) {
  const ref = doc(db, 'users', userId, 'entries', entryId)
  return updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
}

export async function deleteEntry(userId, entryId) {
  return deleteDoc(doc(db, 'users', userId, 'entries', entryId))
}

export async function getEntries(userId, filters = {}) {
  const ref = collection(db, 'users', userId, 'entries')
  const constraints = [orderBy('weekStart', 'desc')]
  if (filters.year) {
    constraints.push(where('weekStart', '>=', `${filters.year}-01-01`))
    constraints.push(where('weekStart', '<=', `${filters.year}-12-31`))
  }
  const snap = await getDocs(query(ref, ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── Expenses (sorties) ──────────────────────────────────────────────────────

export async function addExpense(userId, expense) {
  const ref = collection(db, 'users', userId, 'expenses')
  return addDoc(ref, { ...expense, type: 'expense', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export async function updateExpense(userId, expenseId, data) {
  const ref = doc(db, 'users', userId, 'expenses', expenseId)
  return updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
}

export async function deleteExpense(userId, expenseId) {
  return deleteDoc(doc(db, 'users', userId, 'expenses', expenseId))
}

export async function getExpenses(userId, filters = {}) {
  const ref = collection(db, 'users', userId, 'expenses')
  const constraints = [orderBy('date', 'desc')]
  if (filters.year) {
    constraints.push(where('date', '>=', `${filters.year}-01-01`))
    constraints.push(where('date', '<=', `${filters.year}-12-31`))
  }
  const snap = await getDocs(query(ref, ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── User / Preferences ──────────────────────────────────────────────────────

export async function getUserData(userId) {
  const snap = await getDoc(doc(db, 'users', userId))
  return snap.exists() ? snap.data() : null
}

export async function updateUserPreferences(userId, preferences) {
  return updateDoc(doc(db, 'users', userId), { preferences })
}

// ─── Bankroll ────────────────────────────────────────────────────────────────

export async function updateBankroll(userId, amount) {
  return updateDoc(doc(db, 'users', userId), {
    'bankroll.amount': amount,
    'bankroll.updatedAt': serverTimestamp(),
  })
}

export async function getBankroll(userId) {
  const snap = await getDoc(doc(db, 'users', userId))
  return snap.exists() ? (snap.data().bankroll || { amount: 0 }) : { amount: 0 }
}

// ─── Share token (mode lecture seule) ────────────────────────────────────────

export async function setShareToken(userId, token) {
  return updateDoc(doc(db, 'users', userId), { shareToken: token })
}

export async function getUserByShareToken(token) {
  const snap = await getDocs(query(collection(db, 'users'), where('shareToken', '==', token)))
  if (snap.empty) return null
  const userDoc = snap.docs[0]
  const entries  = await getDocs(query(collection(db, 'users', userDoc.id, 'entries'), orderBy('weekStart', 'desc')))
  const expenses = await getDocs(query(collection(db, 'users', userDoc.id, 'expenses'), orderBy('date', 'desc')))
  return {
    user:     userDoc.data(),
    entries:  entries.docs.map(d  => ({ id: d.id,  ...d.data()  })),
    expenses: expenses.docs.map(d => ({ id: d.id,  ...d.data()  })),
  }
}
