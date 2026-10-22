import { crearPanelPrograma } from './programa';
import { Bitacora } from './bitacora';
import { crearConsola } from './consola';
import { registrarPrueba } from './pruebas';
import { crearLienzo } from './lienzo';
import { crearTarjetas } from './tarjetas';
import { crearTarjetaJuez } from './juez';
import { puntosDePartida } from '../pista/puntos';
import { ROBOT_POR_DEFECTO } from '../robot/config';
import { abrirAlmacen, conRetardo, type Almacen, type DatosGuardados, type Preferencias } from '../proyecto/almacen';
import { PROYECTO_INICIAL, PISTA_INICIAL } from '../ejemplos';

const SIN_AISLAMIENTO = 'Para usar el simulador, recarga la página o usa Chrome, Edge o Firefox recientes.';
const SIN_AUTOGUARDADO = 'No se pudo activar el guardado automático en este navegador: descarga tu proyecto para no perderlo.';

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

/** Arma la vista Programar sobre el HTML de index.html. */
export async function iniciarAplicacion(raiz: Document): Promise<void> {
  if (!crossOriginIsolated) {
    mostrarAvisoGlobal(raiz, SIN_AISLAMIENTO);
    return;
  }
  const $ = (id: string) => raiz.getElementById(id)!;
  const almacen = await abrirAlmacen();
  const proyectoGuardado = await leer(almacen, 'proyecto');
  const pista = (await leer(almacen, 'pista')) ?? PISTA_INICIAL;
  const preferencias: Preferencias = (await leer(almacen, 'preferencias')) ?? { velocidad: 100 };
  const guardar = <K extends keyof DatosGuardados>(clave: K) => conRetardo((valor: DatosGuardados[K]) => { void almacen?.guardar(clave, valor).catch(() => {}); });
  const guardarProyecto = guardar('proyecto');
  const guardarPreferencias = guardar('preferencias');

  const bitacora = new Bitacora();
  const consola = crearConsola($('consola'), $('pildora-nuevos'), $('btn-limpiar'), bitacora);
  /** Tiempo simulado de la prueba en curso, para las líneas del sistema. */
  let tActual = 0;
  const mensajeSistema = (texto: string) => {
    bitacora.agregarSistema(tActual, texto);
    consola.refrescar();
  };
  registrarPrueba('mensajes', (t: number, texto: string) => {
    tActual = t;
    bitacora.agregarSerial(t, texto);
    consola.refrescar();
  });
  const mostrarError = (titulo: string, mensaje: string) => {
    $('burbuja-titulo').textContent = titulo;
    $('burbuja-mensaje').textContent = mensaje;
    $('btn-ir-linea').hidden = true;
    $('burbuja').hidden = false;
  };

  crearPanelPrograma(raiz, {
    proyecto: proyectoGuardado ?? structuredClone(PROYECTO_INICIAL),
    activo: preferencias.archivoAbierto,
    alCambiarProyecto: guardarProyecto,
    alCambiarActivo: ruta => { preferencias.archivoAbierto = ruta; guardarPreferencias({ ...preferencias }); },
    mensajeSistema,
    mostrarError,
  });
  const lienzo = crearLienzo($('lienzo-sim') as HTMLCanvasElement, ROBOT_POR_DEFECTO);
  lienzo.mostrarPista(pista);
  const poseDe = (id: string) => (puntosDePartida(pista).find(p => p.id === id) ?? puntosDePartida(pista)[0]).pose;
  lienzo.reiniciar(poseDe('partida'));
  const tarjetas = crearTarjetas(raiz);
  tarjetas.mostrar(null, null, null);
  const juez = crearTarjetaJuez(raiz, {
    alPedir: () => {},
    alElegirDesde: id => lienzo.reiniciar(poseDe(id)),
  });
  juez.mostrarPista(pista);
  juez.mostrar(null);
  juez.habilitar(false);
  registrarPrueba('lienzo', { aPantalla: lienzo.aPantalla, vista: lienzo.vista });
  if (!almacen) mensajeSistema(SIN_AUTOGUARDADO);
}
