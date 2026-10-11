/**
 * Retos de la sala: el reto del día (misma operación en todas las salas, ranking propio) y
 * retos directos que crea alguien de la sala. Se juegan en solitario; solo cuenta el primer intento.
 */
import { useState } from "react";
import { JUEGOS, type Juego } from "../datos/catalogo";
import { enlaceReto, fechaHoy, guardarReto, nuevoReto, retoDiario } from "../firebase/retos";
import type { Reto } from "../firebase/tipos";
import { useMarcas, useRetos } from "../hooks/useRetos";
import { useIdioma } from "../i18n";

const MOSTRAR = 5;
const DIAS_DIRECTO = 7;

function abrir(url: string) {
  // Pestaña nueva: la sala sigue abierta y recibe el puntaje al terminar.
  const w = window.open(url, "_blank");
  if (!w) window.location.href = url;
}

export function Retos({ sala, uid, nombre, confirmado }: { sala: string; uid: string; nombre: string; confirmado: boolean }) {
  const { t, idioma } = useIdioma();
  const juego = JUEGOS.find((j) => j.retos && j.url);
  const retos = useRetos(sala, confirmado && Boolean(juego));
  const [error, setError] = useState("");
  if (!juego) return null;

  const fecha = fechaHoy();
  const diario = retoDiario(juego, fecha);
  const limite = Date.now() - DIAS_DIRECTO * 86_400_000;
  const directos = retos.filter((r) => r.juego === juego.id && (r.creado?.toMillis() ?? Date.now()) > limite);

  const crear = () => {
    setError("");
    const r = nuevoReto(sala, juego, uid, nombre);
    const url = enlaceReto(juego, sala, r, nombre, idioma);
    if (!url) return;
    abrir(url);
    guardarReto(sala, r).catch((e) => {
      console.error(e);
      setError(t.errorCrearReto);
    });
  };

  return (
    <section className="panel retos" aria-labelledby="t-retos">
      <div className="retos-cabeza">
        <h2 id="t-retos">{t.retosTitulo(juego.nombre)}</h2>
        <button className="secundario" onClick={crear}>{t.crearReto}</button>
      </div>
      <p className="suave chico-texto">{t.retosTexto}</p>
      {error && <p className="error">{error}</p>}
      <ul className="lista-retos">
        <TarjetaReto sala={sala} uid={uid} nombre={nombre} juego={juego} reto={diario} confirmado={confirmado} titulo={t.retoDelDia} />
        {directos.map((r) => (
          <TarjetaReto
            key={r.id}
            sala={sala}
            uid={uid}
            nombre={nombre}
            juego={juego}
            reto={r}
            confirmado={confirmado}
            titulo={r.creador === uid ? t.tuReto : t.retoDe(r.creadorNombre)}
          />
        ))}
      </ul>
    </section>
  );
}

function TarjetaReto(props: { sala: string; uid: string; nombre: string; juego: Juego; reto: Reto; confirmado: boolean; titulo: string }) {
  const { sala, uid, nombre, juego, reto, confirmado, titulo } = props;
  const { t, idioma } = useIdioma();
  const marcas = useMarcas(sala, reto.id, confirmado);
  const [verTodo, setVerTodo] = useState(false);
  const mia = marcas.find((m) => m.uid === uid);
  const puesto = mia ? marcas.indexOf(mia) + 1 : null;
  const url = enlaceReto(juego, sala, reto, nombre, idioma);
  const lider = marcas[0];
  const lista = verTodo ? marcas : marcas.slice(0, MOSTRAR);

  return (
    <li className={`reto ${reto.tipo}`}>
      <div className="reto-cabeza">
        <div>
          <strong>{titulo}</strong>
          <span className="mono suave chico-texto"> · {t.operacion} {reto.semilla}</span>
        </div>
        {url && (
          <button className={mia ? "secundario" : "primario"} onClick={() => abrir(url)}>
            {mia ? t.jugarDeNuevo : lider && reto.tipo === "directo" ? t.superarlo(lider.puntaje) : t.jugarReto}
          </button>
        )}
      </div>
      {mia ? (
        <p className="chico-texto">{t.tuMarca(mia.puntaje, puesto ?? 1, marcas.length)}</p>
      ) : (
        <p className="suave chico-texto">{marcas.length ? t.soloPrimerIntento : t.nadieAun}</p>
      )}
      {marcas.length > 0 && (
        <ol className="ranking">
          {lista.map((m, i) => (
            <li key={m.uid} className={m.uid === uid ? "mio" : ""}>
              <span className="pos">{i + 1}</span>
              <span className="quien">{m.uid === uid ? t.tuMayus : m.nombre}</span>
              <span className="pts">{m.puntaje}</span>
            </li>
          ))}
        </ol>
      )}
      {marcas.length > MOSTRAR && (
        <button className="enlace chico-texto" onClick={() => setVerTodo((v) => !v)}>
          {verTodo ? t.verMenos : t.verTodos(marcas.length)}
        </button>
      )}
    </li>
  );
}
