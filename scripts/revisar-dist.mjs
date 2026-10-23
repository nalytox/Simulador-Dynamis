// Revisa dist/ antes de publicarlo en GitHub Pages (spec §16): ningún archivo de 100 MB o más (el
// límite de Pages) y están la página, el service worker y el manifiesto.
// Uso: node scripts/revisar-dist.mjs dist
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMITE_BYTES = 100 * 1024 * 1024;
const NECESARIOS = ['index.html', 'sw.js', 'manifest.webmanifest'];

function archivos(carpeta) {
  return readdirSync(carpeta).flatMap(nombre => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

/** Los problemas de dist/, en español; vacío si se puede publicar. */
export function revisarDist(dir) {
  const problemas = [];
  for (const ruta of archivos(dir)) {
    const bytes = statSync(ruta).size;
    if (bytes >= LIMITE_BYTES) {
      problemas.push(`${relative(dir, ruta)} pesa ${(bytes / 1024 / 1024).toFixed(1)} MB; GitHub Pages acepta archivos de menos de 100 MB.`);
    }
  }
  for (const necesario of NECESARIOS) {
    if (!existsSync(join(dir, necesario))) problemas.push(`Falta ${necesario}.`);
  }
  return problemas;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problemas = revisarDist(process.argv[2] ?? 'dist');
  for (const p of problemas) console.error(p);
  if (problemas.length > 0) process.exit(1);
  console.log('dist/ está listo para publicar.');
}
