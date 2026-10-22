import { it, expect } from 'vitest';
import {
  agregarObjeto, baldosaEn, cambiarBaldosa, colocarBaldosa, girarBaldosa, girarObjeto, moverInicio,
  moverObjeto, quitarObjeto, redimensionar, subidaRampa, vaciarCelda, cambiarObjeto,
} from '../../src/pista/edicion';
import { pistaVacia } from '../../src/pista/serializacion';
import type { Pista } from '../../src/pista/tipos';

const subida = (grados: number) => 300 * Math.tan(grados * Math.PI / 180);

function congelar<T>(x: T): T {
  if (typeof x === 'object' && x !== null) {
    for (const v of Object.values(x)) congelar(v);
    Object.freeze(x);
  }
  return x;
}

it('colocar una pieza completa sus propiedades por defecto', () => {
  let p = colocarBaldosa(pistaVacia(), 1, 0, 'rampa');
  p = colocarBaldosa(p, 2, 0, 'cortes');
  p = colocarBaldosa(p, 3, 0, 'cruce');
  expect(baldosaEn(p, 1, 0)).toMatchObject({ tipo: 'rampa', rot: 0, nivel: 0, props: { angulo: 20, invertida: false } });
  expect(baldosaEn(p, 2, 0)!.props).toEqual({ invertida: false, guion: 50, espacio: 40 });
  expect(baldosaEn(p, 3, 0)!.props).toEqual({ invertida: false, marcas: { ai: false, ad: false, di: false, dd: false } });
  expect(baldosaEn(p, 4, 0)).toBeNull();
});

it('colocar con propiedades y rotación las respeta', () => {
  const p = colocarBaldosa(pistaVacia(), 0, 0, 'cruce', 90, { marcas: { ai: true } });
  expect(baldosaEn(p, 0, 0)).toMatchObject({ rot: 90, props: { marcas: { ai: true, ad: false, di: false, dd: false } } });
});

it('colocar sobre una baldosa existente la reemplaza y conserva su nivel', () => {
  let p = colocarBaldosa(pistaVacia(), 2, 1, 'recta');
  p = cambiarBaldosa(p, 2, 1, { nivel: 50 });
  p = colocarBaldosa(p, 2, 1, 'giroL', 180);
  expect(p.baldosas.filter(b => b.c === 2 && b.r === 1)).toHaveLength(1);
  expect(baldosaEn(p, 2, 1)).toMatchObject({ tipo: 'giroL', rot: 180, nivel: 50 });
});

it('girarBaldosa suma o resta 90° y da la vuelta en 0 y 270', () => {
  let p = colocarBaldosa(pistaVacia(), 0, 0, 'recta', 270);
  p = girarBaldosa(p, 0, 0, 1);
  expect(baldosaEn(p, 0, 0)!.rot).toBe(0);
  p = girarBaldosa(p, 0, 0, -1);
  expect(baldosaEn(p, 0, 0)!.rot).toBe(270);
  p = girarBaldosa(p, 0, 0, -1);
  expect(baldosaEn(p, 0, 0)!.rot).toBe(180);
  expect(girarBaldosa(p, 5, 5, 1)).toEqual(p);
});

it('vaciarCelda quita la baldosa', () => {
  const p = vaciarCelda(colocarBaldosa(pistaVacia(), 3, 2, 'recta'), 3, 2);
  expect(baldosaEn(p, 3, 2)).toBeNull();
  expect(p.baldosas).toEqual([]);
});

it('una rampa ajusta el nivel de la baldosa siguiente en la dirección de subida', () => {
  let p = colocarBaldosa(pistaVacia(), 2, 0, 'recta');
  p = colocarBaldosa(p, 1, 0, 'rampa');
  expect(baldosaEn(p, 2, 0)!.nivel).toBeCloseTo(109.19, 2);

  let q = colocarBaldosa(pistaVacia(), 1, 1, 'recta', 90);
  q = colocarBaldosa(q, 1, 0, 'rampa', 90);
  expect(baldosaEn(q, 1, 1)!.nivel).toBeCloseTo(109.19, 2);

  p = cambiarBaldosa(p, 1, 0, { props: { angulo: 30 } });
  expect(baldosaEn(p, 2, 0)!.nivel).toBeCloseTo(173.21, 2);
  p = cambiarBaldosa(p, 1, 0, { nivel: 100 });
  expect(baldosaEn(p, 2, 0)!.nivel).toBeCloseTo(273.21, 2);

  const sola = colocarBaldosa(pistaVacia(), 7, 0, 'rampa');
  expect(sola.baldosas).toHaveLength(1);
});

