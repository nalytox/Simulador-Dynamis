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

describe('ejemplos de la memoria del robot (Preferences)', { timeout: 300_000 }, () => {
  it('Contar arranques cuenta las veces que partió, con la memoria de la vez anterior', async () => {
    const primera = await correrEjemplo('contar-arranques', { segundos: 2 });
    expect(primera.serial).toContain('Es la vez número 1 que parto.');
    const segunda = await correrEjemplo('contar-arranques', { segundos: 2, memoria: primera.memoria });
    expect(segunda.serial).toContain('Es la vez número 2 que parto.');
    const espacio = segunda.memoria.espacios.arranques;
    expect(espacio.veces).toEqual({ tipo: 'u32', bytes: [2, 0, 0, 0] });
    expect(espacio.nombre.tipo).toBe('str');
    expect(espacio.voltaje.tipo).toBe('blob');
    expect(espacio.voltaje.bytes).toHaveLength(4);
    expect(segunda.avisos).toEqual([]);
  });

  it('Recordar la calibración calibra la primera vez y después parte sin calibrar', async () => {
    const primera = await correrEjemplo('recordar-calibracion');
    expect(primera.serial).toContain('Calibrando');
    expect(primera.fin.juez.meta).toBe(true);
    expect(primera.eventos).not.toContain('perdio-linea');
    expect(primera.memoria.espacios.calibracion.minimos.bytes).toHaveLength(16);

    const segunda = await correrEjemplo('recordar-calibracion', { memoria: primera.memoria });
    expect(segunda.serial).toContain('Usé la calibración guardada.');
    expect(segunda.serial).not.toContain('Calibrando');
    // Sin calibrar no gira al partir: el primer medio segundo va derecho.
    const rumbo = segunda.estados[0].yaw;
    for (const e of segunda.estados.slice(0, 50)) expect(Math.abs(giro(rumbo, e.yaw))).toBeLessThan(5 * GRADOS);
    expect(segunda.fin.juez.meta).toBe(true);
    expect(segunda.eventos).not.toContain('perdio-linea');
    expect(segunda.avisos).toEqual([]);
  });
});

describe('Seguidor que aprende solo (Q-learning con su tabla en la memoria)', { timeout: 600_000 }, () => {
  const vueltas = (serial: string) => [...serial.matchAll(/Vuelta (\d+): (\d+) % del tiempo centrado/g)].map(m => ({ n: Number(m[1]), centrado: Number(m[2]) }));

  it('mejora vuelta a vuelta en el Circuito y sigue aprendiendo con la memoria de la prueba anterior', async () => {
    const primera = await correrEjemplo('seguidor-q', { segundos: 90 });
    const v1 = vueltas(primera.serial);
    expect(v1.length, primera.serial).toBeGreaterThanOrEqual(6);
    expect((v1.at(-1)!.centrado + v1.at(-2)!.centrado) / 2, primera.serial).toBeGreaterThan(v1[0].centrado);
    const espacio = primera.memoria.espacios['seguidor-q'];
    expect(espacio.tabla.bytes).toHaveLength(10 * 5 * 4);
    expect(espacio.vueltas.tipo).toBe('u32');
    expect(primera.avisos).toEqual([]);

    const segunda = await correrEjemplo('seguidor-q', { segundos: 30, memoria: primera.memoria });
    expect(segunda.serial).toContain('Seguí aprendiendo con la tabla guardada.');
    const v2 = vueltas(segunda.serial);
    expect(v2[0].n).toBe(v1.at(-1)!.n + 1);
    expect(v2[0].centrado, segunda.serial).toBeGreaterThan(v1[0].centrado);
  });
});

describe('Recorrido completo en la Pista completa', { timeout: 600_000 }, () => {
  it('llega a la meta con los 8 hitos, sin equivocarse de camino, sin tocar el obstáculo y sin perder la línea', async () => {
    const r = await correrEjemplo('recorrido-completo');
    const resumen = `${r.serial}\neventos: ${r.eventos.join(', ')}`;
    expect(r.fin, resumen).toMatchObject({ motivo: 'terminado', juez: { hitos: Array(8).fill('alcanzado'), meta: true } });
    expect(r.eventos, resumen).not.toContain('camino-equivocado');
    expect(r.eventos, resumen).not.toContain('toco-obstaculo');
    expect(r.eventos, resumen).not.toContain('perdio-linea');
    expect(r.avisos).toEqual([]);
  });

  it('con poca velocidad de subida se queda en la rampa: hay algo que entrenar', async () => {
    const r = await correrEjemplo('recorrido-completo', { segundos: 120, ajustes: { 'giroscopio.VELOCIDAD_SUBIDA': 40, 'siguelineas.VELOCIDAD_MINIMA': 30 } });
    expect(r.fin.juez.meta).toBe(false);
    // La rampa sube por la columna 2 (x de 600 a 900), de y = 900 a y = 1200; el tramo alto empieza en y = 1200.
    expect(Math.max(...r.estados.filter(e => e.x > 600 && e.x < 900).map(e => e.y))).toBeLessThan(1200);
  });
});
