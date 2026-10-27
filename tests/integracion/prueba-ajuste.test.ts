import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import type { ArchivosNucleo } from '../../src/compilador/compilar';
import { ejecutarPruebaDeAjuste } from '../../src/ajuste/prueba';
import * as recompensaDelProfe from '../../src/ajuste/recompensa.js';
import { esFaltaImplementar, type ModuloRecompensa, type RegistroPrueba } from '../../src/ajuste/contrato';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { compilarParaPrueba } from '../ayuda/compilar-prueba';
import { recompensaDePrueba } from '../ayuda/ajuste-de-prueba';
import { pistaDe } from '../ayuda/pistas';

const PISTA = pistaDe({
  columnas: 8, filas: 1, inicio: { x: 150, y: 150, yaw: 0 },
  baldosas: [{ c: 0, r: 0, tipo: 'partida' }, ...[1, 2, 3, 4, 5, 6, 7].map(c => ({ c, r: 0, tipo: 'recta' }))],
});
const SEGUIDOR = {
  'seguidor.ino': readFileSync('src/ejemplos/seguidor/seguidor.ino', 'utf8'),
  'pines.h': readFileSync('src/ejemplos/seguidor/pines.h', 'utf8'),
};
const AVANZAR = `void setup() { pinMode(16, OUTPUT); pinMode(5, OUTPUT); digitalWrite(16, HIGH); digitalWrite(5, HIGH); ledcAttach(4, 5000, 8); ledcAttach(19, 5000, 8); }
void loop() { ledcWrite(4, 60); ledcWrite(19, 60); delay(10); }`;

let nucleo: ArchivosNucleo;
let seguidor: WebAssembly.Module;

/** La recompensa de prueba, guardando el último registro que recibió. */
function espia(base: ModuloRecompensa = recompensaDePrueba): ModuloRecompensa & { registro: RegistroPrueba | null } {
  const m = {
    registro: null as RegistroPrueba | null,
    calcularRecompensa(r: RegistroPrueba) { m.registro = r; return base.calcularRecompensa(r); },
    debeTerminar: base.debeTerminar,
  };
  return m;
}

const prueba = (modulo: WebAssembly.Module, valores: Record<string, number>, extra: Partial<Parameters<typeof ejecutarPruebaDeAjuste>[0]> = {}) =>
  ejecutarPruebaDeAjuste({ modulo, pista: PISTA, robot: ROBOT_POR_DEFECTO, valores, semilla: 11, duracionS: 2, recompensa: recompensaDePrueba, ...extra });

describe('una prueba de entrenamiento', { timeout: 180_000 }, () => {
  beforeAll(async () => {
    nucleo = await cargarNucleoDesdeDisco();
    seguidor = await compilarParaPrueba(SEGUIDOR, nucleo, 'seguidor');
  });

  it('el registro tiene un paso cada 10 ms con estado, lecturas, motores y eventos', async () => {
    const recompensa = espia({ ...recompensaDePrueba, debeTerminar: () => false });
    const r = await prueba(seguidor, {}, { recompensa });
    const registro = recompensa.registro!;
    expect(registro.fin).toEqual({ motivo: 'tiempo', detalle: null });
    expect(registro.pasos.length).toBeGreaterThanOrEqual(199);
    expect(registro.pasos.length).toBeLessThanOrEqual(201);
    expect(registro.pasos[1].t - registro.pasos[0].t).toBeCloseTo(0.01, 6);
    expect(Object.keys(registro.pasos[50]).sort()).toEqual(['estado', 'eventos', 'lecturas', 'motores', 't']);
    expect(registro.pasos[50].lecturas.qtr).toHaveLength(8);
    expect(registro.juez).not.toBeNull();
    expect(r).toMatchObject({ valores: {}, semilla: 11, recompensa: recompensaDePrueba.calcularRecompensa(registro) });
    expect(r.resumen).toMatchObject({ motivo: 'tiempo', detalle: null, meta: false, hitos: 0 });
    expect(r.resumen.t).toBeCloseTo(2, 2);
  });

  it('los valores cambian la prueba y la misma semilla la repite', async () => {
    const sinCorregir = await prueba(seguidor, { 'siguelineas.KP': 0 });
    const conKp = await prueba(seguidor, { 'siguelineas.KP': 0.05 });
    expect(conKp.trayectoria).not.toEqual(sinCorregir.trayectoria);
    expect(await prueba(seguidor, { 'siguelineas.KP': 0.05 })).toEqual(conKp);
  });

  it('debeTerminar corta la prueba con su motivo', async () => {
    const recompensa = espia({ ...recompensaDePrueba, debeTerminar: paso => (paso.t >= 0.5 ? 'medio segundo' : false) });
    const r = await prueba(seguidor, {}, { recompensa });
    expect(recompensa.registro!.fin).toEqual({ motivo: 'termino', detalle: 'medio segundo' });
    expect(r.resumen).toMatchObject({ motivo: 'termino', detalle: 'medio segundo' });
    expect(r.resumen.t).toBeCloseTo(0.5, 2);
  });

  it('un debeTerminar que no devuelve nada deja seguir la prueba', async () => {
    const recompensa = espia({ ...recompensaDePrueba, debeTerminar: paso => (paso.t > 99 ? 'nunca' : undefined) as unknown as false });
    const r = await prueba(seguidor, {}, { recompensa });
    expect(recompensa.registro!.fin).toEqual({ motivo: 'tiempo', detalle: null });
    expect(r.resumen.t).toBeCloseTo(2, 2);
  });

  it('la trayectoria tiene a lo más 200 puntos, con el primero y el último', async () => {
    const modulo = await compilarParaPrueba({ 'p.ino': AVANZAR }, nucleo, 'p');
    const recompensa = espia({ ...recompensaDePrueba, debeTerminar: () => false });
    const r = await prueba(modulo, {}, { recompensa, duracionS: 30 });
    const pasos = recompensa.registro!.pasos;
    expect(r.trayectoria.length).toBeLessThanOrEqual(200);
    expect(r.trayectoria[0]).toEqual({ x: pasos[0].estado.x, y: pasos[0].estado.y });
    expect(r.trayectoria.at(-1)).toEqual({ x: pasos.at(-1)!.estado.x, y: pasos.at(-1)!.estado.y });
  });

  it('un error del programa termina la prueba y la recompensa igual se calcula', async () => {
    const modulo = await compilarParaPrueba({ 'p.ino': 'volatile int cero = 0;\nvoid setup() { Serial.begin(115200); }\nvoid loop() { delay(100); Serial.println(millis() / cero); }' }, nucleo, 'p');
    const recompensa = espia();
    const r = await prueba(modulo, {}, { recompensa });
    expect(recompensa.registro!.fin.motivo).toBe('error');
    expect(recompensa.registro!.fin.detalle).toContain('dividió por cero');
    expect(r.resumen.motivo).toBe('error');
    expect(Number.isFinite(r.recompensa)).toBe(true);
  });

  it('si la recompensa del profe falta, se relanza FaltaImplementar', async () => {
    const error = await prueba(seguidor, {}, { recompensa: recompensaDelProfe as ModuloRecompensa }).catch((e: unknown) => e);
    expect(esFaltaImplementar(error)).toBe(true);
  });

  it('una recompensa que no es un número es un error del profe', async () => {
    const error = await prueba(seguidor, {}, { recompensa: { ...recompensaDePrueba, calcularRecompensa: () => NaN } }).catch((e: unknown) => e) as Error;
    expect(error.name).toBe('ErrorSimulador');
    expect(error.message).toContain('la recompensa del profe');
  });
});
