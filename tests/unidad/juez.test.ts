import { it, expect } from 'vitest';
import { Juez } from '../../src/juez/juez';
import { crearMundo } from '../../src/mundo/pista';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { pistaDe } from '../ayuda/pistas';

/** Pista J: partida, recta, recta y meta; hitos 1 y 2, y el desafío F1 entre ellos. */
const J = pistaDe({ columnas: 4, filas: 1,
  baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta' }, { c: 3, r: 0, tipo: 'meta' }],
  objetos: [{ tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: 1 } }, { tipo: 'hito', x: 750, y: 150, rot: 0, props: { numero: 2 } },
    { tipo: 'desafio', x: 600, y: 150, rot: 0, props: { nombre: 'F1', hitoSiguiente: 2 } }] });

/** Llama a actualizar en t = desde, desde + paso, …, hasta, con el robot en (x(t), 150) mirando a +x. */
function pasar(juez: Juez, desde: number, hasta: number, x: (t: number) => number, paso = 0.001) {
  const n = Math.round((hasta - desde) / paso);
  for (let i = 0; i <= n; i++) {
    const t = desde + i * paso;
    juez.actualizar(t * 1e6, { x: x(t), y: 150, yaw: 0 });
  }
}

it('cuenta los hitos en orden', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  pasar(j, 0, 0.05, () => 750); expect(j.estado.hitos).toEqual(['pendiente', 'pendiente']);
  pasar(j, 0.05, 0.1, () => 450); expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'pendiente'], puntaje: 5 });
  pasar(j, 0.1, 0.15, () => 750); expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'alcanzado'], puntaje: 15 });
  expect(j.estado.eventos.map(e => e.mensaje)).toEqual(['Llegaste al hito 1 (+5).', 'Llegaste al hito 2 (+10).']);
});

it('el tiempo corre desde que la huella sale de la partida', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  pasar(j, 0, 1, () => 150); expect(j.estado.tiempo).toBeNull();
  pasar(j, 1, 2, () => 400); expect(j.estado.tiempo).toBeCloseTo(1, 1);
});

it('la meta exige detenerse 1 s sobre la línea y suma el tiempo', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  const x = (t: number) => 150 + 600 * Math.min(t, 1.5);
  pasar(j, 0, 2.4, x); expect(j.estado.meta).toBe(false);
  pasar(j, 2.4, 2.6, x); expect(j.estado).toMatchObject({ meta: true, terminado: true });
  // El tiempo corre desde que la cola del chasis sale de la partida (x = 300) hasta que llega a la meta (t = 1,5 s).
  const { xDelantero, largo } = ROBOT_POR_DEFECTO.chasis;
  const tiempo = 1.5 - (300 + largo - xDelantero - 150) / 600;
  expect(j.estado.tiempo).toBeCloseTo(tiempo, 1); expect(j.estado.puntaje).toBeCloseTo(30 + (300 - tiempo) / 4, 1);
});

it('reinicios: volver, saltar solo lo intentado, máximo 3 y el tiempo sigue sumando', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  expect(j.reiniciar('siguiente')).toEqual({ ok: false, mensaje: 'Para saltar al hito 1 primero tienes que intentarlo.' });
  pasar(j, 0, 1, () => 450); pasar(j, 1, 1.1, () => 520);
  expect(j.puntosDeReinicio().map(p => p.id)).toEqual(['hito-1', 'desafio-F1', 'hito-2']);
  expect(j.reiniciar('siguiente')).toEqual({ ok: true, pose: { x: 750, y: 150, yaw: 0 } });
  expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'saltado'], reinicios: 1, puntaje: -5 });
  expect(j.estado.eventos.at(-1)!.mensaje).toBe('Saltaste al hito 2: ya no hay puntaje de tiempo (−10).');
  expect(j.reiniciar('siguiente')).toEqual({ ok: false, mensaje: 'No quedan hitos para saltar.' });
  const antes = j.estado.tiempo!;
  pasar(j, 0, 0.5, () => 750); expect(j.estado.tiempo).toBeCloseTo(antes + 0.5, 1);
  expect(j.reiniciar('ultimo')).toEqual({ ok: true, pose: { x: 750, y: 150, yaw: 0 } });
  expect(j.estado.eventos.at(-1)!.mensaje).toBe('Volviste al hito 2 (−10).');
  expect(j.reiniciar('ultimo').ok).toBe(true);
  expect(j.reiniciar('ultimo')).toEqual({ ok: false, mensaje: 'Ya usaste los 3 reinicios.' });
});

