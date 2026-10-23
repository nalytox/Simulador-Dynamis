import { describe, it, expect, beforeAll } from 'vitest';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import { compilar, type ArchivosNucleo } from '../../src/compilador/compilar';
import { PROYECTOS_DE_EJEMPLO } from '../../src/ejemplos';
import { correrEjemplo } from '../ayuda/correr-ejemplo';

const GRADOS = Math.PI / 180;
/** Diferencia de ángulos en (−π, π]. */
const giro = (desde: number, hasta: number) => Math.atan2(Math.sin(hasta - desde), Math.cos(hasta - desde));

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

  it('Leer el giroscopio gira 90°', async () => {
    const { serial, avisos, estados } = await correrEjemplo('leer-giroscopio', { segundos: 8 });
    expect(serial).toContain('Giré 90');
    // El programa gira a la izquierda: el ángulo crece (sentido antihorario visto desde arriba).
    expect(Math.abs(giro(estados[0].yaw, estados.at(-1)!.yaw) - 90 * GRADOS)).toBeLessThanOrEqual(10 * GRADOS);
    expect(avisos).toEqual([]);
  });
});
