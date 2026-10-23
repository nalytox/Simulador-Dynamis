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
import { crearArchivoPista } from './archivo-pista';
import { crearVentanaRobot } from './mi-robot';
import { crearVentanaEjemplos } from './ejemplos';
import { crearRecorrido } from './recorrido';
import { crearVentanaAjuste, type PedidoEntrenamiento, type FinVentana } from './ajustar';
import { crearAgente } from '../ajuste/agente.js';
import { calcularRecompensa } from '../ajuste/recompensa.js';
import type { CrearAgente, RegistroPrueba } from '../ajuste/contrato';
import { describirError, entrenar } from '../ajuste/entrenamiento';
import { crearPool } from '../ajuste/pool';
import { ClienteCompilador } from '../compilador/cliente';
import { primerError } from '../compilador/amigables';
import { ClienteSimulacion } from '../simulacion/cliente';
import type { FinEjecucion, Instantanea } from '../simulacion/ejecucion';
import { puntosDePartida } from '../pista/puntos';
import { ROBOT_POR_DEFECTO, type ConfigRobot } from '../robot/config';
import { normalizarRobot } from '../robot/archivo';
import { abrirAlmacen, conRetardo, type Almacen, type DatosGuardados, type Preferencias } from '../proyecto/almacen';
import type { Proyecto } from '../proyecto/proyecto';
import type { Pista } from '../pista/tipos';
import { PROYECTO_INICIAL, PISTA_INICIAL, PISTAS_DE_EJEMPLO } from '../ejemplos';
import { buscarAjustables, formatearValor } from '../compilador/ajustables';

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

