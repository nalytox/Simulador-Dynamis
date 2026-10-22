export type NombreVista = 'programar' | 'pista';

const VISTAS: NombreVista[] = ['programar', 'pista'];

/**
 * Las pestañas de la banda (Programar | Construir pista): muestran la sección que corresponde.
 * Siguen el patrón de pestañas: una sola en el orden de tabulación y las flechas cambian de pestaña.
 */
export function crearVistas(raiz: Document, eventos: { alCambiar(vista: NombreVista): void }): void {
  const pestana = (v: NombreVista) => raiz.getElementById(`tab-${v}`) as HTMLButtonElement;
  const seccion = (v: NombreVista) => raiz.getElementById(`vista-${v}`)!;
  let actual: NombreVista = 'programar';

  const mostrar = (v: NombreVista) => {
    for (const otra of VISTAS) {
      const activa = otra === v;
      pestana(otra).setAttribute('aria-selected', String(activa));
      pestana(otra).tabIndex = activa ? 0 : -1;
      seccion(otra).hidden = !activa;
    }
    if (v === actual) return;
    actual = v;
    eventos.alCambiar(v);
  };

  for (const v of VISTAS) {
    pestana(v).addEventListener('click', () => mostrar(v));
    pestana(v).addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const siguiente = VISTAS[(VISTAS.indexOf(v) + (e.key === 'ArrowRight' ? 1 : VISTAS.length - 1)) % VISTAS.length];
      mostrar(siguiente);
      pestana(siguiente).focus();
    });
  }
}
