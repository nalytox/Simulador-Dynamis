import type { Proyecto } from '../proyecto/proyecto';

const EXTENSION = /\.(ino|h|hpp|c|cpp)$/i;
const CARACTERES = /^[A-Za-z0-9_\-./]+$/;

/** El problema con un nombre de archivo nuevo (o renombrado), o null si sirve. */
export function validarNombreArchivo(p: Proyecto, nombre: string, actual?: string): string | null {
  const n = nombre.trim();
  if (n === '') return 'Escribe un nombre para el archivo.';
  if (!CARACTERES.test(n) || n.includes('..') || n.startsWith('/')) return 'Usa solo letras sin tilde, números, guiones y puntos.';
  if (!EXTENSION.test(n)) return 'El archivo debe terminar en .ino, .h, .hpp, .c o .cpp.';
  if (n !== actual && n in p.archivos) return 'Ya existe un archivo con ese nombre.';
  return null;
}

/** Por qué no se puede borrar un archivo, o null si se puede. */
export function puedeBorrar(p: Proyecto, ruta: string): string | null {
  const inoRaiz = Object.keys(p.archivos).filter(r => !r.includes('/') && /\.ino$/i.test(r));
  if (inoRaiz.length === 1 && inoRaiz[0] === ruta) return 'Tu proyecto necesita al menos un archivo .ino.';
  return null;
}
