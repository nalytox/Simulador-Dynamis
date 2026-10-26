import type { Accion, Baldosa } from '../pista/tipos';

/** Textos del editor de pista, sin DOM. */
const ACCIONES: Record<Accion, string> = {
  izq: 'Girar a la izquierda', der: 'Girar a la derecha', vuelta: 'Dar la vuelta (180°)', recto: 'Seguir derecho',
};

const cm = (mm: number) => (mm / 10).toLocaleString('es-CL', { maximumFractionDigits: 1 });

export const textoAccion = (a: Accion): string => ACCIONES[a];
export const textoPosicion = (b: Baldosa): string => `Columna ${b.c + 1}, fila ${b.r + 1} · ${b.rot}°`;
export const textoSubida = (mm: number): string => `sube ${cm(mm)} cm`;
export const textoAltura = (mm: number): string => `${cm(mm)} cm`;
