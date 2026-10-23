import { describe, it, expect, beforeAll } from 'vitest';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import { compilar, type ArchivosNucleo } from '../../src/compilador/compilar';
import { PISTAS_DE_EJEMPLO, PROYECTOS_DE_EJEMPLO, type IdPista } from '../../src/ejemplos';
import { celdaDe } from '../../src/pista/baldosas';
import type { Baldosa, Lado, Pista } from '../../src/pista/tipos';
import { correrEjemplo } from '../ayuda/correr-ejemplo';
import { entradasDe, recorridoEsperado } from '../ayuda/recorrido';

const GRADOS = Math.PI / 180;
/** Diferencia de ángulos en (−π, π]. */
const giro = (desde: number, hasta: number) => Math.atan2(Math.sin(hasta - desde), Math.cos(hasta - desde));

const pista = (id: IdPista): Pista => PISTAS_DE_EJEMPLO.find(p => p.id === id)!.pista;

/** El número del primer hito que el recorrido esperado alcanza después de la primera baldosa que cumple `es`. */
function hitoDespuesDe(p: Pista, es: (b: Baldosa, entrada: Lado) => boolean): number {
  const recorrido = recorridoEsperado(p);
  const entradas = entradasDe(recorrido);
  const desde = recorrido.findIndex((b, i) => es(b, entradas[i]));
  expect(desde).toBeGreaterThanOrEqual(0);
  const hitos = p.objetos.flatMap(o => {
    if (o.tipo !== 'hito') return [];
    const { c, r } = celdaDe(o.x, o.y);
    return [{ numero: o.props.numero, en: recorrido.findIndex(b => b.c === c && b.r === r) }];
  });
  return hitos.filter(h => h.en > desde).sort((a, b) => a.en - b.en)[0].numero;
}

let nucleo: ArchivosNucleo;
beforeAll(async () => { nucleo = await cargarNucleoDesdeDisco(); });

describe('proyectos de ejemplo', { timeout: 300_000 }, () => {
  it('cada ejemplo compila sin errores', async () => {
    for (const e of PROYECTOS_DE_EJEMPLO) {
      const r = await compilar(e.proyecto, nucleo);
      expect(r.ok ? [] : r.diagnosticos.map(d => `${d.archivo}:${d.linea}: ${d.mensaje}`), e.id).toEqual([]);
    }
  });

  it('Mover los motores avanza, gira y retrocede', async () => {
    const { serial, avisos, estados } = await correrEjemplo('mover-motores', { segundos: 8 });
    const [inicio] = estados;
    const primerGiro = estados.find(e => Math.abs(giro(inicio.yaw, e.yaw)) > 10 * GRADOS)!;
    expect(primerGiro).toBeDefined();
    expect(primerGiro.x - inicio.x).toBeGreaterThanOrEqual(100);
    expect(Math.max(...estados.map(e => Math.abs(giro(inicio.yaw, e.yaw))))).toBeGreaterThanOrEqual(60 * GRADOS);
    expect(serial).toContain('Adelante');
    expect(serial).toContain('Giro');
    expect(serial).toContain('Atrás');
    expect(avisos).toEqual([]);
  });

  it('Leer la línea muestra la posición', async () => {
    const { serial, avisos } = await correrEjemplo('leer-linea', { segundos: 5 });
    expect(serial.match(/^Línea en \d+/gm)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(avisos).toEqual([]);
  });

  it('el seguidor PID termina la pista de práctica', async () => {
    const { fin, eventos } = await correrEjemplo('seguidor-pid');
    expect(fin).toMatchObject({ motivo: 'terminado', juez: { hitos: ['alcanzado', 'alcanzado'], meta: true } });
    expect(eventos).not.toContain('perdio-linea');
  });

  it('Cruzar cortes pasa la línea cortada', async () => {
    const hito = hitoDespuesDe(pista('cruces'), b => b.tipo === 'cortes');
    const { fin, serial } = await correrEjemplo('cruzar-cortes');
    expect(fin.juez.hitos[hito - 1], `hito ${hito}`).toBe('alcanzado');
    // En su pista hay cruces con marcas, que este ejemplo no lee: lo dice al perder la línea.
    expect(serial).toContain('«Leer marcas de color en cruces»');
  });

  it('Leer marcas de color termina la pista de cruces', async () => {
    const { fin, eventos } = await correrEjemplo('marcas-color');
    expect(fin).toMatchObject({ motivo: 'terminado', juez: { hitos: Array(8).fill('alcanzado'), meta: true } });
    expect(eventos).not.toContain('camino-equivocado');
    expect(eventos).not.toContain('perdio-linea');
  });

  it('Subir la rampa sube y baja', async () => {
    // Una rampa sube hacia su borde este: entrar por el este es bajar.
    const hito = hitoDespuesDe(pista('rampa'), (b, entrada) => b.tipo === 'rampa' && entrada === 'este');
    const { fin, serial, estados } = await correrEjemplo('subir-rampa', { segundos: 20 });
    expect(fin.juez.hitos[hito - 1], `hito ${hito}`).toBe('alcanzado');
    expect(serial).toContain('Subiendo');
    expect(Math.max(...estados.map(e => Math.abs(e.pitch)))).toBeGreaterThanOrEqual(10 * GRADOS);
  });

  it('Esquivar el obstáculo lo rodea sin tocarlo', async () => {
    const { fin, eventos } = await correrEjemplo('esquivar-obstaculo');
    expect(fin).toMatchObject({ motivo: 'terminado', juez: { hitos: Array(8).fill('alcanzado'), meta: true } });
    expect(eventos).not.toContain('toco-obstaculo');
  });

  it('Leer el giroscopio gira 90°', async () => {
    const { serial, avisos, estados } = await correrEjemplo('leer-giroscopio', { segundos: 8 });
    expect(serial).toContain('Giré 90');
    // El programa gira a la izquierda: el ángulo crece (sentido antihorario visto desde arriba).
    expect(Math.abs(giro(estados[0].yaw, estados.at(-1)!.yaw) - 90 * GRADOS)).toBeLessThanOrEqual(10 * GRADOS);
    expect(avisos).toEqual([]);
  });
});
