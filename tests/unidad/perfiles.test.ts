import { it, expect } from 'vitest';
import { PERFILES, CLAVE_PERFIL, perfilDeSesion, recordarPerfil, olvidarPerfil, baseDeDatosDe, claveRecorridoDe } from '../../src/proyecto/perfiles';

const sesionFalsa = () => {
  const datos = new Map<string, string>();
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => { datos.set(k, v); }, removeItem: (k: string) => { datos.delete(k); } };
};

it('solo están los siete nombres y Otro/a, en este orden', () => {
  expect(PERFILES.map(p => p.nombre)).toEqual(['Marco', 'Maite', 'Juan', 'Antonio', 'Agustin', 'Javier', 'Emilia', 'Otro/a']);
  expect(new Set(PERFILES.map(p => p.id)).size).toBe(8);
  // El id va en el nombre de la base y en la clave del recorrido: solo letras.
  for (const p of PERFILES) expect(p.id).toMatch(/^[a-z]+$/);
});

it('el perfil elegido se recuerda en la sesión y se puede olvidar', () => {
  const sesion = sesionFalsa();
  expect(perfilDeSesion(sesion)).toBeNull();
  recordarPerfil(sesion, PERFILES[1]);
  expect(perfilDeSesion(sesion)).toEqual(PERFILES[1]);
  olvidarPerfil(sesion);
  expect(perfilDeSesion(sesion)).toBeNull();
});

it('un perfil que no está en la lista no vale', () => {
  const sesion = sesionFalsa();
  sesion.setItem(CLAVE_PERFIL, 'pedro');
  expect(perfilDeSesion(sesion)).toBeNull();
});

it('cada perfil tiene su propia base de datos y su propio recorrido visto', () => {
  expect(new Set(PERFILES.map(baseDeDatosDe)).size).toBe(8);
  expect(new Set(PERFILES.map(claveRecorridoDe)).size).toBe(8);
  expect(baseDeDatosDe(PERFILES[0])).not.toBe('simulador-dynamis');
});
