import { describe, it, expect, beforeAll, vi } from 'vitest';
import { compilarParaPrueba } from '../ayuda/compilar-prueba';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import type { ArchivosNucleo } from '../../src/compilador/compilar';
import { Simulador } from '../../src/simulacion/simulador';
import { ejecutarPrueba, type Instantanea } from '../../src/simulacion/ejecucion';
import { crearControl, fijarVelocidad, pedir, type Reloj } from '../../src/simulacion/control';
import { crearAzar } from '../../src/simulacion/azar';
import { crearMundo } from '../../src/mundo/pista';
import { poseInicial } from '../../src/pista/serializacion';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import { pistaDe } from '../ayuda/pistas';

let nucleo: ArchivosNucleo;
beforeAll(async () => { nucleo = await cargarNucleoDesdeDisco(); });

const PISTA = pistaDe({ columnas: 4, filas: 1,
  baldosas: [{ c: 0, r: 0, tipo: 'partida' }, { c: 1, r: 0, tipo: 'recta' }, { c: 2, r: 0, tipo: 'recta' }, { c: 3, r: 0, tipo: 'meta' }],
  objetos: [{ tipo: 'hito', x: 450, y: 150, rot: 0, props: { numero: 1 } }] });

/** Avanza a toda velocidad 1,5 s (90 cm) y se detiene en la meta. */
const IR_Y_PARAR = `void setup() {
  Serial.begin(115200); Serial.println("setup");
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(5, OUTPUT); pinMode(18, OUTPUT); ledcAttach(4, 5000, 8); ledcAttach(19, 5000, 8);
  digitalWrite(16, HIGH); digitalWrite(17, LOW); digitalWrite(5, HIGH); digitalWrite(18, LOW);
  ledcWrite(4, 255); ledcWrite(19, 255); delay(1500); ledcWrite(4, 0); ledcWrite(19, 0);
}
void loop() {}`;

/** Reloj de mentira que avanza 1 ms cada vez que se le pregunta la hora. */
function relojQueAvanza(): Reloj {
  let t = 0;
  return { ahora: () => t++, dormir: ms => { t += ms; } };
}

async function correr(codigo: string, alPublicar: (i: Instantanea, todas: Instantanea[], control: Int32Array) => void = () => {}) {
  const control = crearControl();
  fijarVelocidad(control, 0);
  const instantaneas: Instantanea[] = [];
  const fin = await ejecutarPrueba({
    modulo: await compilarParaPrueba({ 'p.ino': codigo }, nucleo, 'p'), pista: PISTA, robot: ROBOT_POR_DEFECTO,
    desde: 'partida', semilla: 1, control, reloj: relojQueAvanza(),
    publicar: i => { instantaneas.push(i); alPublicar(i, instantaneas, control); },
  });
  return { fin, instantaneas };
}

