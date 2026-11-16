import { it, expect } from 'vitest';
import { estadoInicial, pasoDinamica } from '../../src/modelos/dinamica.js';
import { crearMundo } from '../../src/mundo/pista';
import { mundoPlano } from '../../src/mundo/plano';
import { crearAzar } from '../../src/simulacion/azar';
import { ROBOT_POR_DEFECTO, type ConfigRobot } from '../../src/robot/config';
import type { Motores, ModoMotor } from '../../src/simulacion/motores';
import type { Mundo } from '../../src/mundo/tipos';
import { pistaDe } from '../ayuda/pistas';

const GRADOS = Math.PI / 180;
const DT = 0.001;
const RECTAS = (n: number, objetos: unknown[] = []) =>
  crearMundo(pistaDe({ columnas: n, filas: 1, baldosas: Array.from({ length: n }, (_, c) => ({ c, r: 0, tipo: 'recta' })), objetos: objetos as never }));
/** Un bache de 6 mm de radio atravesado en x = 450 (a 90° de la línea) o girado `rot` grados. */
const CON_BACHE = (rot = 90) => RECTAS(3, [{ tipo: 'bache', x: 450, y: 150, rot, props: { largo: 250, radio: 6 } }]);
const parejo = (duty: number, modo: ModoMotor = duty < 0 ? 'retroceso' : 'avance'): Motores => ({ izq: { duty, modo }, der: { duty, modo } });

type Estado = ReturnType<typeof estadoInicial>;
/** Corre la dinámica `s` segundos con los motores que diga `motores(t)`; devuelve cada estado. */
function correr(robot: ConfigRobot, mundo: Mundo, pose: { x: number; y: number; yaw: number }, motores: (t: number) => Motores, s: number, semilla = 1): Estado[] {
  const azar = crearAzar(semilla);
  let e = estadoInicial(pose, robot, mundo);
  const estados = [e];
  for (let i = 1; i <= Math.round(s / DT); i++) {
    e = pasoDinamica(e, motores(i * DT), DT, mundo, robot, azar);
    estados.push(e);
  }
  return estados;
}
const conRobot = (cambiar: (r: ConfigRobot) => void): ConfigRobot => {
  const r = structuredClone(ROBOT_POR_DEFECTO);
  cambiar(r);
  return r;
};

it('con masa e inercia: acelera en unas décimas y en lo plano llega casi a vMaxMmS', () => {
  const e = correr(ROBOT_POR_DEFECTO, mundoPlano(), { x: 0, y: 0, yaw: 0 }, () => parejo(1), 1);
  expect(e[20].v as number).toBeLessThan(0.6 * 600);
  expect(e[150].v as number).toBeGreaterThan(0.95 * 580);
  expect(e.at(-1)!.v as number).toBeGreaterThan(0.97 * 600);
  expect(e.at(-1)!.v as number).toBeLessThan(600);
  expect(Math.abs(e.at(-1)!.y)).toBeLessThan(10);
});

it('la velocidad sale de motores.vMaxMmS y el empuje de motores.torqueKgCm', () => {
  const lento = conRobot(r => { r.motores.vMaxMmS = 300; });
  expect(correr(lento, mundoPlano(), { x: 0, y: 0, yaw: 0 }, () => parejo(1), 1).at(-1)!.v as number).toBeCloseTo(300, -1);
  // Con menos torque acelera más lento. (Con 2 kg·cm las ruedas patinan al partir: ahí acelera lo que
  // deja el roce de la goma, así que la comparación se hace con un motor que no alcanza a patinar.)
  const debil = conRobot(r => { r.motores.torqueKgCm = 0.3; });
  const v = (r: ConfigRobot) => correr(r, mundoPlano(), { x: 0, y: 0, yaw: 0 }, () => parejo(1), 0.05).at(-1)!.v as number;
  expect(v(debil)).toBeLessThan(v(ROBOT_POR_DEFECTO) * 0.6);
});

it('girar en el lugar: una rueda adelante y la otra atrás, a casi 2·vMax/trocha', () => {
  const giro = (): Motores => ({ izq: { duty: -1, modo: 'retroceso' }, der: { duty: 1, modo: 'avance' } });
  const e = correr(ROBOT_POR_DEFECTO, mundoPlano(), { x: 0, y: 0, yaw: 0 }, giro, 1);
  expect(e.at(-1)!.w as number).toBeGreaterThan(0.9 * (2 * 600) / 160);
  expect(Math.hypot(e.at(-1)!.x, e.at(-1)!.y)).toBeLessThan(5);
});

it('libre deja rodar al robot; freno lo detiene enseguida', () => {
  const hasta = (modo: ModoMotor) => correr(ROBOT_POR_DEFECTO, mundoPlano(), { x: 0, y: 0, yaw: 0 },
    t => (t < 0.5 ? parejo(1) : { izq: { duty: 0, modo }, der: { duty: 0, modo } }), 1.5).at(-1)!.x;
  expect(hasta('libre') - hasta('freno')).toBeGreaterThan(100);
});

