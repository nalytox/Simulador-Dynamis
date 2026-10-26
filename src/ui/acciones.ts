/** La barra de acciones: Probar/Detener, Pausa/Seguir, Volver al inicio, estado y velocidad. */
export type EstadoApp = 'listo' | 'preparando' | 'compilando' | 'corriendo' | 'pausa' | 'terminado' | 'detenido' | 'error';

/** Centésimas de la velocidad real de cada posición del control (decisión 10). */
export const VELOCIDADES = [25, 50, 100, 200, 400];
const ETIQUETAS = ['×0,25', '×0,5', '×1', '×2', '×4'];

export function textoEstado(e: EstadoApp, progreso = 0): string {
  switch (e) {
    case 'listo': return 'Listo para probar';
    case 'preparando': return `Preparando tu laboratorio, solo la primera vez… ${progreso} %`;
    case 'compilando': return 'Revisando tu programa…';
    case 'corriendo': return 'El robot está corriendo';
    case 'pausa': return 'En pausa';
    case 'terminado': return 'Terminó la prueba';
    case 'detenido': return 'Detenido';
    case 'error': return 'Hay que revisar algo';
  }
}

/** Mientras pasa alguna de estas cosas, el botón principal dice "Detener". */
const OCUPADO: ReadonlySet<EstadoApp> = new Set(['preparando', 'compilando', 'corriendo', 'pausa']);
const ICONO_PROBAR = 'M7 4.5v15l12.5-7.5z';
const ICONO_DETENER = 'M6 6h12v12H6z';

export interface EventosAcciones {
  alProbar(): void;
  alDetener(): void;
  alPausar(): void;
  alSeguir(): void;
  alInicio(): void;
  alVelocidad(centesimas: number): void;
}

export function crearAcciones(raiz: Document, eventos: EventosAcciones): { mostrar(e: EstadoApp, progreso?: number): void; fijarVelocidad(centesimas: number): void } {
  const $ = (id: string) => raiz.getElementById(id)!;
  const velocidad = $('vel') as HTMLInputElement;
  const pausa = $('btn-pausa') as HTMLButtonElement;
  let estado: EstadoApp = 'listo';

  $('btn-probar').addEventListener('click', () => (OCUPADO.has(estado) ? eventos.alDetener() : eventos.alProbar()));
  pausa.addEventListener('click', () => (estado === 'pausa' ? eventos.alSeguir() : eventos.alPausar()));
  $('btn-inicio').addEventListener('click', () => eventos.alInicio());
  velocidad.addEventListener('input', () => {
    const i = Number(velocidad.value);
    $('vel-out').textContent = ETIQUETAS[i];
    eventos.alVelocidad(VELOCIDADES[i]);
  });

  return {
    mostrar(e, progreso) {
      estado = e;
      $('txt-estado').textContent = textoEstado(e, progreso);
      $('estado').classList.toggle('vivo', e === 'corriendo');
      $('txt-probar').textContent = OCUPADO.has(e) ? 'Detener' : 'Probar mi robot';
      $('ico-probar').querySelector('path')!.setAttribute('d', OCUPADO.has(e) ? ICONO_DETENER : ICONO_PROBAR);
      pausa.disabled = e !== 'corriendo' && e !== 'pausa';
      $('txt-pausa').textContent = e === 'pausa' ? 'Seguir' : 'Pausa';
    },
    fijarVelocidad(centesimas) {
      const i = Math.max(0, VELOCIDADES.indexOf(centesimas));
      velocidad.value = String(i === 0 && centesimas !== VELOCIDADES[0] ? 2 : i);
      $('vel-out').textContent = ETIQUETAS[Number(velocidad.value)];
    },
  };
}
