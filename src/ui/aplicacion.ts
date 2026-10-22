import { crearPanelPrograma } from './programa';
import { Bitacora, formatoTiempo } from './bitacora';
import { crearConsola } from './consola';
import { registrarPrueba } from './pruebas';
import { crearLienzo } from './lienzo';
import { crearTarjetas } from './tarjetas';
import { crearTarjetaJuez } from './juez';
import { crearAcciones, type EstadoApp } from './acciones';
import { crearBurbuja } from './burbuja';
import { crearAvisos } from './avisos';
import { crearVistas } from './vistas';
import { crearEditorPista } from './editor-pista';
import { crearPanelPista } from './panel-pista';
import { ClienteCompilador } from '../compilador/cliente';
import { primerError } from '../compilador/amigables';
import { ClienteSimulacion } from '../simulacion/cliente';
import type { FinEjecucion, Instantanea } from '../simulacion/ejecucion';
import { puntosDePartida } from '../pista/puntos';
import { ROBOT_POR_DEFECTO } from '../robot/config';
import { abrirAlmacen, conRetardo, type Almacen, type DatosGuardados, type Preferencias } from '../proyecto/almacen';
import type { Proyecto } from '../proyecto/proyecto';
import { PROYECTO_INICIAL, PISTA_INICIAL } from '../ejemplos';

const SIN_AISLAMIENTO = 'Para usar el simulador, recarga la página o usa Chrome, Edge o Firefox recientes.';
const SIN_AUTOGUARDADO = 'No se pudo activar el guardado automático en este navegador: descarga tu proyecto para no perderlo.';
const CICLO_SIN_FIN = 'Tu programa parece atrapado en un ciclo sin fin. ¿Falta un `delay` o leer un sensor dentro del `while`?';
const SIN_COMPILADOR = { titulo: 'No pudimos preparar el compilador', mensaje: 'Revisa tu conexión a internet.' };
const SIN_EXPLICACION = { titulo: 'Ups, hay un problema en tu programa', mensaje: 'El compilador no pudo terminar. Mira el mensaje técnico.' };
/** Eventos del juez que celebran (el resto es un aviso). */
const LOGROS = new Set(['hito', 'meta']);

function mostrarAvisoGlobal(raiz: Document, texto: string): void {
  raiz.getElementById('aviso-global-txt')!.textContent = texto;
  raiz.getElementById('aviso-global')!.hidden = false;
}

async function leer<K extends keyof DatosGuardados>(almacen: Almacen | null, clave: K): Promise<DatosGuardados[K] | undefined> {
  try {
    return await almacen?.leer(clave);
  } catch {
    return undefined;
  }
}

