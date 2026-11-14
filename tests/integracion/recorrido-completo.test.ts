import { describe, it, expect } from 'vitest';
import { correrEjemplo, type CorridaEjemplo } from '../ayuda/correr-ejemplo';
import { pistaDe } from '../ayuda/pistas';
import type { Pista } from '../../src/pista/tipos';

/** El recorrido completo en una pista chica, hasta 60 s. */
const correr = (pista: Pista) => correrEjemplo('recorrido-completo', { pista, segundos: 60 });

/** Llega a la meta sin perder la línea, sin equivocarse de camino y sin tocar el obstáculo. */
function completa(r: CorridaEjemplo) {
  const resumen = `${r.serial}\neventos: ${r.eventos.join(', ')}\nfin: ${JSON.stringify(r.estados.at(-1))}`;
  expect(r.fin.motivo, resumen).toBe('terminado');
  expect(r.fin.juez.meta, resumen).toBe(true);
  expect(r.eventos, resumen).not.toContain('camino-equivocado');
  expect(r.eventos, resumen).not.toContain('perdio-linea');
  expect(r.eventos, resumen).not.toContain('toco-obstaculo');
  expect(r.avisos, resumen).toEqual([]);
}

const ALTO = 300 * Math.tan(20 * Math.PI / 180);
const SIN = { ai: false, ad: false, di: false, dd: false };

describe('Recorrido completo, caso por caso', { timeout: 300_000 }, () => {
  describe('la línea', () => {
    it('rectas y curvas suaves a los dos lados', async () => completa(await correr(pistaDe({ columnas: 5, filas: 2,
      baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'giroSuave', rot: 0 },
        { c: 2, r: 1, tipo: 'giroSuave', rot: 180 }, { c: 3, r: 1, tipo: 'recta' }, { c: 4, r: 1, tipo: 'meta' }] }))));

    it('giro en L a la izquierda', async () => completa(await correr(pistaDe({ columnas: 3, filas: 3,
      baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'giroL', rot: 0 },
        { c: 2, r: 1, tipo: 'recta', rot: 90 }, { c: 2, r: 2, tipo: 'meta', rot: 90 }] }))));

    it('giro en L a la derecha', async () => completa(await correr(pistaDe({ columnas: 3, filas: 3, inicio: { x: 150, y: 750, yaw: 0 },
      baldosas: [{ c: 0, r: 2, tipo: 'partida' }, { c: 1, r: 2, tipo: 'recta' }, { c: 2, r: 2, tipo: 'giroL', rot: 90 },
        { c: 2, r: 1, tipo: 'recta', rot: 270 }, { c: 2, r: 0, tipo: 'meta', rot: 270 }] }))));

    it('cortes de 4 cm', async () => completa(await correr(pistaDe({ columnas: 6, filas: 1,
      baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'cortes', props: { guion: 50, espacio: 40 } },
        { c: 3, r: 0, tipo: 'cortes', props: { guion: 30, espacio: 40 } }, { c: 4, r: 0, tipo: 'recta' }, { c: 5, r: 0, tipo: 'meta' }] }))));

    it('línea blanca sobre fondo negro', async () => completa(await correr(pistaDe({ columnas: 6, filas: 1,
      baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta', props: { invertida: true } },
        { c: 3, r: 0, tipo: 'recta', props: { invertida: true } }, { c: 4, r: 0, tipo: 'recta' }, { c: 5, r: 0, tipo: 'meta' }] }))));

    it('rampa: sube y baja', async () => {
      const r = await correr(pistaDe({ columnas: 7, filas: 1,
        baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'rampa', props: { angulo: 20 } },
          { c: 3, r: 0, tipo: 'recta', nivel: ALTO }, { c: 4, r: 0, tipo: 'rampa', rot: 180, props: { angulo: 20 } },
          { c: 5, r: 0, tipo: 'recta' }, { c: 6, r: 0, tipo: 'meta' }] }));
      completa(r);
      expect(Math.max(...r.estados.map(e => e.z))).toBeGreaterThan(ALTO - 5);
    });

    it('un bache atravesado y otro a 45°', async () => completa(await correr(pistaDe({ columnas: 5, filas: 1,
      baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta' }, { c: 3, r: 0, tipo: 'recta' },
        { c: 4, r: 0, tipo: 'meta' }],
      objetos: [{ tipo: 'bache', x: 450, y: 150, rot: 90, props: { largo: 250, radio: 6 } },
        { tipo: 'bache', x: 750, y: 150, rot: 45, props: { largo: 200, radio: 6 } }] }))));
  });
});

export { SIN };
