import { reescribirAjustables } from '../compilador/ajustables';
import { crearEditor } from './editor';
import { crearPestanas } from './pestanas';
import { confirmar, pedirNombre } from './dialogo';
import { puedeBorrar, validarNombreArchivo } from './archivos';
import { archivoPrincipal, ordenarArchivos, type Proyecto } from '../proyecto/proyecto';
import { leerArrastre, leerCarpeta, leerInput, leerZip, proyectoDesdeArchivos, type ArchivoLeido } from '../proyecto/importar';
import { guardarEnCarpeta, nombreZip, proyectoAZip, type CarpetaEscribible } from '../proyecto/exportar';
import { firmaProyecto } from '../compilador/cliente';
import { PROYECTO_INICIAL } from '../ejemplos';

export interface OpcionesPrograma {
  proyecto: Proyecto;
  activo?: string;
  alCambiarProyecto(p: Proyecto): void;
  alCambiarActivo(ruta: string): void;
  mensajeSistema(texto: string): void;
  mostrarError(titulo: string, mensaje: string): void;
}

export interface PanelPrograma {
  proyecto(): Proyecto;
  /** Reemplaza el proyecto abierto (por ejemplo, uno importado). */
  abrir(p: Proyecto): void;
  limpiarError(): void;
  /** Abre la pestaña y marca la línea con error (null la desmarca). */
  marcarError(archivo: string, linea: number | null): void;
  /**
   * "Usar estos valores" (decisión 12 de la fase 6): reescribe los números marcados con @ajustar, abre el
   * archivo del primer cambio y resalta sus líneas. El cambio en ese archivo se deshace con Ctrl+Z.
   */
  aplicarAjustes(valores: Record<string, number>): { cambiadas: { archivo: string; linea: number }[]; faltan: string[] };
}

/** Contenido inicial de un archivo nuevo, según su tipo. */
function plantilla(ruta: string): string {
  if (/\.(h|hpp)$/i.test(ruta)) return '#pragma once\n';
  if (/\.(c|cpp)$/i.test(ruta)) return '#include <Arduino.h>\n';
  return '';
}

const MOSTRAR_IGNORADOS = 5;

type Ventana = Window & { showDirectoryPicker?(): Promise<FileSystemDirectoryHandle> };

