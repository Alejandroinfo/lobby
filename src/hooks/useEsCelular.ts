/** ¿Pantalla de celular? (≤ 640 px: el chat pasa a ser un botón, Amigos se pliega en la sala…) */
import { useEffect, useState } from "react";

const CONSULTA = "(max-width: 640px)";

export function useEsCelular() {
  const [es, setEs] = useState(() => window.matchMedia?.(CONSULTA).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(CONSULTA);
    if (!mq) return;
    const f = () => setEs(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return es;
}
