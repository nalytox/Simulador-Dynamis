import { describe, it, expect, beforeAll } from 'vitest';
import { compilarParaPrueba } from '../ayuda/compilar-prueba';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import { Simulador, type OpcionesSimulador } from '../../src/simulacion/simulador';
import type { ArchivosNucleo } from '../../src/compilador/compilar';

let nucleo: ArchivosNucleo;
beforeAll(async () => { nucleo = await cargarNucleoDesdeDisco(); });

async function crearSim(codigo: string, opciones: Partial<OpcionesSimulador> = {}): Promise<Simulador> {
  const modulo = await compilarParaPrueba({ 'p.ino': codigo }, nucleo, 'p');
  return Simulador.crear({ modulo, ...opciones });
}

const AVANZAR = `void setup() {
  pinMode(16, OUTPUT); pinMode(17, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT);
  digitalWrite(16, HIGH); digitalWrite(17, LOW); digitalWrite(4, HIGH); digitalWrite(5, LOW);
  analogWrite(18, 255); analogWrite(19, 255);
}
void loop() {}`;

describe('Simulador', { timeout: 120_000 }, () => {
  it('un sketch que avanza mueve al robot hacia adelante', async () => {
    const sim = await crearSim(AVANZAR);
    expect(sim.ejecutar(2_000_000)).toEqual({ motivo: 'tiempo', tiempoUs: 2_000_000 });
    expect(sim.estado.x).toBeGreaterThan(1195); expect(sim.estado.x).toBeLessThanOrEqual(1200 + 1e-6); // 600 mm/s × 2 s (con error de punto flotante)
    expect(Math.abs(sim.estado.y)).toBeLessThan(1);
    expect(sim.motores).toEqual({ izq: { duty: 1, modo: 'avance' }, der: { duty: 1, modo: 'avance' } });
  });
  it('girar en el lugar cambia el rumbo sin desplazarse', async () => {
    const sim = await crearSim(AVANZAR.replace('digitalWrite(4, HIGH); digitalWrite(5, LOW)', 'digitalWrite(4, LOW); digitalWrite(5, HIGH)'));
    sim.ejecutar(500_000);
    expect(sim.estado.yaw).toBeCloseTo(-(1200 / 140) * 0.5, 1); expect(Math.hypot(sim.estado.x, sim.estado.y)).toBeLessThan(1);
  });
  it('millis y delay avanzan el reloj virtual', async () => {
    const sim = await crearSim('void setup() { Serial.begin(115200); }\nvoid loop() { Serial.println(millis()); delay(100); }');
    sim.ejecutar(350_000);
    expect(sim.tomarSerial()).toBe('0\r\n100\r\n200\r\n300\r\n');
  });
  it('el búfer del Serial a 9600 baudios toma tiempo', async () => {
    const sim = await crearSim('void setup() { Serial.begin(9600); for (int i = 0; i < 1000; i++) Serial.write(\'x\'); unsigned long t = millis(); Serial.println(); Serial.println(t); }\nvoid loop() {}');
    sim.ejecutar(3_000_000);
    const t = Number(sim.tomarSerial().trim().split('\r\n').pop());
    expect(t).toBeGreaterThanOrEqual(905); expect(t).toBeLessThanOrEqual(911); // (1000 − 128) × 10 / 9600 s
  });
  it('los textos con tildes llegan bien aunque se escriban de a un byte', async () => {
    const sim = await crearSim('void setup() { Serial.begin(115200); Serial.print("¡Hola, "); Serial.write((uint8_t)0xC3); Serial.write((uint8_t)0xB1); Serial.println("o!"); }\nvoid loop() {}');
    sim.ejecutar(10_000); expect(sim.tomarSerial()).toBe('¡Hola, ño!\r\n');
  });
  it('Serial sin begin no imprime y avisa', async () => {
    const sim = await crearSim('void setup() { Serial.println("nada"); }\nvoid loop() {}');
    sim.ejecutar(10_000);
    expect(sim.tomarSerial()).toBe(''); expect(sim.avisos).toContain('Usaste Serial.print sin Serial.begin(): en el robot real no se verá nada.');
  });
  it('un setup que nunca termina se corta en el límite', async () => {
    const sim = await crearSim('void setup() { while (true) { delay(10); } }\nvoid loop() {}');
    expect(sim.ejecutar(1_000_000)).toEqual({ motivo: 'tiempo', tiempoUs: 1_000_000 });
  });
  it('un loop vacío igual hace avanzar el tiempo', async () => {
    const sim = await crearSim('void setup() {}\nvoid loop() {}');
    expect(sim.ejecutar(1_000)).toEqual({ motivo: 'tiempo', tiempoUs: 1_000 });
  });
  it('esperar con millis() dentro de un while termina', async () => {
    const sim = await crearSim('void setup() { Serial.begin(115200); while (millis() < 500) {} Serial.println("listo"); }\nvoid loop() {}');
    sim.ejecutar(1_000_000); expect(sim.tomarSerial()).toBe('listo\r\n');
  });
  it('la misma semilla repite random(); otra semilla cambia', async () => {
    const cod = 'void setup() { Serial.begin(115200); for (int i = 0; i < 5; i++) Serial.println(random(1000)); }\nvoid loop() {}';
    const salida = async (semilla: number) => { const s = await crearSim(cod, { semilla }); s.ejecutar(10_000); return s.tomarSerial(); };
    expect(await salida(7)).toBe(await salida(7)); expect(await salida(7)).not.toBe(await salida(8));
  });
  it('un error de ejecución termina con motivo error y el tiempo en que ocurrió', async () => {
    const sim = await crearSim('void setup() { delay(100); volatile int z = 0; volatile int r = 10 / z; }\nvoid loop() {}');
    const r = sim.ejecutar(1_000_000);
    expect(r.motivo).toBe('error'); expect(r.error?.tipo).toBe('division-por-cero');
    expect(r.tiempoUs).toBeGreaterThanOrEqual(100_000); expect(r.tiempoUs).toBeLessThan(101_000);
  });
  it('analogRead usa el lector analógico y la resolución', async () => {
    const sim = await crearSim('void setup() { Serial.begin(115200); Serial.println(analogRead(36)); analogReadResolution(10); Serial.println(analogRead(36)); }\nvoid loop() {}', { lectorAnalogico: () => 4095 });
    sim.ejecutar(10_000); expect(sim.tomarSerial()).toBe('4095\r\n1023\r\n');
  });
  it('alAvanzar recibe un tiempo que siempre crece', async () => {
    const tiempos: number[] = [];
    const sim = await crearSim('void setup() {}\nvoid loop() { delay(10); }', { alAvanzar: s => tiempos.push(s.tiempoUs) });
    sim.ejecutar(100_000);
    expect(tiempos.length).toBeGreaterThan(9); expect(tiempos.every((t, i) => i === 0 || t >= tiempos[i - 1])).toBe(true);
  });
});
