const DURACION_MS = 4000;
/** Un aviso con botón dura más: hay que alcanzar a apretarlo. */
const DURACION_CON_ACCION_MS = 8000;

export interface Avisos {
  logro(texto: string): void;
  aviso(texto: string): void;
  /** Un aviso con un botón (por ejemplo, «Deshacer»). */
  conAccion(texto: string, boton: string, alClic: () => void): void;
}

/** Avisos breves: el logro amarillo (hitos, meta) y un aviso para lo demás. Desaparecen solos. */
export function crearAvisos(raiz: Document): Avisos {
  const $ = (id: string) => raiz.getElementById(id)!;
  const ocultar = new Map<string, ReturnType<typeof setTimeout>>();
  const accion = $('toast-accion') as HTMLButtonElement;
  let alClicAccion: (() => void) | null = null;
  accion.addEventListener('click', () => {
    const f = alClicAccion;
    alClicAccion = null;
    $('toast').hidden = true;
    f?.();
  });
  const mostrar = (caja: string, texto: string, destino: string, duracion = DURACION_MS) => {
    $(destino).textContent = texto;
    $(caja).hidden = false;
    clearTimeout(ocultar.get(caja));
    ocultar.set(caja, setTimeout(() => { $(caja).hidden = true; }, duracion));
  };
  return {
    logro: texto => mostrar('logro', texto, 'txt-logro'),
    aviso: texto => {
      accion.hidden = true;
      alClicAccion = null;
      mostrar('toast', texto, 'toast-txt');
    },
    conAccion: (texto, boton, alClic) => {
      accion.textContent = boton;
      accion.hidden = false;
      alClicAccion = alClic;
      mostrar('toast', texto, 'toast-txt', DURACION_CON_ACCION_MS);
    },
  };
}
