import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, getDocs,
  serverTimestamp, getDoc, setDoc,
} from 'firebase/firestore'
import { db } from './config'

export async function addEntry(userId, entry) {
  const ref = collection(db, 'users', userId, 'entries')
  return addDoc(ref, { ...entry, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
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
    constraints.push(where('weekStart', '>=', new Date(filters.year, 0, 1).toISOString()))
    constraints.push(where('weekStart', '<=', new Date(filters.year, 11, 31).toISOString()))
  }
  const snap = await getDocs(query(ref, ...constraints))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getUserPreferences(userId) {
  const snap = await getDoc(doc(db, 'users', userId))
  return snap.exists() ? snap.data().preferences : null
}

export async function updateUserPreferences(userId, preferences) {
  return updateDoc(doc(db, 'users', userId), { preferences })
}
