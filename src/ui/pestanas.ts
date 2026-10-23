import { elegirOpcion } from './dialogo';

export interface EventosPestanas {
  alElegir(ruta: string): void;
  alCrear(): void;
  alRenombrar(ruta: string): void;
  alBorrar(ruta: string): void;
}

const extension = (ruta: string) => ruta.slice(ruta.lastIndexOf('.') + 1).toLowerCase();

/** Una pestaña por archivo (role="tab", flechas para moverse), "⋯" para renombrar o borrar, y + para crear. */
export function crearPestanas(contenedor: HTMLElement, eventos: EventosPestanas): { pintar(rutas: string[], activa: string): void } {
  const doc = contenedor.ownerDocument;
  contenedor.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = [...contenedor.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const i = tabs.indexOf(doc.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const siguiente = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    siguiente.focus();
    eventos.alElegir(siguiente.dataset.ruta!);
    e.preventDefault();
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
        tab.addEventListener('click', () => eventos.alElegir(ruta));
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
