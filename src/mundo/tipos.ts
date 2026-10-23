/**
 * Contrato del mundo (spec §9): primitivas geométricas que usan los modelos.
 * Marco del mundo: x derecha, y arriba, z arriba (mm); yaw antihorario desde +x (rad).
 */
export interface Punto2 { x: number; y: number }
export interface Punto3 { x: number; y: number; z: number }

export interface ObjetoPista { tipo: string; x: number; y: number; rot: number; props: Record<string, unknown> }
export interface ImpactoRayo { distancia: number; objeto: ObjetoPista | null; normal: Punto3 }
export interface Colision { objeto: ObjetoPista; penetracion: number }

export interface Mundo {
  /** Color 0–255 de la superficie en (x, y). */
  muestrear(x: number, y: number): { r: number; g: number; b: number };
  /** Altura del suelo en mm (rampas, plataformas, baches). */
  altura(x: number, y: number): number;
  /** Inclinación del suelo bajo (x, y) para un robot con rumbo yaw (rad). */
  inclinacion(x: number, y: number, yaw: number): { pitch: number; roll: number };
  raycast(origen: Punto3, dir: Punto3, max: number): ImpactoRayo | null;
  colisiona(poligono: Punto2[]): Colision | null;
  objetosCerca(x: number, y: number, radio: number): ObjetoPista[];
}
