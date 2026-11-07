import { describe, it, expect, beforeAll } from 'vitest';
import { compilar, type ArchivosNucleo } from '../../src/compilador/compilar';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import { correrSketch } from '../ayuda/correr-sketch';

let nucleo: ArchivosNucleo;
beforeAll(async () => { nucleo = await cargarNucleoDesdeDisco(); });

const errores = async (codigo: string, version: '3.x' | '2.0.14') => {
  const r = await compilar({ nombre: 'p', archivos: { 'p.ino': codigo } }, nucleo, { version });
  return r.diagnosticos.filter(d => d.severidad === 'error').map(d => d.mensaje);
};

/** El motor izquierdo del robot por defecto (IN1 16, IN2 17, PWM 4) hacia adelante a todo PWM. */
const ADELANTE = 'pinMode(16, OUTPUT); pinMode(17, OUTPUT); digitalWrite(16, HIGH); digitalWrite(17, LOW);';
const VERSION = 'Serial.begin(115200); Serial.printf("%d.%d.%d %d\\n", ESP_ARDUINO_VERSION_MAJOR, ESP_ARDUINO_VERSION_MINOR, ESP_ARDUINO_VERSION_PATCH, ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0));';

describe('las dos versiones del core ESP32, excluyentes', { timeout: 120_000 }, () => {
  it('3.x: ledcAttach y ledcWrite por pin mueven el motor; la versión dice 3', async () => {
    const { sim, texto } = await correrSketch(`void setup() { ${VERSION} ${ADELANTE} ledcAttach(4, 5000, 8); ledcWrite(4, 255); }\nvoid loop() {}`);
    expect(texto).toBe('3.0.7 1\n');
    expect(sim.motores.izq).toEqual({ duty: 1, modo: 'avance' });
  });

  it('2.0.14: ledcSetup, ledcAttachPin y ledcWrite por canal mueven el motor; ledcRead y ledcReadFreq leen el canal', async () => {
    const { sim, texto, resultado } = await correrSketch(`void setup() { ${VERSION} ${ADELANTE} Serial.println(ledcSetup(0, 15000, 8)); ledcAttachPin(4, 0);
      ledcWrite(0, 128); Serial.println(ledcRead(0)); Serial.println(ledcReadFreq(0)); }\nvoid loop() {}`, { version: '2.0.14' });
    expect(resultado.error).toBeUndefined();
    expect(texto).toBe('2.0.14 0\n15000\r\n128\r\n15000\r\n');
    expect(sim.motores.izq.duty).toBeCloseTo(128 / 255);
    expect(sim.avisos).toEqual([]);
  });

  it('el código de cada versión no compila con la otra', async () => {
    expect(await errores('void setup() { ledcSetup(0, 5000, 8); ledcAttachPin(4, 0); }\nvoid loop() {}', '3.x')).toEqual([
      "use of undeclared identifier 'ledcSetup'", "use of undeclared identifier 'ledcAttachPin'"]);
    expect(await errores('void setup() { ledcAttach(4, 5000, 8); ledcDetach(4); }\nvoid loop() {}', '2.0.14')).toEqual([
      "use of undeclared identifier 'ledcAttach'", "use of undeclared identifier 'ledcDetach'; did you mean 'ledcDetachPin'?"]);
    expect(await errores('void setup() { analogWriteResolution(10); }\nvoid loop() {}', '3.x')).toHaveLength(1);
    expect(await errores('void setup() { analogWriteResolution(4, 10); analogWriteFrequency(4, 1000); }\nvoid loop() {}', '2.0.14')).toHaveLength(2);
    // analogWrite y lo demás existe en las dos.
    expect(await errores('void setup() { analogWrite(4, 100); Serial.begin(9600); }\nvoid loop() {}', '2.0.14')).toEqual([]);
  });

  it('2.0.14: un canal sin ledcSetup o sin pines avisa qué falta', async () => {
    const { sim } = await correrSketch('void setup() { ledcAttachPin(4, 1); ledcWrite(2, 100); ledcSetup(5, 5000, 8); ledcWrite(5, 100); ledcSetup(16, 5000, 8); ledcAttachPin(4, 20); }\nvoid loop() {}', { version: '2.0.14' });
    expect(sim.avisos).toEqual([
      'ledcAttachPin(4, 1): el canal 1 no está configurado. Primero usa ledcSetup(1, frecuencia, bits).',
      'ledcWrite(2, …): el canal 2 no está configurado. Usa ledcSetup(2, frecuencia, bits) y ledcAttachPin(pin, 2) antes de ledcWrite(2, valor).',
      'ledcWrite(5, …): ningún pin está conectado al canal 5. Usa ledcAttachPin(pin, 5).',
      'ledcSetup(16, …): el canal 16 no existe. El ESP32 tiene los canales 0 a 15.',
      'ledcAttachPin(4, 20): el canal 20 no existe. El ESP32 tiene los canales 0 a 15.',
    ]);
  });
});
