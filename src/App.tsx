import { useUsuario } from "./hooks/useUsuario";
import { useNombre } from "./hooks/useNombre";
import { useRuta } from "./navegacion";
import { Inicio } from "./pantallas/Inicio";
import { Sala } from "./pantallas/Sala";
import { Panel } from "./pantallas/Panel";
import { PaginaPerfil } from "./pantallas/PaginaPerfil";
import { SocialProvider } from "./pantallas/Amigos";
import { publicarFicha, usePerfil } from "./firebase/perfil";
import { useEffect } from "react";
import { useIdioma } from "./i18n";

export function App() {
  const { t } = useIdioma();
  const { uid, usuario, error } = useUsuario();
  const [nombre, setNombre] = useNombre();
  const ruta = useRuta();
  const perfil = usePerfil(uid);

  // Tu ficha visible para otros se mantiene al día con tu perfil (o se oculta).
  useEffect(() => {
    if (uid && perfil) publicarFicha(uid, perfil, nombre).catch(() => {});
  }, [uid, perfil, nombre]);

  // El nombre guardado en el perfil manda: al entrar con tu cuenta en otro dispositivo, se recupera.
  useEffect(() => {
    if (perfil?.nombre && perfil.nombre !== nombre) setNombre(perfil.nombre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.nombre]);

  if (error) {
    return (
      <main className="centro">
        <div className="tarjeta">
          <h2>{t.errorConexionTitulo}</h2>
          <p className="suave">{t.errorConexionTexto}</p>
          <p className="detalle">{error}</p>
        </div>
      </main>
    );
  }
  if (!uid) {
    return (
      <main className="centro">
        <p className="suave">{t.conectando}</p>
      </main>
    );
  }

  if (ruta.pantalla === "panel") return <Panel usuario={usuario!} />;
  return (
    <SocialProvider uid={uid} nombre={nombre} perfil={perfil}>
      {ruta.pantalla === "perfil" ? <PaginaPerfil usuario={usuario!} nombre={nombre} perfil={perfil} /> : ruta.pantalla === "sala" ? (
    <Sala key={ruta.codigo} codigo={ruta.codigo} uid={uid} nombre={nombre} setNombre={setNombre} perfil={perfil} />
  ) : (
    <Inicio uid={uid} usuario={usuario!} nombre={nombre} setNombre={setNombre} perfil={perfil} />
      )}
    </SocialProvider>
  );
}
