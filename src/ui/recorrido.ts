/** Los pasos del recorrido de la primera visita, con el elemento que señala cada uno. */
export const PASOS_RECORRIDO: { selector: string; texto: string }[] = [
  { selector: '#editor', texto: 'Este es tu código' },
  { selector: '#btn-probar', texto: 'Presiona aquí para probar' },
  { selector: '.sensores', texto: 'Aquí ves lo que siente tu robot' },
  { selector: '#tab-pista', texto: 'Aquí construyes la pista' },
];

const VISTO = 'visto';
const MARGEN = 12;

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * El recorrido de la primera visita: un bocadillo con la mascota junto a cada parte de la pantalla.
 * Que ya se vio se recuerda en el navegador con `clave` (una por perfil); es una comodidad, no un dato
 * del trabajo: si no se puede guardar, igual funciona y simplemente se muestra otra vez.
 */
export function crearRecorrido(raiz: Document, clave: string, almacen?: Almacen): { mostrar(): void; mostrarSiEsPrimeraVez(): void } {
  const $ = (id: string) => raiz.getElementById(id)!;
  const caja = $('recorrido');
  const botonSiguiente = $('rec-siguiente') as HTMLButtonElement;
  const ventana = raiz.defaultView!;
  let paso = -1;
  let resaltado: Element | null = null;

  const objetivo = () => raiz.querySelector(PASOS_RECORRIDO[paso].selector);

  /** Junto al elemento: abajo si cabe, si no arriba, y siempre dentro de la ventana. */
  const ubicar = () => {
    const el = objetivo();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const { offsetWidth: ancho, offsetHeight: alto } = caja;
    const maxX = Math.max(MARGEN, ventana.innerWidth - ancho - MARGEN);
    const maxY = Math.max(MARGEN, ventana.innerHeight - alto - MARGEN);
    let y = r.bottom + MARGEN;
    if (y > maxY) y = r.top - alto - MARGEN >= MARGEN ? r.top - alto - MARGEN : maxY;
    caja.style.left = `${Math.min(maxX, Math.max(MARGEN, r.left))}px`;
    caja.style.top = `${Math.min(maxY, Math.max(MARGEN, y))}px`;
  };

  const pintar = () => {
    resaltado?.classList.remove('recorrido-foco');
    resaltado = objetivo();
    resaltado?.classList.add('recorrido-foco');
    resaltado?.scrollIntoView({ block: 'nearest' });
    $('rec-texto').textContent = PASOS_RECORRIDO[paso].texto;
    $('rec-paso').textContent = `${paso + 1} de ${PASOS_RECORRIDO.length}`;
    botonSiguiente.textContent = paso === PASOS_RECORRIDO.length - 1 ? '¡Listo!' : 'Siguiente';
    ubicar();
  };

  const terminar = () => {
    if (paso < 0) return;
    paso = -1;
    caja.hidden = true;
    resaltado?.classList.remove('recorrido-foco');
    resaltado = null;
    try {
      almacen?.setItem(clave, VISTO);
    } catch {
      // Sin almacenamiento, el recorrido vuelve a aparecer la próxima vez: no es grave.
    }
    ($('btn-probar') as HTMLButtonElement).focus();
  };

  botonSiguiente.addEventListener('click', () => {
    if (paso === PASOS_RECORRIDO.length - 1) return terminar();
    paso++;
    pintar();
  });
  $('rec-saltar').addEventListener('click', terminar);
  raiz.addEventListener('keydown', e => {
    if (paso >= 0 && e.key === 'Escape') terminar();
  });
  ventana.addEventListener('resize', () => { if (paso >= 0) ubicar(); });

  const mostrar = () => {
    paso = 0;
    caja.hidden = false;
    pintar();
    botonSiguiente.focus();
  };

  return {
    mostrar,
    mostrarSiEsPrimeraVez() {
      let visto = false;
      try {
        visto = almacen?.getItem(clave) === VISTO;
      } catch {
        visto = false;
      }
      if (!visto && !raiz.querySelector('dialog[open]')) mostrar();
    },
  };
}