it('saltar una F que no se logra completar cuenta como reinicio y quita el puntaje de tiempo', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  pasar(j, 0, 0.1, () => 450); pasar(j, 0.1, 0.2, () => 560);
  expect(j.reiniciar('desafio-F1')).toEqual({ ok: true, pose: { x: 600, y: 150, yaw: 0 } });
  expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'pendiente'], reinicios: 1, puntaje: -5 });
  expect(j.estado.eventos.at(-1)!.mensaje).toBe('Saltaste a F1: ya no hay puntaje de tiempo (−10).');
  expect(j.puntosDeReinicio().map(p => p.id)).toEqual(['desafio-F1', 'hito-2']);
  expect(j.reiniciar('hito-1')).toEqual({ ok: false, mensaje: 'No puedes reiniciar en Hito 1 ahora.' });
  pasar(j, 0, 2, t => Math.min(600 + 600 * t, 1050));
  expect(j.estado).toMatchObject({ hitos: ['alcanzado', 'alcanzado'], meta: true, puntaje: 5 + 10 + 15 - 10 });
});

it('empezar desde una F o un hito: lo anterior no suma y no hay puntaje de tiempo', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO, { desde: 'desafio-F1' });
  expect(j.estado).toMatchObject({ desde: 'desafio-F1', hitos: ['saltado', 'pendiente'], puntaje: 0 });
  pasar(j, 0, 2, t => Math.min(600 + 600 * t, 1050));
  expect(j.estado).toMatchObject({ hitos: ['saltado', 'alcanzado'], meta: true, puntaje: 10 + 15 });
  expect(new Juez(crearMundo(J), ROBOT_POR_DEFECTO, { desde: 'hito-2' }).estado.hitos).toEqual(['saltado', 'saltado']);
  expect(() => new Juez(crearMundo(J), ROBOT_POR_DEFECTO, { desde: 'F9' })).toThrow('No existe el punto de partida "F9".');
});

it('descuenta 20 puntos por cm de más', () =>
  expect(new Juez(crearMundo(J), { ...ROBOT_POR_DEFECTO, chasis: { ...ROBOT_POR_DEFECTO.chasis, largo: 215 } }).estado.puntaje).toBe(-40));

it('se acaba a los 300 s', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO, { pasoUs: 100_000 });
  pasar(j, 0, 301, () => 400, 0.1);
  expect(j.estado.terminado).toBe(true);
  expect(j.estado.eventos.at(-1)).toMatchObject({ tipo: 'fin-tiempo', mensaje: 'Se acabaron los 5 minutos.' });
});

it('se puede saltar a una F que está después del último hito', () => {
  const conF4 = pistaDe({ columnas: 4, filas: 1,
    baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta' }, { c: 3, r: 0, tipo: 'meta' }],
    objetos: [{ tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: 1 } },
      { tipo: 'desafio', x: 750, y: 150, rot: 0, props: { nombre: 'F4', hitoSiguiente: 2 } }] });
  const j = new Juez(crearMundo(conF4), ROBOT_POR_DEFECTO);
  pasar(j, 0, 0.1, () => 450); pasar(j, 0.1, 0.3, () => 600);
  expect(j.reiniciar('desafio-F4')).toEqual({ ok: true, pose: { x: 750, y: 150, yaw: 0 } });
  const practica = new Juez(crearMundo(conF4), ROBOT_POR_DEFECTO, { desde: 'hito-1' });
  pasar(practica, 0, 0.2, () => 600);
  expect(practica.reiniciar('desafio-F4').ok).toBe(true);
});

it('el juez no se confunde si el modelo modifica el mismo objeto de estado en cada paso', () => {
  const j = new Juez(crearMundo(J), ROBOT_POR_DEFECTO);
  const estado = { x: 990, y: 150, yaw: 0 };
  for (let i = 0; i <= 1300; i++) {
    estado.x = 990 + 0.1 * i; // 100 mm/s sobre la barra de la meta, sin detenerse
    j.actualizar(i * 1000, estado);
  }
  expect(j.estado.meta).toBe(false);
});
