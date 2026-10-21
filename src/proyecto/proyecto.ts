/** Un proyecto Arduino: una carpeta con archivos .ino, .h, .cpp y .c. */
export interface Proyecto {
  nombre: string;
  /** Rutas relativas con '/', por ejemplo 'seguidor.ino' o 'src/util.cpp'. */
  archivos: Record<string, string>;
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

/** El .ino principal: el que se llama como la carpeta o, si no existe, el primero de la raíz en orden alfabético. */
export function archivoPrincipal(p: Proyecto): string | null {
  const inoRaiz = Object.keys(p.archivos)
    .filter(r => !r.includes('/') && tipoDeArchivo(r) === 'ino')
    .sort(comparar);
  return inoRaiz.find(r => r === `${p.nombre}.ino`) ?? inoRaiz[0] ?? null;
}

/** Rutas del proyecto con el archivo principal primero y el resto en orden alfabético. */
export function ordenarArchivos(p: Proyecto): string[] {
  const principal = archivoPrincipal(p);
  const resto = Object.keys(p.archivos).filter(r => r !== principal).sort(comparar);
  return principal ? [principal, ...resto] : resto;
}
