import { useUsuario } from "./hooks/useUsuario";
import { useNombre } from "./hooks/useNombre";
import { useRuta } from "./navegacion";
import { Inicio } from "./pantallas/Inicio";
import { Sala } from "./pantallas/Sala";
import { Panel } from "./pantallas/Panel";
import { PaginaPerfil } from "./pantallas/PaginaPerfil";
import { SocialProvider } from "./pantallas/Amigos";
import { publicarFicha, usePerfil } from "./firebase/perfil";
import { useEffect, useState } from "react";
import { subirResultadosLocales } from "./firebase/resultadosLocales";
import { enviarPendientes } from "./firebase/reportes";
import { PaginaReportar, Reportes } from "./pantallas/Reportar";
import { useIdioma } from "./i18n";
import { precargarJuegos, SinConexion, useEnLinea } from "./pantallas/SinConexion";

export function App() {
  const { t } = useIdioma();
  const { uid, usuario, error } = useUsuario();
  const [nombre, setNombre] = useNombre();
  const ruta = useRuta();
  const perfil = usePerfil(uid);
  const enLinea = useEnLinea();

  // Con conexión, la app guarda en el celular los juegos que se pueden jugar sin internet.
  useEffect(() => {
    if (enLinea) precargarJuegos();
  }, [enLinea]);

  // …y sube a tu perfil las partidas que se jugaron en este celular (con o sin internet).
  const [subidas, setSubidas] = useState(0);
  useEffect(() => {
    if (!enLinea || !uid) return;
    const subir = () => {
      enviarPendientes(uid, nombre).catch(() => {}); // reportes escritos sin conexión
      return subirResultadosLocales(uid).then((n) => {
        if (n > 0) setSubidas(n);
      });
    };
    subir();
    // Al volver de jugar (misma ventana o desde otra pestaña): lo que se haya guardado entretanto.
    const alVolver = () => document.visibilityState === "visible" && subir();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("pageshow", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("pageshow", alVolver);
    };
  }, [enLinea, uid]);
  useEffect(() => {
    if (!subidas) return;
    const id = window.setTimeout(() => setSubidas(0), 7000);
    return () => window.clearTimeout(id);
  }, [subidas]);
  const aviso = subidas > 0 && (
    <div className="aviso-subidas" role="status">
      {t.partidasLocalesSubidas(subidas)}
    </div>
  );

  // Tu ficha visible para otros se mantiene al día con tu perfil (o se oculta).
  useEffect(() => {
    if (uid && perfil) publicarFicha(uid, perfil, nombre).catch(() => {});
  }, [uid, perfil, nombre]);

  // El nombre guardado en el perfil manda: al entrar con tu cuenta en otro dispositivo, se recupera.
  useEffect(() => {
    if (perfil?.nombre && perfil.nombre !== nombre) setNombre(perfil.nombre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.nombre]);

  // El formulario de reportes que abren los juegos (funciona también sin conexión: se guarda y se envía después).
  // (con conexión espera a tu usuario, para que el reporte quede a tu nombre)
  if (ruta.pantalla === "reportar" && (uid || !enLinea || error)) return <PaginaReportar uid={uid} nombre={nombre} />;
  // Sin internet no hay salas ni perfil: lo que se puede jugar en este celular.
  if (!enLinea || ruta.pantalla === "en-este-celular")
    return (
      <>
        <SinConexion enLinea={enLinea} />
        <Reportes uid={uid} nombre={nombre} />
      </>
    );

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
      {aviso}
      <Reportes uid={uid} nombre={nombre} />
      {ruta.pantalla === "perfil" ? <PaginaPerfil usuario={usuario!} nombre={nombre} perfil={perfil} /> : ruta.pantalla === "sala" ? (
    <Sala key={ruta.codigo} codigo={ruta.codigo} uid={uid} nombre={nombre} setNombre={setNombre} perfil={perfil} />
  ) : (
    <Inicio uid={uid} usuario={usuario!} nombre={nombre} setNombre={setNombre} perfil={perfil} />
      )}
    </SocialProvider>
  );
}
