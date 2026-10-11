import { useUsuario } from "./hooks/useUsuario";
import { useNombre } from "./hooks/useNombre";
import { useRuta } from "./navegacion";
import { Inicio } from "./pantallas/Inicio";
import { Sala } from "./pantallas/Sala";
import { Panel } from "./pantallas/Panel";

export function App() {
  const { uid, usuario, error } = useUsuario();
  const [nombre, setNombre] = useNombre();
  const ruta = useRuta();

  if (error) {
    return (
      <main className="centro">
        <div className="tarjeta">
          <h2>No pudimos conectarte</h2>
          <p className="suave">Revisa tu conexión a internet y recarga la página.</p>
          <p className="detalle">{error}</p>
        </div>
      </main>
    );
  }
  if (!uid) {
    return (
      <main className="centro">
        <p className="suave">Conectando…</p>
      </main>
    );
  }

  if (ruta.pantalla === "panel") return <Panel usuario={usuario!} />;
  return ruta.pantalla === "sala" ? (
    <Sala key={ruta.codigo} codigo={ruta.codigo} uid={uid} nombre={nombre} setNombre={setNombre} />
  ) : (
    <Inicio uid={uid} usuario={usuario!} nombre={nombre} setNombre={setNombre} />
  );
}
