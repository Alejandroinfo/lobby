/**
 * Conexión con el proyecto de Firebase del lobby (`lobby-games`).
 *
 * Estos valores no son secretos: identifican el proyecto y van en el código
 * de cualquier página web que use Firebase. Lo que protege los datos son las
 * reglas de `firestore.rules`.
 */
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const config = {
  apiKey: "AIzaSyBYKkH1KULlJNdaLoC0meDju6B0cIV-2uE",
  authDomain: "lobby-games.firebaseapp.com",
  projectId: "lobby-games",
  storageBucket: "lobby-games.firebasestorage.app",
  messagingSenderId: "841353806445",
  appId: "1:841353806445:web:90cd4f5da4e3a0c8b37564",
};

const app = initializeApp(config);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Para probar en tu computadora sin tocar la base real:
// VITE_FIREBASE_EMULADOR=1 en .env.local y `npx firebase-tools emulators:start`.
if (import.meta.env.VITE_FIREBASE_EMULADOR === "1") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
