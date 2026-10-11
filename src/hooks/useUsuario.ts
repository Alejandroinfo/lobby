/** Inicia sesión anónima en Firebase y devuelve el uid del jugador (igual que en Astrolabe). */
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "../firebase/config";

export function useUsuario() {
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u) setUid(u.uid);
        else signInAnonymously(auth).catch((e) => setError(String(e?.message ?? e)));
      }),
    [],
  );

  return { uid, error };
}