it('dos rampas seguidas encadenan los niveles', () => {
  let p = colocarBaldosa(pistaVacia(), 3, 0, 'recta');
  p = colocarBaldosa(p, 2, 0, 'rampa');
  p = colocarBaldosa(p, 1, 0, 'rampa');
  expect(baldosaEn(p, 2, 0)!.nivel).toBeCloseTo(subida(20), 6);
  expect(baldosaEn(p, 3, 0)!.nivel).toBeCloseTo(2 * subida(20), 6);
});

it('una pieza nueva al final de una rampa queda a la altura de su parte alta', () => {
  let p = colocarBaldosa(pistaVacia(), 1, 0, 'rampa');
  p = colocarBaldosa(p, 2, 0, 'recta');
  expect(baldosaEn(p, 2, 0)!.nivel).toBeCloseTo(subida(20), 6);
  expect(baldosaEn(colocarBaldosa(p, 0, 0, 'recta'), 0, 0)!.nivel).toBe(0);
});

it('subidaRampa da los mm que sube una rampa, y 0 si no es rampa', () => {
  const p = colocarBaldosa(colocarBaldosa(pistaVacia(), 0, 0, 'rampa'), 1, 0, 'recta');
  expect(subidaRampa(baldosaEn(p, 0, 0)!)).toBeCloseTo(109.19, 2);
  expect(subidaRampa(baldosaEn(p, 1, 0)!)).toBe(0);
});

it('cambiarBaldosa mezcla las propiedades', () => {
  let p = colocarBaldosa(pistaVacia(), 0, 0, 'cortes');
  p = cambiarBaldosa(p, 0, 0, { props: { espacio: 30 } });
  expect(baldosaEn(p, 0, 0)!.props).toEqual({ invertida: false, guion: 50, espacio: 30 });
});

it('los baches se orientan con la línea de la baldosa', () => {
  const p = colocarBaldosa(pistaVacia(), 1, 1, 'recta', 90);
  const recto = agregarObjeto(p, 'bache-recto', 450, 450);
  expect(recto.pista.objetos[recto.indice]).toMatchObject({ tipo: 'bache', rot: 180, props: { largo: 300, radio: 6 } });
  const diagonal = agregarObjeto(p, 'bache-diagonal', 450, 450);
  expect(diagonal.pista.objetos[diagonal.indice]).toMatchObject({ tipo: 'bache', rot: 135 });
  const sinBaldosa = agregarObjeto(p, 'bache-recto', 1650, 1650);
  expect(sinBaldosa.pista.objetos[sinBaldosa.indice].rot).toBe(90);
});

it('los hitos y desafíos se numeran solos', () => {
  let p = colocarBaldosa(pistaVacia(), 2, 0, 'recta', 180);
  p = agregarObjeto(p, 'hito', 150, 150).pista;
  p = agregarObjeto(p, 'hito', 450, 150).pista;
  const tercero = agregarObjeto(p, 'hito', 750, 150);
  expect(tercero.indice).toBe(2);
  expect(tercero.pista.objetos[2]).toEqual({ tipo: 'hito', x: 750, y: 150, rot: 0, props: { numero: 3, yaw: 180 } });
  const desafio = agregarObjeto(tercero.pista, 'desafio', 750, 150);
  expect(desafio.pista.objetos[desafio.indice]).toEqual({ tipo: 'desafio', x: 750, y: 150, rot: 0, props: { nombre: 'F1', yaw: 180, hitoSiguiente: 4 } });
  const segundo = agregarObjeto(desafio.pista, 'desafio', 150, 150);
  expect(segundo.pista.objetos[segundo.indice].props).toMatchObject({ nombre: 'F2', yaw: 0 });
});

it('al borrar un hito no se renumera', () => {
  let p = pistaVacia();
  for (const x of [150, 450, 750]) p = agregarObjeto(p, 'hito', x, 150).pista;
  p = quitarObjeto(p, 0);
  expect(p.objetos.map(o => o.props)).toEqual([{ numero: 2, yaw: 0 }, { numero: 3, yaw: 0 }]);
  expect(agregarObjeto(p, 'hito', 150, 150).pista.objetos[2].props).toEqual({ numero: 4, yaw: 0 });
});

