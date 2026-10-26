import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

const FUENTE = 'src/pwa/servicio.ts';
const SALIDA = 'sw.js';

/** Todos los archivos de una carpeta, con rutas relativas y '/'. */
function archivosDe(carpeta: string, raiz = carpeta): string[] {
  return readdirSync(carpeta).flatMap(nombre => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivosDe(ruta, raiz) : [relative(raiz, ruta).split(sep).join('/')];
  });
}

/**
 * Construye el service worker como `sw.js` en la raíz de dist/, y le escribe la lista de
 * archivos de esta versión y una versión que cambia cuando cambia esa lista.
 */
export function pluginPwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'dynamis-pwa',
    apply: 'build',
    configResolved(c) { config = c; },
    buildStart() {
      this.emitFile({ type: 'chunk', id: FUENTE, fileName: SALIDA });
    },
    writeBundle(opciones) {
      const dir = opciones.dir ?? config.build.outDir;
      const archivos = archivosDe(dir).filter(a => a !== SALIDA).sort();
      const version = createHash('sha256').update(archivos.join('\n')).digest('hex').slice(0, 12);
      const ruta = join(dir, SALIDA);
      const codigo = readFileSync(ruta, 'utf8');
      const conLista = codigo.replace(/(["'`])__ARCHIVOS__\1/, JSON.stringify(archivos)).replace(/(["'`])__VERSION__\1/, JSON.stringify(version));
      if (conLista.includes('__ARCHIVOS__') || conLista.includes('__VERSION__')) throw new Error('No pude escribir la lista de archivos en sw.js.');
      writeFileSync(ruta, conLista);
    },
  };
}
