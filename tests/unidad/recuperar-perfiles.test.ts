import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { it, expect } from 'vitest';
import { abrirAlmacen, BASE_DATOS } from '../../src/proyecto/almacen';
import { recuperarDePerfiles, recorridoVistoEnPerfiles } from '../../src/proyecto/recuperar-perfiles';

const proyecto = (texto: string) => ({ nombre: 'p', archivos: { 'p.ino': texto } });

it('la primera vez, el trabajo guardado en un perfil pasa al almacén único', async () => {
  const fabrica = new IDBFactory();
  const juan = await abrirAlmacen('simulador-dynamis-juan', fabrica);
  await juan!.guardar('proyecto', proyecto('// de Juan'));
  await juan!.guardar('preferencias', { velocidad: 200 });
  const almacen = (await abrirAlmacen(BASE_DATOS, fabrica))!;
  await almacen.guardar('proyecto', proyecto('// de antes de los perfiles'));

  expect(await recuperarDePerfiles(almacen, fabrica)).toEqual({ recuperado: 'Juan', otros: [] });
  expect((await almacen.leer('proyecto'))?.archivos['p.ino']).toBe('// de Juan');
  expect(await almacen.leer('preferencias')).toEqual({ velocidad: 200 });
  // La base del perfil queda intacta, y la próxima vez ya no se revisa.
  expect((await juan!.leer('proyecto'))?.archivos['p.ino']).toBe('// de Juan');
  await almacen.guardar('proyecto', proyecto('// nuevo'));
  expect(await recuperarDePerfiles(almacen, fabrica)).toEqual({ recuperado: null, otros: [] });
  expect((await almacen.leer('proyecto'))?.archivos['p.ino']).toBe('// nuevo');
});

it('con varios perfiles guardados, recupera el primero de la lista y nombra los demás', async () => {
  const fabrica = new IDBFactory();
  for (const id of ['emilia', 'maite']) await (await abrirAlmacen(`simulador-dynamis-${id}`, fabrica))!.guardar('proyecto', proyecto(`// ${id}`));
  const almacen = (await abrirAlmacen(BASE_DATOS, fabrica))!;
  expect(await recuperarDePerfiles(almacen, fabrica)).toEqual({ recuperado: 'Maite', otros: ['Emilia'] });
  expect((await almacen.leer('proyecto'))?.archivos['p.ino']).toBe('// maite');
});

it('sin perfiles guardados, el almacén queda como estaba y no crea bases de perfiles', async () => {
  const fabrica = new IDBFactory();
  const almacen = (await abrirAlmacen(BASE_DATOS, fabrica))!;
  await almacen.guardar('proyecto', proyecto('// mío'));
  expect(await recuperarDePerfiles(almacen, fabrica)).toEqual({ recuperado: null, otros: [] });
  expect((await almacen.leer('proyecto'))?.archivos['p.ino']).toBe('// mío');
  expect((await fabrica.databases()).map(d => d.name)).toEqual([BASE_DATOS]);
});

it('el recorrido ya visto en algún perfil cuenta como visto', () => {
  const local = new Map([['dynamis.recorrido.otro', 'visto']]);
  expect(recorridoVistoEnPerfiles({ getItem: k => local.get(k) ?? null })).toBe(true);
  expect(recorridoVistoEnPerfiles({ getItem: () => null })).toBe(false);
});