it('agregarObjeto ajusta la posición a 1 cm', () => {
  const { pista, indice } = agregarObjeto(pistaVacia(), 'obstaculo', 453, 147);
  expect(pista.objetos[indice]).toEqual({ tipo: 'obstaculo', x: 450, y: 150, rot: 0, props: { ancho: 100, largo: 100, alto: 100 } });
  expect(moverObjeto(pista, indice, 1234, 566).objetos[indice]).toMatchObject({ x: 1230, y: 570 });
});

it('girarObjeto gira 90° un obstáculo, 45° un bache y el yaw de un hito', () => {
  let p = agregarObjeto(pistaVacia(), 'obstaculo', 450, 450).pista;
  p = agregarObjeto(p, 'bache-recto', 750, 450).pista;
  p = agregarObjeto(p, 'hito', 1050, 450).pista;
  p = agregarObjeto(p, 'desafio', 1350, 450).pista;
  for (let i = 0; i < 4; i++) p = girarObjeto(p, i);
  expect(p.objetos[0].rot).toBe(90);
  expect(p.objetos[1].rot).toBe(135);
  expect(p.objetos[2]).toMatchObject({ rot: 0, props: { yaw: 90 } });
  expect(p.objetos[3]).toMatchObject({ rot: 0, props: { yaw: 90 } });
  for (let i = 0; i < 3; i++) p = girarObjeto(p, 2);
  expect(p.objetos[2].props).toMatchObject({ yaw: 0 });
});

it('cambiarObjeto cambia la posición, el giro o las propiedades', () => {
  let p = agregarObjeto(pistaVacia(), 'obstaculo', 450, 450).pista;
  p = cambiarObjeto(p, 0, { x: 600, rot: 30, alto: 50 });
  expect(p.objetos[0]).toEqual({ tipo: 'obstaculo', x: 600, y: 450, rot: 30, props: { ancho: 100, largo: 100, alto: 50 } });
});

it('moverInicio mueve el inicio ajustado a 1 cm y conserva el yaw si no se da', () => {
  let p = moverInicio(pistaVacia(), 456, 744);
  expect(p.inicio).toEqual({ x: 460, y: 740, yaw: 0 });
  p = moverInicio(p, 450, 750, 90);
  expect(p.inicio).toEqual({ x: 450, y: 750, yaw: 90 });
});

it('redimensionar quita lo que queda fuera y mueve el inicio adentro', () => {
  let p: Pista = colocarBaldosa(pistaVacia(8, 6), 5, 1, 'recta');
  p = colocarBaldosa(p, 1, 1, 'recta');
  p = agregarObjeto(p, 'hito', 1650, 450).pista;
  p = agregarObjeto(p, 'hito', 450, 450).pista;
  p = moverInicio(p, 2000, 1000);
  const { pista, quitados } = redimensionar(p, 4, 3);
  expect(quitados).toBe(2);
  expect([pista.columnas, pista.filas]).toEqual([4, 3]);
  expect(pista.baldosas.map(b => [b.c, b.r])).toEqual([[1, 1]]);
  expect(pista.objetos).toHaveLength(1);
  expect(pista.inicio.x).toBeGreaterThan(0);
  expect(pista.inicio.x).toBeLessThan(1200);
  expect(pista.inicio.y).toBeGreaterThan(0);
  expect(pista.inicio.y).toBeLessThan(900);
  expect(redimensionar(p, 40, 1).pista).toMatchObject({ columnas: 16, filas: 2 });
  expect(redimensionar(p, 0, 99).pista).toMatchObject({ columnas: 2, filas: 12 });
  expect(redimensionar(p, 10, 8)).toMatchObject({ quitados: 0, pista: { inicio: { x: 2000, y: 1000 } } });
});

it('ninguna función cambia la pista original', () => {
  let p = colocarBaldosa(pistaVacia(), 2, 0, 'recta');
  p = colocarBaldosa(p, 1, 0, 'rampa');
  p = agregarObjeto(p, 'hito', 450, 150).pista;
  const antes = structuredClone(p);
  congelar(p);
  colocarBaldosa(p, 1, 0, 'rampa', 0, { angulo: 30 });
  colocarBaldosa(p, 3, 3, 'recta');
  girarBaldosa(p, 2, 0, 1);
  vaciarCelda(p, 2, 0);
  cambiarBaldosa(p, 1, 0, { nivel: 40, props: { angulo: 10 } });
  agregarObjeto(p, 'desafio', 450, 150);
  moverObjeto(p, 0, 0, 0);
  girarObjeto(p, 0);
  cambiarObjeto(p, 0, { numero: 7 });
  quitarObjeto(p, 0);
  moverInicio(p, 900, 900, 90);
  redimensionar(p, 2, 2);
  expect(p).toEqual(antes);
});

