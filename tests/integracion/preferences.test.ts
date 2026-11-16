import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';
import type { VersionEsp32 } from '../../src/compilador/version';

const INICIO = '#include <Preferences.h>\nPreferences p;\n';

/** Guarda un valor de cada tipo y los vuelve a leer. */
const TODOS_LOS_TIPOS = `${INICIO}void setup() {
  Serial.begin(115200);
  Serial.println(p.begin("prueba", false));
  p.putChar("c", -5); p.putUChar("uc", 250); p.putShort("s", -300); p.putUShort("us", 60000);
  p.putInt("i", -70000); p.putUInt("ui", 4000000000u); p.putLong64("l64", -9000000000LL);
  p.putFloat("f", 3.14f); p.putDouble("d", 2.718281828); p.putBool("b", true); p.putString("t", "hola");
  uint8_t bloque[3] = {1, 2, 3}; p.putBytes("bloque", bloque, 3);
  Serial.printf("%d %u %d %u %ld %lu %lld %.2f %.9f %d %s\\n", p.getChar("c"), p.getUChar("uc"), p.getShort("s"), p.getUShort("us"),
    (long)p.getInt("i"), (unsigned long)p.getUInt("ui"), p.getLong64("l64"), p.getFloat("f"), p.getDouble("d"), p.getBool("b"), p.getString("t").c_str());
  uint8_t leido[3] = {0, 0, 0};
  Serial.printf("%u %u %u %u\\n", (unsigned)p.getBytesLength("bloque"), (unsigned)p.getBytes("bloque", leido, 3), leido[0], leido[2]);
  Serial.printf("%d %d %d %d\\n", p.getType("i"), p.getType("t"), p.getType("f"), p.getType("nada"));
  Serial.println(p.freeEntries());
  Serial.println(p.isKey("c")); p.remove("c"); Serial.println(p.isKey("c"));
  p.end();
}
void loop() {}`;

describe('Preferences (la memoria del robot)', { timeout: 120_000 }, () => {
  for (const version of ['3.x', '2.0.14'] as VersionEsp32[]) {
    it(`guarda y lee cada tipo, cuenta las entradas y quita claves (esp32 ${version})`, async () => {
      const { texto, sim } = await correrSketch(TODOS_LOS_TIPOS, { version });
      expect(texto.split(/\r?\n/)).toEqual([
        '1', '-5 250 -300 60000 -70000 4000000000 -9000000000 3.14 2.718281828 1 hola', '3 3 1 3', '4 8 9 10', '484', '1', '0', '',
      ]);
      expect(sim.avisos).toEqual([]);
      const guardado = sim.memoria.instantanea().espacios.prueba;
      expect(guardado.ui).toEqual({ tipo: 'u32', bytes: [0, 0x28, 0x6b, 0xee] });
      expect(guardado.t).toEqual({ tipo: 'str', bytes: [104, 111, 108, 97] });
      expect(guardado.f.tipo).toBe('blob');
      expect(guardado.b).toEqual({ tipo: 'u8', bytes: [1] });
      expect('c' in guardado).toBe(false);
    });
  }

  it('lo guardado en una corrida se lee en la siguiente; clear la vacía', async () => {
    const primera = await correrSketch(TODOS_LOS_TIPOS);
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200);
      Serial.println(p.begin("prueba", true)); Serial.println(p.getUInt("ui")); Serial.println(p.getString("t"));
      Serial.println(p.putInt("x", 1)); p.end();
      p.begin("prueba"); Serial.println(p.clear()); Serial.println(p.freeEntries()); }\nvoid loop() {}`,
    { memoria: primera.sim.memoria.instantanea() });
    expect(texto.split(/\r?\n/)).toEqual(['1', '4000000000', 'hola', '0', '1', '503', '']);
  });

  it('usar la memoria sin begin() avisa y no guarda; leer con otro tipo da el valor por defecto', async () => {
    const { texto, sim } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200);
      Serial.println(p.putInt("x", 1)); p.begin("e"); p.putString("k", "hola"); Serial.println(p.getInt("k", -1));
      p.end(); Serial.println(p.begin("un-nombre-muy-largo")); }\nvoid loop() {}`);
    expect(texto.split(/\r?\n/)).toEqual(['0', '-1', '0', '']);
    expect(sim.avisos).toEqual([
      'Llama a begin() de Preferences antes de usar la memoria.',
      'Leíste "k" con otro tipo del que guardaste.',
      'El nombre "un-nombre-muy-largo" tiene más de 15 letras: la memoria no lo acepta.',
    ]);
  });

  it('escribir tarda tiempo virtual; leer casi nada', async () => {
    const { texto } = await correrSketch(`${INICIO}void setup() { Serial.begin(115200); p.begin("t");
      unsigned long t0 = micros(); p.putInt("x", 1); unsigned long t1 = micros(); p.getInt("x"); unsigned long t2 = micros();
      Serial.printf("%lu %lu\\n", t1 - t0, t2 - t1); }\nvoid loop() {}`);
    const [escribir, leer] = texto.trim().split(' ').map(Number);
    expect(escribir).toBeGreaterThanOrEqual(3000);
    expect(leer).toBeLessThan(100);
  });
});
