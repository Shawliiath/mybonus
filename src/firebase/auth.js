import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from './config'

export async function registerWithEmail(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName })
  await createUserDocument(credential.user, { displayName })
  return credential.user
}

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider)
  await createUserDocument(credential.user)
  return credential.user
}

export async function logout() {
  await signOut(auth)
}

async function createUserDocument(user, extraData = {}) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || extraData.displayName || '',
      photoURL:    user.photoURL || null,
      createdAt:   serverTimestamp(),
      preferences: {
        theme:       'dark',
        currency:    'EUR',
        weekStart:   'monday',
        accentColor: 'green',
      },
    })
  }
}