/** El panel "Mi programa": editor, pestañas, abrir (carpeta, .zip, arrastre) y guardar. */
export function crearPanelPrograma(raiz: Document, o: OpcionesPrograma): PanelPrograma {
  let proyecto = o.proyecto;
  let activo = o.activo && o.activo in proyecto.archivos ? o.activo : ordenarArchivos(proyecto)[0];
  let carpeta: FileSystemDirectoryHandle | null = null;
  const $ = (id: string) => raiz.getElementById(id)!;

  const cambiar = (nuevo: Proyecto) => {
    proyecto = nuevo;
    o.alCambiarProyecto(proyecto);
  };
  const editor = crearEditor($('editor'), texto => cambiar({ ...proyecto, archivos: { ...proyecto.archivos, [activo]: texto } }));

  const elegir = (ruta: string) => {
    activo = ruta;
    o.alCambiarActivo(ruta);
    pintar();
    editor.mostrar(ruta, proyecto.archivos[ruta] ?? '');
  };
  /** Otro proyecto: sin historial de deshacer del anterior. */
  const abrirProyecto = (p: Proyecto) => {
    editor.olvidar();
    cambiar(p);
    elegir(archivoPrincipal(p) ?? ordenarArchivos(p)[0]);
  };
  const pestanas = crearPestanas($('pestanas'), {
    alElegir: elegir,
    async alCrear() {
      const nombre = await pedirNombre(raiz, { titulo: 'Archivo nuevo', inicial: '', boton: 'Crear', validar: n => validarNombreArchivo(proyecto, n) });
      if (!nombre) return;
      cambiar({ ...proyecto, archivos: { ...proyecto.archivos, [nombre]: plantilla(nombre) } });
      elegir(nombre);
    },
    async alRenombrar(ruta) {
      const nombre = await pedirNombre(raiz, { titulo: `Renombrar ${ruta}`, inicial: ruta, boton: 'Renombrar', validar: n => validarNombreArchivo(proyecto, n, ruta) });
      if (!nombre || nombre === ruta) return;
      const archivos = Object.fromEntries(Object.entries(proyecto.archivos).map(([r, t]) => [r === ruta ? nombre : r, t]));
      editor.olvidar(ruta);
      cambiar({ ...proyecto, archivos });
      elegir(activo === ruta ? nombre : activo);
    },
    async alBorrar(ruta) {
      const problema = puedeBorrar(proyecto, ruta);
      if (problema) return o.mostrarError(`No se puede borrar ${ruta}`, problema);
      if (!(await confirmar(raiz, { titulo: `¿Borrar ${ruta}?`, boton: 'Borrar' }))) return;
      const { [ruta]: _, ...archivos } = proyecto.archivos;
      editor.olvidar(ruta);
      cambiar({ ...proyecto, archivos });
      elegir(activo === ruta ? (archivoPrincipal(proyecto) ?? ordenarArchivos(proyecto)[0]) : activo);
    },
  });
  function pintar() {
    pestanas.pintar(ordenarArchivos(proyecto), activo);
    $('chip-carpeta').textContent = `Carpeta: ${proyecto.nombre}`;
  }

  /** El proyecto del navegador puede ser la única copia: antes de reemplazarlo se pregunta, salvo si es el ejemplo intacto. */
  const puedeReemplazar = async () =>
    firmaProyecto(proyecto) === firmaProyecto(PROYECTO_INICIAL)
    || confirmar(raiz, { titulo: '¿Reemplazar tu proyecto? Si no lo descargaste, se va a perder.', boton: 'Reemplazar' });

  /** Reemplaza el proyecto por uno importado; si no sirve o no se confirma, deja el que estaba. Dice si lo abrió. */
  const importar = async (archivos: ArchivoLeido[]): Promise<boolean> => {
    const r = proyectoDesdeArchivos(archivos);
    if (!r.ok) {
      o.mostrarError('No pudimos abrir esa carpeta', r.mensaje);
      return false;
    }
    if (!(await puedeReemplazar())) return false;
    abrirProyecto(r.proyecto);
    if (r.ignorados.length > 0) {
      const muestra = r.ignorados.slice(0, MOSTRAR_IGNORADOS).join(', ');
      o.mensajeSistema(`No abrí ${r.ignorados.length} archivo(s) que no son de código: ${muestra}${r.ignorados.length > MOSTRAR_IGNORADOS ? '…' : ''}.`);
    }
    return true;
  };
  /** "Guardar en la carpeta" solo sirve para la carpeta que se abrió con el selector, y mientras siga abierta. */
  const recordarCarpeta = (dir: FileSystemDirectoryHandle | null) => {
    carpeta = dir;
    $('btn-guardar-carpeta').hidden = dir === null;
  };
  /** Importa algo que no es la carpeta del selector. */
  const importarOtro = async (archivos: ArchivoLeido[]) => {
    if (await importar(archivos)) recordarCarpeta(null);
  };

  const inCarpeta = $('in-carpeta') as HTMLInputElement;
  const inZip = $('in-zip') as HTMLInputElement;
  $('btn-carpeta').addEventListener('click', async () => {
    const ventana = raiz.defaultView as Ventana;
    if (!ventana.showDirectoryPicker) return inCarpeta.click();
    try {
      const dir = await ventana.showDirectoryPicker();
      if (await importar(await leerCarpeta(dir as unknown as Parameters<typeof leerCarpeta>[0]))) recordarCarpeta(dir);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') o.mostrarError('No pudimos abrir esa carpeta', (e as Error).message);
    }
  });
  inCarpeta.addEventListener('change', async () => {
    if (inCarpeta.files?.length) await importarOtro(await leerInput(inCarpeta.files));
    inCarpeta.value = '';
  });
  $('btn-zip').addEventListener('click', () => inZip.click());
  inZip.addEventListener('change', async () => {
    const f = inZip.files?.[0];
    inZip.value = '';
    if (!f) return;
    try {
      await importarOtro(leerZip(new Uint8Array(await f.arrayBuffer())));
    } catch {
      o.mostrarError('No pudimos abrir ese .zip', 'El archivo no parece ser un .zip válido.');
    }
  });
  const zonaEditor = $('editor');
  zonaEditor.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); }, true);
  zonaEditor.addEventListener('drop', async e => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    await importarOtro(await leerArrastre(e.dataTransfer.items));
  }, true);

  $('btn-descargar').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([proyectoAZip(proyecto) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
    const a = raiz.createElement('a');
    a.href = url;
    a.download = nombreZip(proyecto);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('btn-guardar-carpeta').addEventListener('click', async () => {
    if (!carpeta) return;
    try {
      const permiso = await (carpeta as unknown as { requestPermission(o: { mode: string }): Promise<string> }).requestPermission({ mode: 'readwrite' });
      if (permiso !== 'granted') return;
      await guardarEnCarpeta(carpeta as unknown as CarpetaEscribible, proyecto);
      o.mensajeSistema('Guardé tu proyecto en la carpeta.');
    } catch (e) {
      o.mostrarError('No pudimos guardar en la carpeta', (e as Error).message);
    }
  });

  pintar();
  editor.mostrar(activo, proyecto.archivos[activo] ?? '');
  return {
    proyecto: () => proyecto,
    abrir(p) {
      abrirProyecto(p);
      recordarCarpeta(null);
    },
    limpiarError: () => editor.marcarLinea(null),
    aplicarAjustes(valores) {
      const r = reescribirAjustables(proyecto, valores);
      if (r.cambiadas.length === 0) return r;
      const primero = r.cambiadas[0].archivo;
      // Los otros archivos cambian en el proyecto; el primero, en el editor, para poder deshacerlo.
      const otros = [...new Set(r.cambiadas.map(c => c.archivo))].filter(a => a !== primero);
      if (otros.length > 0) cambiar({ ...proyecto, archivos: { ...proyecto.archivos, ...Object.fromEntries(otros.map(a => [a, r.proyecto.archivos[a]])) } });
      if (primero !== activo) elegir(primero);
      const lineasNuevas = r.proyecto.archivos[primero].split('\n');
      const lineas = r.cambiadas.filter(c => c.archivo === primero).map(c => c.linea);
      editor.cambiarLineas(lineas.map(linea => ({ linea, texto: lineasNuevas[linea - 1] })));
      editor.resaltarLineas(lineas);
      editor.irALinea(lineas[0]);
      return r;
    },
    marcarError(archivo, linea) {
      if (archivo in proyecto.archivos && archivo !== activo) elegir(archivo);
      editor.marcarLinea(linea);
      if (linea !== null) editor.irALinea(linea);
    },
  };
}
