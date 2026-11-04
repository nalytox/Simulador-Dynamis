import { abrirAlmacen, type Almacen, type DatosGuardados } from './almacen';

/**
 * Por unos días el simulador tuvo perfiles (Marco, Maite…), cada uno con su base de IndexedDB y su
 * marca de recorrido visto. Ahora hay un solo usuario por computador: esto trae lo que se guardó en
 * esos perfiles, una sola vez, sin borrar sus bases.
 */
const PERFILES = [
  ['marco', 'Marco'], ['maite', 'Maite'], ['juan', 'Juan'], ['antonio', 'Antonio'],
  ['agustin', 'Agustin'], ['javier', 'Javier'], ['emilia', 'Emilia'], ['otro', 'Otro/a'],
] as const;
const CLAVES: (keyof DatosGuardados)[] = ['proyecto', 'pista', 'robot', 'preferencias'];

/**
 * La primera vez, si algún perfil tiene un proyecto guardado, copia al almacén lo del primero de la
 * lista (proyecto, pista, robot y preferencias). Devuelve su nombre y el de los otros perfiles que
 * también tenían algo, o null si no había nada que recuperar.
 */
export async function recuperarDePerfiles(almacen: Almacen, fabrica: IDBFactory | undefined = globalThis.indexedDB): Promise<{ recuperado: string | null; otros: string[] }> {
  const nada = { recuperado: null, otros: [] };
  if (!fabrica || await almacen.leer('perfilesRevisados')) return nada;
  // Sin databases() habría que abrir (y así crear) una base por perfil para saber si existe.
  const existentes = fabrica.databases ? new Set((await fabrica.databases()).map(d => d.name)) : null;
  const conTrabajo: { nombre: string; base: Almacen }[] = [];
  for (const [id, nombre] of PERFILES) {
    const nombreBase = `simulador-dynamis-${id}`;
    if (existentes && !existentes.has(nombreBase)) continue;
    const base = await abrirAlmacen(nombreBase, fabrica);
    if (base && await base.leer('proyecto')) conTrabajo.push({ nombre, base });
  }
  const [primero, ...otros] = conTrabajo;
  if (primero) {
    for (const clave of CLAVES) {
      const valor = await primero.base.leer(clave);
      if (valor !== undefined) await almacen.guardar(clave, valor as never);
    }
  }
  await almacen.guardar('perfilesRevisados', true);
  return primero ? { recuperado: primero.nombre, otros: otros.map(o => o.nombre) } : nada;
}

/** Si el recorrido de la primera visita ya se vio en alguno de los perfiles. */
export function recorridoVistoEnPerfiles(local: Pick<Storage, 'getItem'>): boolean {
  return PERFILES.some(([id]) => local.getItem(`dynamis.recorrido.${id}`) === 'visto');
}
