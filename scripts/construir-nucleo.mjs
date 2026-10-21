// Compila src/nucleo/src/*.cpp y los archiva en generado/nucleo.a con @yowasp/clang.
// Uso: node scripts/construir-nucleo.mjs [--forzar]
import { runClang, runLLVM, Exit } from '@yowasp/clang';
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opciones from '../src/compilador/opciones.json' with { type: 'json' };

async function listar(dir, base = dir) {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const completa = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...await listar(completa, base));
    else salida.push({ ruta: path.relative(base, completa).split(path.sep).join('/'), completa });
  }
  return salida;
}

function aArbol(planos) {
  const raiz = {};
  for (const [ruta, contenido] of Object.entries(planos)) {
    const partes = ruta.split('/');
    let carpeta = raiz;
    for (const parte of partes.slice(0, -1)) carpeta = carpeta[parte] ??= {};
    carpeta[partes.at(-1)] = contenido;
  }
  return raiz;
}

function leer(arbol, ruta) {
  return ruta.split('/').reduce((nodo, parte) => nodo?.[parte], arbol);
}

async function estaAlDia(salida, archivos) {
  try {
    const generado = (await stat(salida)).mtimeMs;
    const fechas = await Promise.all(archivos.map(a => stat(a.completa).then(s => s.mtimeMs)));
    return generado > Math.max(...fechas);
  } catch {
    return false;
  }
}

export async function construirNucleo({ raiz = process.cwd(), forzar = false } = {}) {
  const dirNucleo = path.join(raiz, 'src/nucleo');
  const salida = path.join(raiz, 'generado/nucleo.a');
  const archivos = await listar(dirNucleo);
  if (!forzar && await estaAlDia(salida, archivos)) return salida;

  // runClang no pasa fetchProgress a sus subprocesos: se precarga LLVM sin imprimir progreso.
  await runLLVM(undefined, {}, { fetchProgress: () => {} });
  const planos = {};
  for (const a of archivos) planos[`nucleo/${a.ruta}`] = new Uint8Array(await readFile(a.completa));
  const decodificador = new TextDecoder();
  const objetos = {};
  for (const fuente of archivos.filter(a => a.ruta.startsWith('src/') && a.ruta.endsWith('.cpp'))) {
    let mensajes = '';
    const capturar = bytes => { if (bytes) mensajes += decodificador.decode(bytes, { stream: true }); };
    const objeto = `nucleo/${fuente.ruta}.o`;
    try {
      const arbol = await runClang(
        ['clang++', ...opciones.cpp, '-Inucleo/include', '-c', `nucleo/${fuente.ruta}`, '-o', objeto],
        aArbol(planos), { stdout: capturar, stderr: capturar, fetchProgress: () => {} });
      objetos[objeto] = leer(arbol, objeto);
    } catch (e) {
      if (e instanceof Exit) throw new Error(`No compiló el núcleo (${fuente.ruta}):\n${mensajes}`);
      throw e;
    }
  }
  const arbol = await runLLVM(['ar', 'rcs', 'nucleo.a', ...Object.keys(objetos)], aArbol(objetos),
    { stdout: null, stderr: null, fetchProgress: () => {} });
  await mkdir(path.dirname(salida), { recursive: true });
  await writeFile(salida, leer(arbol, 'nucleo.a'));
  return salida;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  construirNucleo({ forzar: process.argv.includes('--forzar') })
    .then(salida => console.log(`Núcleo listo: ${path.relative(process.cwd(), salida)}`))
    .catch(e => { console.error(e.message); process.exit(1); });
}