it('dos rampas enfrentadas forman un pico y no se cuelgan', () => {
  let p = colocarBaldosa(pistaVacia(), 1, 0, 'rampa');
  p = colocarBaldosa(p, 2, 0, 'rampa');
  p = girarBaldosa(girarBaldosa(p, 2, 0, 1), 2, 0, 1);
  // La de (2, 0) sube hacia el oeste: su parte alta queda junto a la parte alta de la de (1, 0).
  expect(baldosaEn(p, 2, 0)!.rot).toBe(180);
  expect(baldosaEn(p, 1, 0)!.nivel).toBeCloseTo(0, 6);
  expect(baldosaEn(p, 2, 0)!.nivel).toBeCloseTo(0, 6);
  // En el otro orden, igual.
  let q = colocarBaldosa(pistaVacia(), 2, 0, 'rampa', 180);
  q = colocarBaldosa(q, 1, 0, 'rampa');
  expect(baldosaEn(q, 1, 0)!.nivel).toBeCloseTo(0, 6);
  expect(baldosaEn(q, 2, 0)!.nivel).toBeCloseTo(0, 6);
});

it('un ciclo de cuatro rampas termina', () => {
  let p = colocarBaldosa(pistaVacia(), 0, 0, 'rampa', 0);
  p = colocarBaldosa(p, 1, 0, 'rampa', 90);
  p = colocarBaldosa(p, 1, 1, 'rampa', 180);
  p = colocarBaldosa(p, 0, 1, 'rampa', 270);
  p = cambiarBaldosa(p, 0, 0, { props: { angulo: 25 } });
  expect(p.baldosas).toHaveLength(4);
  expect(p.baldosas.every(b => Number.isFinite(b.nivel))).toBe(true);
});

it('una pieza junto al costado de una rampa queda a la altura del medio del borde', () => {
  // La rampa de (1, 1) sube hacia el norte: la recta de (2, 1) ve su costado.
  let p = colocarBaldosa(pistaVacia(), 1, 1, 'rampa', 90);
  p = colocarBaldosa(p, 1, 2, 'recta');
  expect(baldosaEn(p, 1, 2)!.nivel).toBeCloseTo(subida(20), 6);
  const q = colocarBaldosa(p, 2, 1, 'rampa', 0);
  expect(baldosaEn(q, 2, 1)!.nivel).toBe(0);
});

it('girar una rampa baja la baldosa que había subido y sube la nueva', () => {
  let p = pistaVacia();
  for (const [c, r] of [[2, 1], [1, 2], [0, 1], [1, 0]]) p = colocarBaldosa(p, c, r, 'recta');
  p = colocarBaldosa(p, 1, 1, 'rampa');
  const niveles = () => [[2, 1], [1, 2], [0, 1], [1, 0]].map(([c, r]) => Math.round(baldosaEn(p, c, r)!.nivel * 100) / 100);
  expect(niveles()).toEqual([109.19, 0, 0, 0]);
  p = girarBaldosa(p, 1, 1, 1);
  expect(niveles()).toEqual([0, 109.19, 0, 0]);
  p = girarBaldosa(p, 1, 1, 1);
  expect(niveles()).toEqual([0, 0, 109.19, 0]);
  p = girarBaldosa(p, 1, 1, 1);
  p = girarBaldosa(p, 1, 1, 1);
  expect(niveles()).toEqual([109.19, 0, 0, 0]);
});

it('girar una rampa no baja una baldosa que el estudiante subió a otra altura', () => {
  let p = colocarBaldosa(colocarBaldosa(pistaVacia(), 2, 1, 'recta'), 1, 1, 'rampa');
  p = cambiarBaldosa(p, 2, 1, { nivel: 300 });
  p = girarBaldosa(p, 1, 1, 1);
  expect(baldosaEn(p, 2, 1)!.nivel).toBe(300);
});

it('mover un objeto o el inicio no los deja fuera de la grilla', () => {
  let p = agregarObjeto(pistaVacia(), 'hito', 450, 450).pista;
  p = moverObjeto(p, 0, -500, 99999);
  expect(p.objetos[0]).toMatchObject({ x: 0, y: 1790 });
  p = moverInicio(p, 5000, -40);
  expect(p.inicio).toMatchObject({ x: 2390, y: 0 });
  expect(agregarObjeto(p, 'obstaculo', 2400, 1800).pista.objetos[1]).toMatchObject({ x: 2390, y: 1790 });
});