/** Arma la vista Programar sobre el HTML de index.html y conecta "Probar mi robot". */
export async function iniciarAplicacion(raiz: Document): Promise<void> {
  if (!crossOriginIsolated) {
    mostrarAvisoGlobal(raiz, SIN_AISLAMIENTO);
    return;
  }
  const $ = (id: string) => raiz.getElementById(id)!;
  const almacen = await abrirAlmacen();
  const proyectoGuardado = await leer(almacen, 'proyecto');
  let pista = (await leer(almacen, 'pista')) ?? PISTA_INICIAL;
  const preferencias: Preferencias = (await leer(almacen, 'preferencias')) ?? { velocidad: 100 };
  const guardar = <K extends keyof DatosGuardados>(clave: K) => conRetardo((valor: DatosGuardados[K]) => { void almacen?.guardar(clave, valor).catch(() => {}); });
  const guardarProyecto = guardar('proyecto');
  const guardarPreferencias = guardar('preferencias');

  // Mensajes del robot.
  const bitacora = new Bitacora();
  const consola = crearConsola($('consola'), $('pildora-nuevos'), $('btn-limpiar'), bitacora);
  let tActual = 0;
  const mensajeSistema = (texto: string) => {
    bitacora.agregarSistema(tActual, texto);
    consola.refrescar();
  };

  const burbuja = crearBurbuja(raiz, { alIrALinea: (archivo, linea) => programa.marcarError(archivo, linea) });
  const avisos = crearAvisos(raiz);
  const programa = crearPanelPrograma(raiz, {
    proyecto: proyectoGuardado ?? structuredClone(PROYECTO_INICIAL),
    activo: preferencias.archivoAbierto,
    alCambiarProyecto: guardarProyecto,
    alCambiarActivo: ruta => { preferencias.archivoAbierto = ruta; guardarPreferencias({ ...preferencias }); },
    mensajeSistema,
    mostrarError: (titulo, mensaje) => burbuja.mostrar({ titulo, mensaje }),
  });

  // Las dos vistas: al volver a Programar, los mensajes se muestran desde el final.
  crearVistas(raiz, { alCambiar: v => { if (v === 'programar') consola.irAlFinal(); } });
  const panelPista = crearPanelPista(raiz, {
    alCambiar: p => editorPista.editar(p),
    alElegir: s => editorPista.elegir(s),
  });
  const editorPista = crearEditorPista(raiz, {
    alCambiar: p => {
      pista = p;
      panelPista.mostrar(p, editorPista.seleccion());
    },
    alElegir: s => panelPista.mostrar(editorPista.pista(), s),
  });
  editorPista.mostrar(pista);

  // Pista, tarjetas y juez.
  const lienzo = crearLienzo($('lienzo-sim') as HTMLCanvasElement, ROBOT_POR_DEFECTO);
  lienzo.mostrarPista(pista);
  const poseDe = (id: string) => (puntosDePartida(pista).find(p => p.id === id) ?? puntosDePartida(pista)[0]).pose;
  const tarjetas = crearTarjetas(raiz);
  const juez = crearTarjetaJuez(raiz, {
    alPedir: p => simulacion.pedir(p),
    alElegirDesde: id => lienzo.reiniciar(poseDe(id)),
  });
  juez.mostrarPista(pista);

  // Simulación.
  let vivos = 0;
  /** El worker de simulación, contando los vivos para las pruebas de punta a punta. */
  const crearTrabajadorSimulacion = () => {
    const w = new Worker(new URL('../simulacion/trabajador.ts', import.meta.url), { type: 'module' });
    vivos++;
    const terminar = w.terminate.bind(w);
    w.terminate = () => { vivos--; terminar(); };
    return w;
  };
  let ultima: Instantanea | null = null;
  let eventosVistos = 0;
  const simulacion = new ClienteSimulacion({
    alInstantanea(i) {
      ultima = i;
      tActual = i.t;
      lienzo.mostrarInstantanea(i);
      tarjetas.mostrar(i.sensores, i.estado, i.motores);
      juez.mostrar(i.juez);
      $('chip-tiempo').textContent = `t = ${formatoTiempo(i.t)}`;
      bitacora.agregarSerial(i.t, i.serial);
      for (const aviso of i.avisos) bitacora.agregarSistema(i.t, aviso);
      consola.refrescar();
      for (const e of i.juez.eventos.slice(eventosVistos)) (LOGROS.has(e.tipo) ? avisos.logro : avisos.aviso)(e.mensaje);
      eventosVistos = i.juez.eventos.length;
      if (i.mensaje) avisos.aviso(i.mensaje);
    },
    alTerminar(f: FinEjecucion) {
      juez.habilitar(false);
      if (f.motivo === 'error' && f.error) {
        burbuja.mostrar(f.error);
        mostrar('error');
        return;
      }
      if (f.juez) avisos.logro(`¡Terminaste la prueba con ${Math.round(f.juez.puntaje)} puntos!`);
      mostrar('terminado');
    },
    alAtascarse() {
      burbuja.mostrar({ titulo: 'Tu robot no responde', mensaje: CICLO_SIN_FIN, boton: { texto: 'Detener', alClic: detener } });
    },
  }, crearTrabajadorSimulacion);

  // Barra de acciones y el flujo de "Probar mi robot".
  const compilador = new ClienteCompilador();
  let compiladorListo = false;
  /** Cada clic en Probar tiene un número: lo que termina después de otro clic se ignora. */
  let intento = 0;
  const acciones = crearAcciones(raiz, {
    alProbar: () => void probar(),
    alDetener: detener,
    alPausar() { simulacion.pausar(); mostrar('pausa'); },
    alSeguir() { simulacion.seguir(); mostrar('corriendo'); },
    alInicio: volverAlInicio,
    alVelocidad(centesimas) {
      preferencias.velocidad = centesimas;
      guardarPreferencias({ ...preferencias });
      simulacion.fijarVelocidad(centesimas);
    },
  });
  acciones.fijarVelocidad(preferencias.velocidad);
  function mostrar(e: EstadoApp, progreso?: number) {
    acciones.mostrar(e, progreso);
  }

  function dejarListo() {
    ultima = null;
    eventosVistos = 0;
    tActual = 0;
    lienzo.reiniciar(poseDe(juez.desde()));
    tarjetas.mostrar(null, null, null);
    juez.mostrar(null);
    $('chip-tiempo').textContent = `t = ${formatoTiempo(0)}`;
  }

  async function probar() {
    const mio = ++intento;
    burbuja.ocultar();
    programa.limpiarError();
    if (!compiladorListo) {
      mostrar('preparando', 0);
      try {
        await compilador.preparar((hecho, total) => { if (mio === intento) mostrar('preparando', Math.round((hecho / Math.max(total, 1)) * 100)); });
        compiladorListo = true;
      } catch {
        if (mio !== intento) return;
        burbuja.mostrar({ ...SIN_COMPILADOR, boton: { texto: 'Reintentar', alClic: () => void probar() } });
        mostrar('error');
        return;
      }
      if (mio !== intento) return;
    }
    mostrar('compilando');
    const proyecto: Proyecto = programa.proyecto();
    const r = await compilador.compilar(proyecto);
    if (mio !== intento) return;
    if (!r.ok) {
      const error = primerError(r.diagnosticos, Object.keys(proyecto.archivos));
      const tecnico = r.diagnosticos.map(d => d.mensaje).join('\n');
      burbuja.mostrar(error ?? { ...SIN_EXPLICACION, tecnico, archivo: null, linea: null });
      if (error?.archivo) programa.marcarError(error.archivo, error.linea);
      mostrar('error');
      return;
    }
    dejarListo();
    simulacion.iniciar({
      modulo: r.modulo, pista, robot: ROBOT_POR_DEFECTO, desde: juez.desde(),
      semilla: crypto.getRandomValues(new Uint32Array(1))[0], velocidad: preferencias.velocidad,
    });
    juez.habilitar(true);
    mostrar('corriendo');
  }

  function detener() {
    intento++;
    simulacion.detener();
    juez.habilitar(false);
    burbuja.ocultar();
    mostrar('detenido');
  }

  function volverAlInicio() {
    intento++;
    simulacion.detener();
    juez.habilitar(false);
    burbuja.ocultar();
    dejarListo();
    mostrar('listo');
  }

  dejarListo();
  juez.habilitar(false);
  mostrar('listo');
  if (!almacen) mensajeSistema(SIN_AUTOGUARDADO);

  registrarPrueba('mensajes', (t: number, texto: string) => {
    tActual = t;
    bitacora.agregarSerial(t, texto);
    consola.refrescar();
  });
  registrarPrueba('lienzo', { aPantalla: lienzo.aPantalla, vista: lienzo.vista });
  registrarPrueba('robot', () => (ultima ? { x: ultima.estado.x, y: ultima.estado.y } : null));
  registrarPrueba('trabajadoresVivos', () => vivos);
  registrarPrueba('abrirProyecto', (p: Proyecto) => programa.abrir(p));
}
