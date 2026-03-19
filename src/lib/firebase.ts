import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} satisfies Partial<FirebaseOptions>

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
)

export function getFirestoreDb() {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase configuration is incomplete. Copy .env.example to .env.local and fill in your Firestore credentials.',
    )
  }

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp(firebaseConfig as FirebaseOptions)

  return getFirestore(app)
}