describe('la prueba completa', { timeout: 120_000 }, () => {
  it('publica instantáneas con el Serial nuevo y termina cuando el juez termina', async () => {
    const { fin, instantaneas } = await correr(IR_Y_PARAR);
    expect(instantaneas.map(i => i.serial).join('')).toBe('setup\r\n');
    expect(fin.motivo).toBe('terminado');
    expect(fin.juez?.meta).toBe(true);
  });

  it('durante un delay largo se publican instantáneas con el robot avanzando', async () => {
    const { instantaneas } = await correr(IR_Y_PARAR);
    const enCamino = new Set(instantaneas.filter(i => i.estado.x > 160 && i.estado.x < 1000).map(i => Math.round(i.estado.x)));
    expect(enCamino.size).toBeGreaterThanOrEqual(10);
  });

  it('"Volver al último hito" reinicia el programa desde setup en la partida y descuenta 10', async () => {
    const { fin, instantaneas } = await correr(IR_Y_PARAR, (i, todas, control) => { if (todas.length === 1) pedir(control, 'ultimo'); });
    expect(instantaneas.map(i => i.serial).join('').match(/setup/g)).toHaveLength(2);
    expect(fin.juez?.reinicios).toBe(1);
    const primera = instantaneas.find(i => i.reinicio === 1)!;
    expect(Math.abs(primera.estado.x - 150)).toBeLessThan(5);
    expect(fin.juez?.meta).toBe(true);
  });

  it('un pedido rechazado llega como mensaje y la prueba sigue', async () => {
    const pedidos = new Set<number>();
    const { fin, instantaneas } = await correr(IR_Y_PARAR, (i, _, control) => {
      if (!pedidos.has(i.reinicio)) { pedidos.add(i.reinicio); pedir(control, 'ultimo'); }
    });
    expect(instantaneas.some(i => i.mensaje === 'Ya usaste los 3 reinicios.')).toBe(true);
    expect(fin.juez?.reinicios).toBe(3);
    expect(fin).toMatchObject({ motivo: 'terminado', juez: { meta: true } });
  });

  it('cada aviso del simulador se publica una sola vez, sin importar el orden en que aparecen', async () => {
    // El aviso del Serial aparece antes que el de pinMode, pero el simulador lista primero los de los pines.
    const { instantaneas } = await correr(IR_Y_PARAR.replace('Serial.begin(115200); Serial.println("setup");',
      'Serial.println("sin begin"); delay(100); digitalWrite(16, HIGH); delay(100);'));
    const avisos = instantaneas.flatMap(i => i.avisos);
    expect(avisos.filter(a => a.includes('Serial.begin'))).toHaveLength(1);
    expect(avisos.filter(a => a.includes('pinMode(16, OUTPUT)'))).toHaveLength(1);
  });

  it('un error del programa termina la prueba con su error', async () => {
    const { fin } = await correr('void setup() { Serial.begin(115200); }\nvoid loop() { volatile int z = 0; Serial.println(millis() / z); }');
    expect(fin.motivo).toBe('error');
    expect(fin.error?.tipo).toBe('division-por-cero');
  });

  it('detener() termina la corrida con motivo detenido', async () => {
    const sim = await Simulador.crear({ modulo: await compilarParaPrueba({ 'p.ino': IR_Y_PARAR }, nucleo, 'p'), mundo: crearMundo(PISTA),
      poseInicial: poseInicial(PISTA), alAvanzar: s => { if (s.tiempoUs >= 10_000) s.detener(); } });
    const r = sim.ejecutar(5_000_000);
    expect(r.motivo).toBe('detenido');
    expect(r.tiempoUs).toBeLessThan(2_000_000);
  });

  it('la luz de la pista llega a los modelos, igual que en el entrenamiento', async () => {
    const crear = vi.spyOn(Simulador, 'crear');
    const control = crearControl();
    fijarVelocidad(control, 0);
    await ejecutarPrueba({
      modulo: await compilarParaPrueba({ 'p.ino': IR_Y_PARAR }, nucleo, 'p'), pista: { ...PISTA, ambiente: { luz: 'fuerte' } },
      robot: ROBOT_POR_DEFECTO, desde: 'partida', semilla: 1, control, reloj: relojQueAvanza(), publicar: () => {},
    });
    expect(crear.mock.calls.at(-1)![0]).toMatchObject({ ambiente: { luz: 'fuerte' } });
    crear.mockRestore();
  });

  it('medirParaVista no cambia lo que lee el programa', async () => {
    const codigo = 'void setup() { Serial.begin(115200); for (int i = 0; i < 5; i++) { Serial.println(analogRead(36)); delay(3); } }\nvoid loop() {}';
    const modulo = await compilarParaPrueba({ 'p.ino': codigo }, nucleo, 'p');
    const ruidoso = { leerQTR: (e: { sensores: unknown[]; azar: () => number }) => e.sensores.map(() => 1000 + Math.floor(e.azar() * 1000)) };
    const salida = async (mirar: boolean) => {
      const azarVista = crearAzar(7);
      const sim = await Simulador.crear({ modulo, mundo: crearMundo(PISTA), poseInicial: poseInicial(PISTA), modelos: ruidoso,
        alAvanzar: s => { if (mirar) s.medirParaVista(azarVista); } });
      sim.ejecutar(100_000);
      return sim.tomarSerial();
    };
    const conVista = await salida(true);
    expect(conVista.split('\r\n').filter(Boolean)).toHaveLength(5);
    expect(conVista).toBe(await salida(false));
  });
});
