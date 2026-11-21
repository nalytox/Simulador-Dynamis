import { elegirOpcion } from './dialogo';

export interface EventosPestanas {
  alElegir(ruta: string): void;
  /** Mover la pestaña a la posición `aIndice` entre las demás (0 = la primera). */
  alMover(ruta: string, aIndice: number): void;
  alCrear(): void;
  alRenombrar(ruta: string): void;
  alBorrar(ruta: string): void;
}

const extension = (ruta: string) => ruta.slice(ruta.lastIndexOf('.') + 1).toLowerCase();
/** Lo que hay que mover el puntero para que un clic pase a ser un arrastre. */
const UMBRAL_ARRASTRE_PX = 6;

/**
 * Una pestaña por archivo (role="tab", flechas para moverse), "⋯" para renombrar o borrar, y + para
 * crear. Las pestañas se ordenan arrastrándolas o con Alt+← y Alt+→.
 */
export function crearPestanas(contenedor: HTMLElement, eventos: EventosPestanas): { pintar(rutas: string[], activa: string): void } {
  const doc = contenedor.ownerDocument;
  const tabs = () => [...contenedor.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const enfocar = (ruta: string) => tabs().find(t => t.dataset.ruta === ruta)?.focus();
  contenedor.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const lista = tabs();
    const i = lista.indexOf(doc.activeElement as HTMLButtonElement);
    if (i < 0) return;
    if (e.altKey) {
      const ruta = lista[i].dataset.ruta!;
      const destino = i + (e.key === 'ArrowRight' ? 1 : -1);
      if (destino >= 0 && destino < lista.length) {
        eventos.alMover(ruta, destino);
        enfocar(ruta);
      }
      e.preventDefault();
      return;
    }
    const tabsLista = lista;
    const siguiente = tabsLista[(i + (e.key === 'ArrowRight' ? 1 : tabsLista.length - 1)) % tabsLista.length];
    siguiente.focus();
    eventos.alElegir(siguiente.dataset.ruta!);
    e.preventDefault();
  });
  // Arrastrar una pestaña: una rayita muestra dónde va a quedar; al soltar se mueve.
  let arrastre: { ruta: string; tab: HTMLButtonElement; x0: number; y0: number; movido: boolean; aIndice: number } | null = null;
  let recienArrastrada = false;
  const limpiarDestino = () => contenedor.querySelectorAll('.destino-antes, .destino-despues, .arrastrando')
    .forEach(el => el.classList.remove('destino-antes', 'destino-despues', 'arrastrando'));
  doc.addEventListener('pointermove', e => {
    if (!arrastre) return;
    if (!arrastre.movido && Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0) < UMBRAL_ARRASTRE_PX) return;
    arrastre.movido = true;
    const otras = tabs().filter(t => t !== arrastre!.tab);
    // Una pestaña queda antes del puntero si está en una fila de más arriba, o en la misma y a su izquierda.
    const antes = otras.filter(t => {
      const r = t.getBoundingClientRect();
      return r.bottom <= e.clientY || (r.top <= e.clientY && r.left + r.width / 2 < e.clientX);
    });
    arrastre.aIndice = antes.length;
    limpiarDestino();
    arrastre.tab.classList.add('arrastrando');
    if (arrastre.aIndice < otras.length) otras[arrastre.aIndice].classList.add('destino-antes');
    else otras.at(-1)?.classList.add('destino-despues');
  });
  doc.addEventListener('pointerup', () => {
    if (!arrastre) return;
    const { ruta, movido, aIndice } = arrastre;
    arrastre = null;
    limpiarDestino();
    if (!movido) return;
    recienArrastrada = true;
    setTimeout(() => { recienArrastrada = false; }, 0);
    eventos.alMover(ruta, aIndice);
  });

  return {
    pintar(rutas, activa) {
      // Al redibujar se pierde el botón con foco: si el foco estaba aquí, vuelve a la pestaña activa.
      const teniaFoco = contenedor.contains(doc.activeElement);
      contenedor.replaceChildren();
      for (const ruta of rutas) {
        const tab = doc.createElement('button');
        tab.className = 'pestana';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(ruta === activa));
        tab.tabIndex = ruta === activa ? 0 : -1;
        tab.dataset.ruta = ruta;
        tab.dataset.ext = extension(ruta);
        tab.append(doc.createElement('i'), ruta);
        tab.addEventListener('click', () => {
          if (recienArrastrada) return;  // soltar después de arrastrar no elige la pestaña
          eventos.alElegir(ruta);
        });
        tab.addEventListener('pointerdown', e => {
          if (e.button !== 0) return;
          arrastre = { ruta, tab, x0: e.clientX, y0: e.clientY, movido: false, aIndice: 0 };
        });
        const menu = doc.createElement('button');
        menu.className = 'pestana-menu';
        menu.textContent = '⋯';
        menu.setAttribute('aria-label', `Opciones de ${ruta}`);
        menu.addEventListener('click', async () => {
          const opcion = await elegirOpcion(doc, ruta, ['Renombrar', 'Borrar']);
          if (opcion === 'Renombrar') eventos.alRenombrar(ruta);
          else if (opcion === 'Borrar') eventos.alBorrar(ruta);
        });
        contenedor.append(tab, menu);
      }
      const nueva = doc.createElement('button');
      nueva.className = 'pestana-nueva';
      nueva.textContent = '+';
      nueva.setAttribute('aria-label', 'Crear un archivo');
      nueva.addEventListener('click', () => eventos.alCrear());
      contenedor.append(nueva);
      if (teniaFoco) contenedor.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus();
    },
  };
}
