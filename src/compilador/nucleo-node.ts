import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArchivosNucleo } from './compilar';

async function leerCabeceras(dir: string, base = dir): Promise<Record<string, string>> {
  const cabeceras: Record<string, string> = {};
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const completa = path.join(dir, entrada.name);
    if (entrada.isDirectory()) Object.assign(cabeceras, await leerCabeceras(completa, base));
    else cabeceras[path.relative(base, completa).split(path.sep).join('/')] = await readFile(completa, 'utf8');
  }
  return cabeceras;
}

/** Lee las cabeceras de src/nucleo/include y el generado/nucleo.a (construido con npm run nucleo). */
export async function cargarNucleoDesdeDisco(raiz = process.cwd()): Promise<ArchivosNucleo> {
  const cabeceras = await leerCabeceras(path.join(raiz, 'src/nucleo/include'));
  let biblioteca: Uint8Array;
  try {
    biblioteca = new Uint8Array(await readFile(path.join(raiz, 'generado/nucleo.a')));
  } catch {
    throw new Error('Falta generado/nucleo.a: ejecuta npm run nucleo');
  }
  return { cabeceras, biblioteca };
}