/** El localStorage del navegador; en algunos modos privados ni siquiera se puede leer la propiedad. */
function almacenLocal(raiz: Document): Storage | undefined {
  try {
    return raiz.defaultView?.localStorage;
  } catch {
    return undefined;
  }
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
  /** La pista de Programar: la de la prueba en curso. La del editor pasa a Programar cuando no corre una prueba. */
  let pista = (await leer(almacen, 'pista')) ?? PISTA_INICIAL;
  let pistaEditada = pista;
  // El robot de "Mi robot", con la misma regla: el editado pasa a Programar cuando no corre una prueba.
  const robotGuardado = await leer(almacen, 'robot');
  const robotLeido = robotGuardado ? normalizarRobot(robotGuardado) : null;
  let robot: ConfigRobot = robotLeido?.ok ? robotLeido.robot : structuredClone(ROBOT_POR_DEFECTO);
  let robotEditado = robot;
  const preferencias: Preferencias = (await leer(almacen, 'preferencias')) ?? { velocidad: 100 };
  const guardar = <K extends keyof DatosGuardados>(clave: K) => conRetardo((valor: DatosGuardados[K]) => { void almacen?.guardar(clave, valor).catch(() => {}); });
  const guardarProyecto = guardar('proyecto');
  const guardarPreferencias = guardar('preferencias');
  const guardarPista = guardar('pista');
  const guardarRobot = guardar('robot');

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
  const vistas = crearVistas(raiz, { alCambiar: v => { if (v === 'programar') consola.irAlFinal(); } });
  const panelPista = crearPanelPista(raiz, {
    pista: () => editorPista.pista(),
    alCambiar: p => editorPista.editar(p),
    alElegir: s => editorPista.elegir(s),
  });
  const editorPista = crearEditorPista(raiz, {
    alCambiar: p => {
      alEditarPista(p);
      panelPista.mostrar(p, editorPista.seleccion());
    },
    alElegir: s => panelPista.mostrar(editorPista.pista(), s),
  });
  editorPista.mostrar(pista);
  const archivoPista = crearArchivoPista(raiz, {
    pista: () => pistaEditada,
    alAbrir: p => {
      editorPista.mostrar(p);
      alEditarPista(p);
    },
  }, PISTAS_DE_EJEMPLO.map(e => e.pista));
  const ventanaEjemplos = crearVentanaEjemplos(raiz, {
    abrirProyecto: p => programa.abrirEjemplo(p),
    abrirPista: p => archivoPista.abrirEjemplo(p),
    alAbrir: () => vistas.mostrar('programar'),
  });
  $('btn-ejemplos').addEventListener('click', () => ventanaEjemplos.abrir());
  /** La pista editada se guarda y, si no corre una prueba, se ve al tiro en Programar. */
  function alEditarPista(p: Pista) {
    pistaEditada = p;
    guardarPista(p);
    if (!simulacion.corriendo) dejarListo();
  }

  // Pista, tarjetas y juez.
  const lienzo = crearLienzo($('lienzo-sim') as HTMLCanvasElement, robot);
  const ventanaRobot = crearVentanaRobot(raiz, {
    robot: () => robotEditado,
    alCambiar: r => {
      robotEditado = r;
      guardarRobot(r);
      if (!simulacion.corriendo) dejarListo();
    },
  });
  $('btn-mi-robot').addEventListener('click', () => ventanaRobot.abrir());
  const ventanaAjuste = crearVentanaAjuste(raiz, {
    proyecto: () => programa.proyecto(),
    pista: () => pistaEditada,
    entrenar: pedido => entrenarDesdeLaVentana(pedido),
    alVer: m => {
      vistas.mostrar('programar');
      juez.elegirDesde('partida');
      void probar({ ajustes: m.valores, semilla: m.semilla });
    },
    alUsar: m => usarValores(m.valores),
  });
  $('btn-ajustar').addEventListener('click', () => ventanaAjuste.abrir());
  lienzo.mostrarPista(pista);
  const poseDe = (id: string) => (puntosDePartida(pista).find(p => p.id === id) ?? puntosDePartida(pista)[0]).pose;
  const tarjetas = crearTarjetas(raiz);
  const juez = crearTarjetaJuez(raiz, {
    alPedir: p => simulacion.pedir(p),
    alElegirDesde: id => lienzo.reiniciar(poseDe(id)),
  });
  juez.mostrarPista(pista);
  const textoTamano = (p: Pista) => `${p.columnas} × ${p.filas} baldosas de 30 cm`;
  $('chip-pista').textContent = textoTamano(pista);

  // Simulación.
  let vivos = 0;
  /** Cuenta los workers vivos (simulación y entrenamiento) para las pruebas de punta a punta. */
  const contado = (w: Worker) => {
    vivos++;
    const terminar = w.terminate.bind(w);
    w.terminate = () => { vivos--; terminar(); };
    return w;
  };
  const crearTrabajadorSimulacion = () => contado(new Worker(new URL('../simulacion/trabajador.ts', import.meta.url), { type: 'module' }));
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

  /** Pasa a Programar la pista del editor y el robot de "Mi robot", si cambiaron. */
  function usarLoEditado() {
    if (robot !== robotEditado) {
      robot = robotEditado;
      lienzo.cambiarRobot(robot);
    }
    if (pista === pistaEditada) return;
    pista = pistaEditada;
    lienzo.mostrarPista(pista);
    juez.mostrarPista(pista);
    $('chip-pista').textContent = textoTamano(pista);
  }

  /**
   * "Ajustar parámetros" (spec §11.2): primero el agente del profe (si falta, no se compila nada),
   * después se compila una vez y se entrena con la pista y el robot editados.
   */
  async function entrenarDesdeLaVentana(pedido: PedidoEntrenamiento): Promise<FinVentana> {
    let agente: ReturnType<CrearAgente>;
    try {
      agente = (crearAgente as CrearAgente)({ parametros: pedido.parametros, presupuesto: pedido.presupuesto });
    } catch (e) {
      return { motivo: 'error', error: describirError(e, 'el agente del profe'), mejor: null };
    }
    try {
      await compilador.preparar(() => {});
      compiladorListo = true;
    } catch {
      return { motivo: 'no-compila', mensaje: `${SIN_COMPILADOR.titulo}. ${SIN_COMPILADOR.mensaje}` };
    }
    const r = await compilador.compilar(programa.proyecto());
    if (!r.ok) return { motivo: 'no-compila', mensaje: 'Tu programa tiene errores: pruébalo con «Probar mi robot» para verlos.' };
    if (pedido.senal.aborted) return { motivo: 'detenido', mejor: null };
    const pool = crearPool({
      modulo: r.modulo, pista: pistaEditada, robot: robotEditado, duracionS: pedido.duracionS, tamano: pedido.robots,
      crearTrabajador: () => contado(new Worker(new URL('../ajuste/trabajador.ts', import.meta.url), { type: 'module' })),
      recompensaPrincipal: (registro: RegistroPrueba) => calcularRecompensa(registro),
    });
    return entrenar({
      crearAgente: () => agente, parametros: pedido.parametros, presupuesto: pedido.presupuesto, pool,
      semilla: () => crypto.getRandomValues(new Uint32Array(1))[0], senal: pedido.senal, alResultado: pedido.alResultado,
    });
  }

  function dejarListo() {
    usarLoEditado();
    ultima = null;
    eventosVistos = 0;
    tActual = 0;
    lienzo.reiniciar(poseDe(juez.desde()));
    tarjetas.mostrar(null, null, null);
    juez.mostrar(null);
    $('chip-tiempo').textContent = `t = ${formatoTiempo(0)}`;
  }

  /** Escribe en el código los valores del entrenamiento (spec §11.4) y lo cuenta en los mensajes. */
  function usarValores(valores: Record<string, number>) {
    vistas.mostrar('programar');
    const r = programa.aplicarAjustes(valores);
    if (r.cambiadas.length > 0) {
      const marcas = buscarAjustables(programa.proyecto()).parametros.filter(a => a.id in valores);
      avisos.logro('¡Tu robot aprendió! Cambiamos los valores marcados en tu código.');
      mensajeSistema(`Usé los valores del entrenamiento: ${marcas.map(a => `${a.nombre} = ${formatearValor(valores[a.id], a.entero).replace('.', ',')}`).join(', ')}.`);
    }
    if (r.faltan.length > 0) mensajeSistema(`No encontré en tu código: ${r.faltan.join(', ')}. Esos valores no cambiaron.`);
  }

  /** Corre el programa en la pista; el entrenamiento pasa sus valores y su semilla para repetir una prueba. */
  async function probar(opciones: { ajustes?: Record<string, number>; semilla?: number } = {}) {
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
        burbuja.mostrar({ ...SIN_COMPILADOR, boton: { texto: 'Reintentar', alClic: () => void probar(opciones) } });
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
      modulo: r.modulo, pista, robot, desde: juez.desde(),
      semilla: opciones.semilla ?? crypto.getRandomValues(new Uint32Array(1))[0], velocidad: preferencias.velocidad,
      ajustes: opciones.ajustes,
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
  const recorrido = crearRecorrido(raiz, almacenLocal(raiz));
  recorrido.mostrarSiEsPrimeraVez();

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
