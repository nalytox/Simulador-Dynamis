import { formatoTiempo, type Bitacora, type LineaConsola } from './bitacora';

/** Margen para considerar que el usuario está mirando el final. */
const TOLERANCIA_PX = 4;

/**
 * "Mensajes del robot" (spec §12): dibuja una vez por cuadro, se queda pegada al final mientras el
 * usuario mira el final y, si subió a leer, no lo mueve y muestra "Mensajes nuevos ↓".
 */
export function crearConsola(caja: HTMLElement, pildora: HTMLElement, botonLimpiar: HTMLElement, bitacora: Bitacora): { refrescar(): void; irAlFinal(): void } {
  const doc = caja.ownerDocument;
  let dibujada = -1;
  let pendiente = false;

  const alFinal = () => caja.scrollTop + caja.clientHeight >= caja.scrollHeight - TOLERANCIA_PX;
  const bajar = () => {
    caja.scrollTop = caja.scrollHeight;
    pildora.hidden = true;
  };
  const fila = (l: LineaConsola) => {
    const div = doc.createElement('div');
    if (l.tipo === 'sistema') div.className = 'sistema';
    const t = doc.createElement('span');
    t.className = 't';
    t.textContent = formatoTiempo(l.t);
    const texto = doc.createElement('span');
    texto.textContent = l.texto;
    div.append(t, texto);
    return div;
  };
  // Lo que ya está en pantalla: así cada cuadro solo agrega las líneas nuevas y quita las viejas.
  let cerradasDibujadas = 0;
  let limpiezasVistas = -1;
  let filaAbierta: HTMLElement | null = null;
  const dibujar = () => {
    pendiente = false;
    if (bitacora.version === dibujada) return;
    dibujada = bitacora.version;
    const pegada = alFinal();
    const lineas = bitacora.lineas;
    const abierta = bitacora.abierta;
    const nuevas = bitacora.totalCerradas - cerradasDibujadas;
    filaAbierta?.remove();
    filaAbierta = null;
    if (bitacora.limpiezas !== limpiezasVistas || nuevas > lineas.length) {
      caja.replaceChildren(...lineas.map(fila));
    } else if (nuevas > 0) {
      caja.append(...lineas.slice(lineas.length - nuevas).map(fila));
    }
    // Las visibles cuentan la línea abierta: sin ella caben todas las cerradas guardadas.
    const cerradasVisibles = bitacora.visibles().length - (abierta ? 1 : 0);
    while (caja.childElementCount > cerradasVisibles) caja.firstElementChild!.remove();
    if (abierta) {
      filaAbierta = fila(abierta);
      caja.append(filaAbierta);
    }
    limpiezasVistas = bitacora.limpiezas;
    cerradasDibujadas = bitacora.totalCerradas;
    if (pegada || caja.childElementCount === 0) bajar();
    else pildora.hidden = false;
  };
  const refrescar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(dibujar);
  };

  caja.addEventListener('scroll', () => { if (alFinal()) pildora.hidden = true; });
  pildora.addEventListener('click', bajar);
  botonLimpiar.addEventListener('click', () => {
    bitacora.limpiar();
    refrescar();
  });
  return { refrescar, irAlFinal: bajar };
}
