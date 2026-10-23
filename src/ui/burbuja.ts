import type { MensajeAmigable } from '../compilador/amigables';
import type { ErrorEjecucion } from '../simulacion/errores';

export type ContenidoBurbuja =
  | MensajeAmigable
  | ErrorEjecucion
  | { titulo: string; mensaje: string; boton?: { texto: string; alClic(): void } };

/** Muestra un texto con `código` entre comillas invertidas como <code>, sin interpretar HTML. */
function conCodigo(destino: HTMLElement, texto: string): void {
  const doc = destino.ownerDocument;
  destino.replaceChildren(...texto.split('`').map((parte, i) => {
    if (i % 2 === 0) return doc.createTextNode(parte);
    const code = doc.createElement('code');
    code.textContent = parte;
    return code;
  }));
}

/** La burbuja de la mascota: errores de compilación y de ejecución, y avisos con una acción. */
export function crearBurbuja(raiz: Document, eventos: { alIrALinea(archivo: string, linea: number): void }): { mostrar(m: ContenidoBurbuja): void; ocultar(): void } {
  const $ = (id: string) => raiz.getElementById(id)!;
  const tecnico = $('burbuja-tecnico');
  const irALinea = $('btn-ir-linea') as HTMLButtonElement;
  const accion = $('btn-burbuja-accion') as HTMLButtonElement;
  const verTecnico = $('btn-tecnico') as HTMLButtonElement;
  let alIr: (() => void) | null = null;
  let alAccion: (() => void) | null = null;

  irALinea.addEventListener('click', () => alIr?.());
  accion.addEventListener('click', () => alAccion?.());
  verTecnico.addEventListener('click', () => {
    tecnico.hidden = !tecnico.hidden;
    verTecnico.textContent = tecnico.hidden ? 'Ver mensaje técnico' : 'Ocultar mensaje técnico';
  });

  return {
    mostrar(m) {
      const esError = 'tipo' in m;
      const titulo = esError ? (m.tipo === 'simulador' ? 'Algo falló en el simulador' : 'Tu programa se detuvo') : m.titulo;
      $('burbuja-titulo').textContent = titulo;
      conCodigo($('burbuja-mensaje'), m.mensaje);
      const tieneTecnico = 'tecnico' in m && m.tecnico !== '';
      tecnico.textContent = tieneTecnico ? m.tecnico : '';
      tecnico.hidden = true;
      verTecnico.hidden = !tieneTecnico;
      verTecnico.textContent = 'Ver mensaje técnico';
      const lugar = 'archivo' in m && m.archivo !== null && m.linea !== null ? { archivo: m.archivo, linea: m.linea } : null;
      alIr = lugar ? () => eventos.alIrALinea(lugar.archivo, lugar.linea) : null;
      irALinea.hidden = lugar === null;
      const boton = 'boton' in m ? m.boton : undefined;
      alAccion = boton?.alClic ?? null;
      accion.hidden = !boton;
      accion.textContent = boton?.texto ?? '';
      $('burbuja').hidden = false;
    },
    ocultar() {
      $('burbuja').hidden = true;
    },
  };
}
