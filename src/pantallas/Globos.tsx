/** Globos de chat (los tuyos a la derecha), compartidos por el chat de la sala y los mensajes directos. */
import type { ReactNode } from "react";
import type { Timestamp } from "firebase/firestore";
import type { Textos } from "../i18n";
import type { Avatar } from "../firebase/tipos";
import { AvatarCirculo } from "./PaginaPerfil";

export interface MensajeChat {
  id: string;
  uid: string;
  nombre?: string;
  texto: string;
  hora: Timestamp | null;
}

/** «Hoy», «Ayer» o la fecha, para separar los mensajes por día. */
function etiquetaDia(fecha: Date, t: Textos, idioma: string): string {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (fecha.toDateString() === hoy.toDateString()) return t.hoy;
  if (fecha.toDateString() === ayer.toDateString()) return t.ayer;
  return fecha.toLocaleDateString(idioma, { weekday: "long", day: "numeric", month: "long" });
}

const AGRUPAR_MS = 5 * 60_000; // mensajes seguidos de la misma persona: un solo bloque

/**
 * Filas de la lista de mensajes: separadores por día y globos agrupados por persona.
 * `conAutor`: el nombre arriba de cada bloque ajeno (en un chat de dos no hace falta).
 */
export function filasDeGlobos(
  mensajes: MensajeChat[],
  uid: string,
  avatarDe: (uid: string) => Avatar,
  conAutor: boolean,
  t: Textos,
  idioma: string,
): ReactNode[] {
  const filas: ReactNode[] = [];
  mensajes.forEach((m, i) => {
    const antes = mensajes[i - 1];
    const fecha = m.hora?.toDate() ?? new Date();
    const fechaAntes = antes?.hora?.toDate();
    const nuevoDia = !antes || !fechaAntes || fechaAntes.toDateString() !== fecha.toDateString();
    if (nuevoDia) filas.push(<li key={`dia-${m.id}`} className="dia-chat"><span>{etiquetaDia(fecha, t, idioma)}</span></li>);
    const mio = m.uid === uid;
    const primero = nuevoDia || antes.uid !== m.uid || fecha.getTime() - (fechaAntes?.getTime() ?? 0) > AGRUPAR_MS;
    const siguiente = mensajes[i + 1];
    const ultimoDelGrupo = !siguiente || siguiente.uid !== m.uid || (siguiente.hora?.toMillis() ?? Date.now()) - fecha.getTime() > AGRUPAR_MS;
    filas.push(
      <li key={m.id} className={`globo-fila ${mio ? "mio" : "otro"} ${primero ? "primero" : ""} ${ultimoDelGrupo ? "ultimo" : ""}`}>
        {!mio && (
          <span className="globo-avatar" aria-hidden="true">
            {ultimoDelGrupo && <AvatarCirculo avatar={avatarDe(m.uid)} tam="xs" />}
          </span>
        )}
        <div className="globo">
          {conAutor && !mio && primero && m.nombre && <span className="globo-autor">{m.nombre}</span>}
          <span className="globo-texto">{m.texto}</span>
          {m.hora && (
            <time className="globo-hora" dateTime={fecha.toISOString()}>
              {fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>
          )}
        </div>
      </li>,
    );
  });
  return filas;
}
