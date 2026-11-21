import { buscarDefiniciones } from '../compilador/prototipos';
/** Un proyecto Arduino: una carpeta con archivos .ino, .h, .cpp y .c. */
export interface Proyecto {
  nombre: string;
  /** Rutas relativas con '/', por ejemplo 'seguidor.ino' o 'src/util.cpp'. */
  archivos: Record<string, string>;
  /** El orden de las pestañas que eligió el estudiante (las rutas que faltan van al final). */
  orden?: string[];
  /** El programa que se ejecuta: un .ino de la raíz. Sin él, vale la regla de archivoPrincipal. */
  principal?: string;
}

export type TipoArchivo = 'ino' | 'cpp' | 'c' | 'cabecera' | 'otro';

const TIPOS: Record<string, TipoArchivo> = {
  ino: 'ino', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'cabecera', hpp: 'cabecera',
};

export function tipoDeArchivo(ruta: string): TipoArchivo {
  const punto = ruta.lastIndexOf('.');
  if (punto < 0 || punto < ruta.lastIndexOf('/')) return 'otro';
  return TIPOS[ruta.slice(punto + 1).toLowerCase()] ?? 'otro';
}

const comparar = (a: string, b: string) => a.localeCompare(b, 'es');

const esProgramaDeLaRaiz = (r: string) => !r.includes('/') && tipoDeArchivo(r) === 'ino';

/**
 * El .ino que se ejecuta: el elegido en «Programa a ejecutar»; si no hay uno elegido (o ya no
 * existe), el que se llama como la carpeta; si no existe, el primero de la raíz (en orden alfabético)
 * que tiene setup() o loop(); y si ninguno los tiene, el primero.
 */
export function archivoPrincipal(p: Proyecto): string | null {
  if (p.principal && p.principal in p.archivos && esProgramaDeLaRaiz(p.principal)) return p.principal;
  const inoRaiz = Object.keys(p.archivos).filter(esProgramaDeLaRaiz).sort(comparar);
  return inoRaiz.find(r => r === `${p.nombre}.ino`)
    ?? inoRaiz.find(r => tieneSetupOLoop(p.archivos[r]))
    ?? inoRaiz[0] ?? null;
}

/**
 * Las rutas en el orden de las pestañas: el que eligió el estudiante (sin las que ya no existen y con
 * las nuevas al final, en orden alfabético) o, si nunca las movió, el principal primero y el resto en
 * orden alfabético.
 */
export function ordenarArchivos(p: Proyecto): string[] {
  if (p.orden) {
    const conocidas = p.orden.filter((r, i) => r in p.archivos && p.orden!.indexOf(r) === i);
    const nuevas = Object.keys(p.archivos).filter(r => !conocidas.includes(r)).sort(comparar);
    return [...conocidas, ...nuevas];
  }
  const principal = archivoPrincipal(p);
  const resto = Object.keys(p.archivos).filter(r => r !== principal).sort(comparar);
  return principal ? [principal, ...resto] : resto;
}

/** Lleva una pestaña a la posición `aIndice` (de 0 al número de archivos − 1) y guarda el orden completo. */
export function moverArchivo(p: Proyecto, ruta: string, aIndice: number): Proyecto {
  const orden = ordenarArchivos(p).filter(r => r !== ruta);
  orden.splice(Math.max(0, Math.min(orden.length, aIndice)), 0, ruta);
  return { ...p, orden };
}

/** Los programas que se pueden elegir: los .ino de la raíz, en el orden de las pestañas. */
export function programasDelProyecto(p: Proyecto): string[] {
  return ordenarArchivos(p).filter(esProgramaDeLaRaiz);
}

/** ¿Este código define setup() o loop()? Entonces es un programa, no una pestaña de ayuda. */
export function tieneSetupOLoop(texto: string): boolean {
  return buscarDefiniciones(texto).some(d => /\b(setup|loop)\s*\(/.test(d.prototipo));
}

/**
 * Lo que se compila: el programa elegido, los demás .ino de la raíz que no tienen su propio setup()
 * ni loop() (pestañas de ayuda, en el orden de las pestañas), y los .h, .cpp y .c. Los otros .ino con
 * setup() o loop() son otros programas y quedan fuera.
 */
export function archivosCompilados(p: Proyecto): string[] {
  const principal = archivoPrincipal(p);
  const resto = ordenarArchivos(p).filter(r => r !== principal
    && (!esProgramaDeLaRaiz(r) || !tieneSetupOLoop(p.archivos[r])));
  return principal ? [principal, ...resto] : resto;
}