it('en la rampa de 20° sube más lento que en lo plano, y con poco PWM no sube', () => {
  const rampa = crearMundo(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: 109.19 }] }));
  const enRampa = correr(ROBOT_POR_DEFECTO, rampa, { x: 400, y: 150, yaw: 0 }, () => parejo(0.5), 0.6).at(-1)!;
  expect(enRampa.pitch).toBeCloseTo(-20 * GRADOS, 1);
  expect(enRampa.v as number).toBeLessThan(0.75 * 0.5 * 600);
  expect(enRampa.v as number).toBeGreaterThan(0);
  const sinFuerza = correr(ROBOT_POR_DEFECTO, rampa, { x: 400, y: 150, yaw: 0 }, () => parejo(0.15), 1).at(-1)!;
  expect(sinFuerza.x).toBeLessThan(400);
});

it('un bache de 6 mm: con poco PWM las ruedas no alcanzan a subirlo; con más, lo pasa', () => {
  const pasa = (duty: number) => correr(ROBOT_POR_DEFECTO, CON_BACHE(), { x: 300, y: 150, yaw: 0 }, () => parejo(duty), 3).at(-1)!.x;
  expect(pasa(0.2)).toBeLessThan(450);
  expect(pasa(0.5)).toBeGreaterThan(600);
});

it('al pasar el bache el robot se inclina y la rueda lo sube de a poco (la goma rodea el bache)', () => {
  const e = correr(ROBOT_POR_DEFECTO, CON_BACHE(), { x: 300, y: 150, yaw: 0 }, () => parejo(0.6), 1.5);
  const pitches = e.map(s => s.pitch);
  expect(Math.min(...pitches)).toBeLessThan(-2 * GRADOS);
  expect(Math.max(...pitches)).toBeGreaterThan(2 * GRADOS);
  // Ningún salto de un paso al otro: la rueda rueda sobre el bache, no se teletransporta arriba.
  for (let i = 1; i < e.length; i++) expect(Math.abs(e[i].z - e[i - 1].z)).toBeLessThan(0.5);
});

it('el sensor de línea a 3 mm del piso, en la punta del robot, choca con el bache y lo traba; a 7 mm pasa', () => {
  // En la punta (x = 95), antes de que las ruedas locas (x = 70) empiecen a subir y levanten la nariz.
  const enLaPunta = (altura: number) => conRobot(r => { r.qtr.x = 95; r.qtr.altura = altura; });
  const trabado = correr(enLaPunta(3), CON_BACHE(), { x: 300, y: 150, yaw: 0 }, () => parejo(0.6), 2).at(-1)!;
  // El borde delantero de la barra (x + 100) llega a donde el bache ya mide 3 mm (450 − 5,2).
  expect(trabado.x).toBeGreaterThan(335);
  expect(trabado.x).toBeLessThan(350);
  expect(trabado.v).toBe(0);
  expect(correr(enLaPunta(7), CON_BACHE(), { x: 300, y: 150, yaw: 0 }, () => parejo(0.6), 2).at(-1)!.x).toBeGreaterThan(600);
  // En el robot por defecto la barra (x = 74) va justo delante del eje de las ruedas locas: ellas la levantan.
  expect(correr(conRobot(r => { r.qtr.altura = 3; }), CON_BACHE(), { x: 300, y: 150, yaw: 0 }, () => parejo(0.6), 2).at(-1)!.x).toBeGreaterThan(600);
});

it('una panza baja (altura libre de 4 mm) queda montada sobre el bache entre las ruedas', () => {
  const panzaBaja = conRobot(r => { r.chasis.alturaLibre = 4; });
  const e = correr(panzaBaja, CON_BACHE(), { x: 300, y: 150, yaw: 0 }, () => parejo(0.6), 3).at(-1)!;
  expect(e.x).toBeLessThan(450);
  expect(e.x).toBeGreaterThan(450 - 70);
});

it('un bache a 45° sube primero una rueda: el robot se desvía', () => {
  const e = correr(ROBOT_POR_DEFECTO, CON_BACHE(45), { x: 250, y: 150, yaw: 0 }, () => parejo(0.5), 2);
  expect(e.at(-1)!.x).toBeGreaterThan(600);
  expect(Math.max(...e.map(s => Math.abs(s.yaw)))).toBeGreaterThan(0.5 * GRADOS);
});

it('rugosidad: las uniones entre baldosas sacuden un poco al robot, igual con la misma semilla', () => {
  const ir = (semilla: number) => correr(ROBOT_POR_DEFECTO, RECTAS(4), { x: 150, y: 150, yaw: 0 }, () => parejo(0.5), 2.5, semilla);
  const a = ir(1);
  const pitches = a.map(s => Math.abs(s.pitch));
  expect(Math.max(...pitches)).toBeGreaterThan(0.05 * GRADOS);
  expect(Math.max(...pitches)).toBeLessThan(1 * GRADOS);
  expect(ir(1).at(-1)).toEqual(a.at(-1));
  // El agarre de cada rueda varía con la semilla: dos pruebas no terminan exactamente iguales.
  expect(ir(2).at(-1)!.y).not.toBe(a.at(-1)!.y);
});
