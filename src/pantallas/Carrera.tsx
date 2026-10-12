/**
 * Carrera de agente: un rango que sube con las partidas y retos que terminas en el lobby
 * (de cualquier juego), más las condecoraciones que ganaste.
 */
import { useEffect, useState } from "react";
import { logroPorClave } from "../datos/catalogo";
import { leerPerfil } from "../firebase/encuestas";
import type { Carrera as TCarrera } from "../firebase/tipos";
import { useIdioma } from "../i18n";

export const RANGOS = [
  { desde: 0, icono: "🎒" },
  { desde: 3, icono: "🕵️" },
  { desde: 10, icono: "🎖️" },
  { desde: 25, icono: "🏢" },
  { desde: 50, icono: "⭐" },
];

export function rangoDe(partidas: number) {
  let i = 0;
  while (i + 1 < RANGOS.length && partidas >= RANGOS[i + 1].desde) i++;
  return { indice: i, ...RANGOS[i], siguiente: RANGOS[i + 1] ?? null };
}

export function Carrera({ uid, carreraEnVivo }: { uid: string; carreraEnVivo?: TCarrera }) {
  const { t, idioma } = useIdioma();
  const [leida, setLeida] = useState<TCarrera | null>(null);

  useEffect(() => {
    if (carreraEnVivo) return;
    let vivo = true;
    leerPerfil(uid).then((p) => vivo && setLeida(p?.carrera ?? {}));
    return () => {
      vivo = false;
    };
  }, [uid, carreraEnVivo]);

  const carrera = carreraEnVivo ?? leida;
  if (!carrera) return null;
  const partidas = carrera.partidas ?? 0;
  const r = rangoDe(partidas);
  const avance = r.siguiente ? (partidas - r.desde) / (r.siguiente.desde - r.desde) : 1;
  const logros = Object.entries(carrera.logros ?? {})
    .map(([clave, n]) => ({ clave, n, l: logroPorClave(clave) }))
    .filter((x) => x.l && x.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <section className="tarjeta carrera" aria-labelledby="t-carrera">
      <div className="carrera-cabeza">
        <span className="carrera-icono" aria-hidden="true">{r.icono}</span>
        <div>
          <p className="etiqueta" id="t-carrera">{t.tuRango}</p>
          <h2>{t.rangos[r.indice]}</h2>
        </div>
      </div>
      <p className="suave chico-texto">
        {t.carreraResumen(partidas - (carrera.retos ?? 0), carrera.victorias ?? 0, carrera.retos ?? 0)}
        {r.siguiente && <> · {t.proximoRango(r.siguiente.desde - partidas, t.rangos[r.indice + 1])}</>}
      </p>
      <div
        className="progreso"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(avance * 100)}
        aria-label={t.progresoRango}
      >
        <span style={{ width: `${Math.round(avance * 100)}%` }} />
      </div>
      {logros.length > 0 ? (
        <ul className="logros" aria-label={t.condecoraciones}>
          {logros.map(({ clave, n, l }) => (
            <li key={clave} title={idioma === "en" ? l!.en : l!.es}>
              <span aria-hidden="true">{l!.icono}</span> {idioma === "en" ? l!.en : l!.es}
              {n > 1 && <span className="veces">×{n}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="suave chico-texto">{t.sinCondecoraciones}</p>
      )}
    </section>
  );
}
