import { crearPanelPrograma } from './programa';
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

  const mensajeSistema = (texto: string) => {
    const linea = raiz.createElement('div');
    linea.className = 'sistema';
    linea.textContent = texto;
    $('consola').append(linea);
  };
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
  void pista;
  if (!almacen) mensajeSistema(SIN_AUTOGUARDADO);
}
