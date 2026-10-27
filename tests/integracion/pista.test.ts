import { describe, it, expect, beforeAll } from 'vitest';
import { compilarParaPrueba } from '../ayuda/compilar-prueba';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import type { ArchivosNucleo } from '../../src/compilador/compilar';
import { Simulador } from '../../src/simulacion/simulador';
import { crearMundo } from '../../src/mundo/pista';
import { Juez } from '../../src/juez/juez';
import { poseInicial } from '../../src/pista/serializacion';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { pistaDe } from '../ayuda/pistas';

let nucleo: ArchivosNucleo;
beforeAll(async () => { nucleo = await cargarNucleoDesdeDisco(); });

/** Avanza a toda velocidad 1,5 s (90 cm) y se detiene. */
const IR_Y_PARAR = `void setup() {
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(5, OUTPUT); pinMode(18, OUTPUT); ledcAttach(4, 5000, 8); ledcAttach(19, 5000, 8);
  digitalWrite(16, HIGH); digitalWrite(17, LOW); digitalWrite(5, HIGH); digitalWrite(18, LOW);
  ledcWrite(4, 255); ledcWrite(19, 255); delay(1500); ledcWrite(4, 0); ledcWrite(19, 0);
}
void loop() {}`;

describe('el robot en la pista', { timeout: 120_000 }, () => {
  it('un robot que avanza 90 cm y se detiene en la meta suma hito, meta y tiempo', async () => {
    const pista = pistaDe({ columnas: 4, filas: 1,
      baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta' }, { c: 3, r: 0, tipo: 'meta' }],
      objetos: [{ tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: 1 } }] });
    const mundo = crearMundo(pista);
    const juez = new Juez(mundo, ROBOT_POR_DEFECTO);
    const sim = await Simulador.crear({ modulo: await compilarParaPrueba({ 'p.ino': IR_Y_PARAR }, nucleo, 'p'), mundo,
      poseInicial: poseInicial(pista), alPasoFisica: (t, e) => juez.actualizar(t, e) });
    sim.ejecutar(3_000_000);
    expect(juez.estado).toMatchObject({ hitos: ['alcanzado'], meta: true, reinicios: 0, terminado: true });
    // El tiempo corre desde que la cola del chasis sale de la partida (x = 300) hasta detenerse (t = 1,5 s).
    const { xDelantero, largo } = ROBOT_POR_DEFECTO.chasis;
    const tiempo = 1.5 - (300 + largo - xDelantero - 150) / 600;
    expect(juez.estado.tiempo).toBeCloseTo(tiempo, 1); expect(juez.estado.puntaje).toBeCloseTo(20 + (300 - tiempo) / 4, 1);
    expect(juez.estado.eventos.filter(e => e.tipo === 'perdio-linea')).toEqual([]);
  });

  it('chocar con el obstáculo genera "Tocaste el obstáculo" aunque la dinámica no lo deje entrar', async () => {
    const pista = pistaDe({ columnas: 4, filas: 1, baldosas: [0, 1, 2, 3].map(c => ({ c, r: 0, tipo: 'recta' })),
      objetos: [{ tipo: 'obstaculo', x: 600, y: 150, rot: 0 }] });
    const mundo = crearMundo(pista);
    const juez = new Juez(mundo, ROBOT_POR_DEFECTO);
    const sim = await Simulador.crear({ modulo: await compilarParaPrueba({ 'p.ino': IR_Y_PARAR }, nucleo, 'p'), mundo,
      poseInicial: poseInicial(pista), alPasoFisica: (t, e) => juez.actualizar(t, e) });
    sim.ejecutar(1_500_000);
    expect(juez.estado.eventos.filter(e => e.tipo === 'toco-obstaculo').map(e => e.mensaje)).toEqual(['Tocaste el obstáculo.']);
  });

  it('el robot sube la rampa: z y pitch salen del mundo', async () => {
    const alto = 300 * Math.tan(20 * Math.PI / 180);
    const pista = pistaDe({ columnas: 3, filas: 1,
      baldosas: [{ c: 0, r: 0, tipo: 'recta' }, { c: 1, r: 0, tipo: 'rampa' }, { c: 2, r: 0, tipo: 'recta', nivel: alto }] });
    const sim = await Simulador.crear({ modulo: await compilarParaPrueba({ 'p.ino': IR_Y_PARAR }, nucleo, 'p'),
      mundo: crearMundo(pista), poseInicial: poseInicial(pista) });
    sim.ejecutar(500_000); // 300 mm: el centro queda en la mitad de la rampa
    expect(sim.estado.x).toBeCloseTo(450, 0); expect(sim.estado.z).toBeCloseTo(150 * Math.tan(20 * Math.PI / 180), 0);
    expect(sim.estado.pitch).toBeCloseTo(-20 * Math.PI / 180, 2);
  });
});
