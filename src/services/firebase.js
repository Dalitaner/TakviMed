import { initializeApp } from "firebase/app";
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
// WKWebView'da IndexedDB tabanlı oturum saklama kilitlenebildiği için
// localStorage'ı önceliyoruz; signInWithEmailAndPassword aksi halde asılı kalıyor.
export const auth = initializeAuth(firebaseApp, {
  persistence: [browserLocalPersistence, indexedDBLocalPersistence],
});
// WKWebView (Capacitor iOS) WebChannel akışını düzgün taşıyamadığı için
// Firestore'u long-polling'e zorluyoruz; aksi halde istekler asılı kalıyor.
export const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
});
export const functions = getFunctions(firebaseApp, "europe-west1");