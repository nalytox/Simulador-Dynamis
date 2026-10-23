import { describe, it, expect, beforeAll } from 'vitest';
import { compilarParaPrueba } from '../ayuda/compilar-prueba';
import { crearAnfitrionFalso } from '../ayuda/anfitrion-falso';
import { crearImports } from '../../src/simulacion/puente';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import type { ArchivosNucleo } from '../../src/compilador/compilar';

type Exports = { _initialize(): void; dyn_setup(): void; memory: WebAssembly.Memory };
let nucleo: ArchivosNucleo;
beforeAll(async () => { nucleo = await cargarNucleoDesdeDisco(); });

async function correrSetup(cuerpo: string) {
  const { anfitrion, llamadas, texto } = crearAnfitrionFalso();
  const modulo = await compilarParaPrueba({ 'p.ino': `void setup() { ${cuerpo} }\nvoid loop() {}` }, nucleo, 'p');
  let instancia: WebAssembly.Instance | undefined;
  instancia = await WebAssembly.instantiate(modulo, crearImports(modulo, anfitrion, () => (instancia!.exports as Exports).memory));
  const ex = instancia.exports as Exports;
  ex._initialize();
  ex.dyn_setup();
  return { llamadas, texto };
}

describe('núcleo Arduino del ESP32', { timeout: 120_000 }, () => {
  it('solo importa dynamis.* y funciones WASI conocidas, y exporta lo esperado', async () => {
    const m = await compilarParaPrueba({ 'p.ino': 'void setup() { Serial.begin(115200); Serial.printf("%d", 1); }\nvoid loop() {}' }, nucleo, 'p');
    const wasi = ['fd_write', 'fd_close', 'fd_seek', 'proc_exit', 'environ_get', 'environ_sizes_get', 'clock_time_get', 'random_get', 'sched_yield'];
    for (const i of WebAssembly.Module.imports(m)) expect(i.module === 'dynamis' || (i.module === 'wasi_snapshot_preview1' && wasi.includes(i.name))).toBe(true);
    expect(WebAssembly.Module.exports(m).map(e => e.name)).toEqual(expect.arrayContaining(['memory', '_initialize', 'dyn_setup', 'dyn_loop']));
  });
  it('Serial imprime como Arduino', async () => {
    const { texto } = await correrSetup('Serial.begin(115200); Serial.println("hola"); Serial.println(3.14159); Serial.println(42); Serial.print(255, HEX); Serial.printf(" %d", 7); Serial.println(1.0 / 0.0);');
    expect(texto()).toBe('hola\r\n3.14\r\n42\r\nFF 7inf\r\n');
  });
  it('las funciones de pines usan los valores del ESP32', async () => {
    const { llamadas } = await correrSetup('pinMode(18, OUTPUT); digitalWrite(18, HIGH); analogWrite(19, 128); analogWriteResolution(10); ledcAttach(21, 5000, 10); ledcWrite(21, 512); pinMode(4, INPUT_PULLUP);');
    expect(llamadas).toEqual([['pinMode', 18, 3], ['digitalWrite', 18, 1], ['analogWrite', 19, 128], ['analogWriteResolution', 255, 10], ['ledcAttach', 21, 5000, 10], ['ledcWrite', 21, 512], ['pinMode', 4, 5]]);
  });
  it('map, constrain, min y max funcionan como en el ESP32', async () => {
    const { texto } = await correrSetup('Serial.begin(9600); Serial.println(map(512, 0, 1023, 0, 255)); Serial.println(constrain(300, 0, 255)); Serial.println(min(3, 7)); Serial.println(max(3, 7));');
    expect(texto()).toBe('127\r\n255\r\n3\r\n7\r\n');
  });
  it('random usa al anfitrión hasta que se llama a randomSeed', async () => {
    const { llamadas } = await correrSetup('volatile long a = random(10); randomSeed(42); volatile long b = random(10);');
    expect(llamadas.filter(l => l[0] === 'azarU32')).toHaveLength(1);
  });
  it('acepta la API común del ESP32: F(), A0, SDA, dtostrf, itoa, PRIu32, write(0) y analogWriteFrequency', async () => {
    const { texto } = await correrSetup('Serial.begin(115200); Serial.println(F("hola")); Serial.println(A0); Serial.println(A7); Serial.println(SDA); char b[16]; Serial.println(dtostrf(3.14159, 6, 2, b)); Serial.println(itoa(-42, b, 10)); Serial.printf("%" PRIu32 "\\n", (uint32_t)7); Serial.write(0); analogWriteFrequency(18, 20000);');
    expect(texto()).toBe('hola\r\n36\r\n35\r\n21\r\n  3.14\r\n-42\r\n7\n\u0000');
  });
});
