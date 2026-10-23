import { describe, it, expect } from 'vitest';
import { crearControl, fijarVelocidad, pausar, pedir, tomarPedido, IDX, Ritmo, type Reloj } from '../../src/simulacion/control';

/** Reloj de mentira: dormir avanza el tiempo; alDormir(n) corre después del sueño n desde que se fijó. */
function relojFalso() {
  const r = {
    t: 0,
    suenos: 0,
    alDormir: null as ((n: number) => void) | null,
    reloj: null as unknown as Reloj,
  };
  r.reloj = {
    ahora: () => r.t,
    dormir: ms => { r.t += ms; r.suenos++; r.alDormir?.(r.suenos); },
  };
  return r;
}

describe('bloque de control y ritmo', () => {
  it('a ×1, 100 ms virtuales esperan 100 ms reales', () => {
    const c = crearControl();
    const f = relojFalso();
    const ritmo = new Ritmo(c, f.reloj);
    ritmo.esperar(0);
    ritmo.esperar(100_000);
    expect(f.t).toBeGreaterThanOrEqual(99);
    expect(f.t).toBeLessThanOrEqual(101);
  });

  it('a ×2 espera la mitad y a máxima no espera', () => {
    const c = crearControl();
    const f = relojFalso();
    const ritmo = new Ritmo(c, f.reloj);
    fijarVelocidad(c, 200);
    ritmo.esperar(0);
    ritmo.esperar(100_000);
    expect(f.t).toBeCloseTo(50, -0.5);
    fijarVelocidad(c, 0);
    const antes = f.t;
    ritmo.esperar(5_000_000);
    expect(f.t).toBe(antes);
  });

  it('cambiar la velocidad a mitad de camino no produce un salto', () => {
    const c = crearControl();
    const f = relojFalso();
    const ritmo = new Ritmo(c, f.reloj);
    ritmo.esperar(0);
    ritmo.esperar(1_000_000);
    expect(f.t).toBeCloseTo(1000, -0.5);
    fijarVelocidad(c, 400);
    ritmo.esperar(1_400_000);
    expect(f.t - 1000).toBeGreaterThanOrEqual(99);
    expect(f.t - 1000).toBeLessThanOrEqual(101);
  });

  it('en pausa espera hasta que se siga y al seguir no se apura', () => {
    const c = crearControl();
    const f = relojFalso();
    const ritmo = new Ritmo(c, f.reloj);
    ritmo.esperar(0);
    ritmo.esperar(100_000);
    pausar(c, true);
    const inicio = f.suenos;
    f.alDormir = n => { if (n - inicio === 3) pausar(c, false); };
    const latido = Atomics.load(c, IDX.latido);
    ritmo.esperar(150_000);
    expect(f.t).toBeCloseTo(250, -0.5);
    expect(Atomics.load(c, IDX.latido) - latido).toBeGreaterThanOrEqual(4);
    f.alDormir = null;
    ritmo.esperar(250_000);
    expect(f.t).toBeGreaterThanOrEqual(349);
    expect(f.t).toBeLessThanOrEqual(351);
  });

  it('si va atrasada más de 250 ms se pone al día sin ráfagas', () => {
    const c = crearControl();
    const f = relojFalso();
    const ritmo = new Ritmo(c, f.reloj);
    ritmo.esperar(0);
    f.t += 1000;
    ritmo.esperar(100_000);
    expect(f.t).toBe(1000);
    ritmo.esperar(200_000);
    expect(f.t).toBeGreaterThanOrEqual(1099);
    expect(f.t).toBeLessThanOrEqual(1101);
  });

  it('el latido sube en cada espera, también en pausa', () => {
    const c = crearControl();
    const f = relojFalso();
    const ritmo = new Ritmo(c, f.reloj);
    ritmo.esperar(0);
    expect(Atomics.load(c, IDX.latido)).toBe(1);
    ritmo.esperar(100_000);
    expect(Atomics.load(c, IDX.latido)).toBe(2 + f.suenos);
  });

  it('tomarPedido entrega cada pedido una sola vez', () => {
    const c = crearControl();
    expect(tomarPedido(c)).toBeNull();
    pedir(c, 'ultimo');
    expect(tomarPedido(c)).toBe('ultimo');
    expect(tomarPedido(c)).toBeNull();
    pedir(c, 'siguiente');
    expect(tomarPedido(c)).toBe('siguiente');
  });
});
