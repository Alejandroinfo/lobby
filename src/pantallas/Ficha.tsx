/**
 * Ficha de otra persona (se abre al tocar su nombre en la sala): avatar, rango, condecoraciones
 * y tu récord contra ella. Si su ficha es privada, solo se ve el récord entre los dos.
 */
import { useEffect, useRef, useState } from "react";
import { logroPorClave } from "../datos/catalogo";
import { avatarPorDefecto, leerFicha } from "../firebase/perfil";
import type { Ficha as TFicha, RivalGuardado } from "../firebase/tipos";
import { useIdioma } from "../i18n";
import { rangoDe } from "./Carrera";
import { AvatarCirculo } from "./PaginaPerfil";
import { BotonAmistad } from "./Amigos";

interface Props {
  uid: string; // de quien es la ficha
  nombre: string;
  /** Tu récord contra esa persona (de tu perfil: no cuesta lecturas). */
  record: RivalGuardado | null;
  alCerrar: () => void;
}

export function FichaJugador({ uid, nombre, record, alCerrar }: Props) {
  const { t, idioma } = useIdioma();
  const [ficha, setFicha] = useState<TFicha | null | undefined>(undefined);
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogo.current?.showModal();
    let vivo = true;
    leerFicha(uid).then((f) => vivo && setFicha(f));
    return () => {
      vivo = false;
    };
  }, [uid]);

  const total = ficha?.partidas ?? 0;
  const logros = Object.entries(ficha?.logros ?? {})
    .map(([clave, n]) => ({ clave, n, l: logroPorClave(clave) }))
    .filter((x) => x.l && x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  return (
    <dialog ref={dialogo} className="ficha" onClose={alCerrar} onClick={(e) => e.target === dialogo.current && dialogo.current?.close()} aria-labelledby="t-ficha">
      <div className="ficha-cabeza">
        <AvatarCirculo avatar={ficha?.avatar ?? avatarPorDefecto(uid)} tam="md" />
        <div>
          <h2 id="t-ficha">{ficha?.nombre ?? nombre}</h2>
          {ficha && <p className="suave chico-texto">{t.rangos[rangoDe(total).indice]} · {t.carreraResumen(total - (ficha.retos ?? 0), ficha.victorias ?? 0, ficha.retos ?? 0)}</p>}
        </div>
        <button className="secundario cerrar-ficha" onClick={() => dialogo.current?.close()} aria-label={t.cerrar}>✕</button>
      </div>

      {ficha === undefined ? (
        <p className="suave">{t.cargando}</p>
      ) : ficha === null ? (
        <p className="suave chico-texto">{t.fichaPrivada}</p>
      ) : logros.length > 0 ? (
        <ul className="logros" aria-label={t.condecoraciones}>
          {logros.map(({ clave, n, l }) => (
            <li key={clave}>
              <span aria-hidden="true">{l!.icono}</span> {idioma === "en" ? l!.en : l!.es}
              {n > 1 && <span className="veces">×{n}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="suave chico-texto">{t.sinCondecoracionesOtro}</p>
      )}

      {/* Con la ficha privada (siempre en menores) solo te pueden agregar con tu código de amigo. */}
      {ficha && <div className="botones"><BotonAmistad otro={uid} nombre={ficha.nombre ?? nombre} /></div>}

      <h3>{t.contraTi}</h3>
      {!record || record.partidas === 0 ? (
        <p className="suave chico-texto">{t.aunNoJugaron}</p>
      ) : (
        <p>
          <span className="marcador"><span className="g">{record.ganadas}</span>–<span className="p">{record.perdidas}</span></span>{" "}
          <span className="suave chico-texto">· {t.partidasJuntos(record.partidas)}</span>
        </p>
      )}
    </dialog>
  );
}
