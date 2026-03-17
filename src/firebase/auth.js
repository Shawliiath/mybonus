import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  OAuthProvider,
  getAdditionalUserInfo,
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
  const result = await signInWithPopup(auth, googleProvider)
  await createUserDocument(result.user)
  return result.user
}

export async function loginWithApple() {
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')

  const result    = await signInWithPopup(auth, provider)
  const user      = result.user
  const info      = getAdditionalUserInfo(result)

  // Apple envoie le profil seulement à la toute première connexion
  const profile      = info?.profile || {}
  const firstName    = profile.given_name  || profile.firstName  || ''
  const lastName     = profile.family_name || profile.lastName   || ''
  const appleDisplayName = [firstName, lastName].filter(Boolean).join(' ').trim()

  if (appleDisplayName && !user.displayName) {
    await updateProfile(user, { displayName: appleDisplayName })
  }

  await createUserDocument(user, { displayName: appleDisplayName || user.displayName })
  return user
}

export async function logout() {
  await signOut(auth)
}

async function createUserDocument(user, extraData = {}) {
  const ref  = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const email       = user.email || extraData.email || ''
    const displayName = user.displayName || extraData.displayName || email.split('@')[0] || 'Utilisateur'
    await setDoc(ref, {
      uid:         user.uid,
      email,
      displayName,
      photoURL:    user.photoURL || null,
      createdAt:   serverTimestamp(),
      preferences: {
        theme:       'dark',
        currency:    '€',
        weekStart:   'monday',
        accentColor: 'green',
      },
      bankroll: {
        amount:    0,
        updatedAt: serverTimestamp(),
      },
    })
  }
}
