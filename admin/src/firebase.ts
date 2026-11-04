import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserSessionPersistence,
  signOut,
} from "firebase/auth";
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
export const firebaseConfigured = Boolean(
  apiKey &&
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
);
export const auth = firebaseConfigured
  ? getAuth(
      initializeApp({
        apiKey,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      }),
    )
  : null;
export async function login() {
  if (!auth) throw new Error("Thiếu cấu hình Firebase public.");
  await setPersistence(auth, browserSessionPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}
export async function logout() {
  if (auth) await signOut(auth);
}
