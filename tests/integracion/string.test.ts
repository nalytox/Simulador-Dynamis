import { describe, it, expect } from 'vitest';
import { correrSketch } from '../ayuda/correr-sketch';

describe('String', { timeout: 120_000 }, () => {
  it('construcción, concatenación y conversiones', async () => {
    const { texto } = await correrSketch(`void setup() { Serial.begin(115200);
      String a = "Hola"; String b = String(42); String c = a + " " + b + '!';
      Serial.println(c); Serial.println(c.length()); Serial.println(String(3.14159, 3)); Serial.println(String(255, HEX));
      Serial.println(String("12.5").toFloat() * 2); Serial.println(String("  42").toInt() + 1);
      Serial.println(c.indexOf('4')); Serial.println(c.substring(5, 7)); Serial.println(c == "Hola 42!");
      String d; for (int i = 0; i < 3; i++) d += i; Serial.println(d);
      Serial.println(String(F("flash"))); Serial.println(c.c_str()); Serial.println(c.charAt(1)); }\nvoid loop() {}`);
    expect(texto).toBe(['Hola 42!', '8', '3.142', 'ff', '25.00', '43', '5', '42', '1', '012', 'flash', 'Hola 42!', 'o', ''].join('\r\n'));
  });

  it('en ciclos largos no rompe ni se come la memoria', async () => {
    const { texto, resultado } = await correrSketch(`String largo;
      void setup() { Serial.begin(115200); for (int i = 0; i < 2000; i++) largo += 'x'; Serial.println(largo.length()); }
      void loop() { String t = String(millis()) + " ms"; if (t.length() == 0) Serial.println("vacío"); }`, { duracionUs: 200_000 });
    expect(texto).toBe('2000\r\n'); expect(resultado.motivo).toBe('tiempo');
  });

  it('la memoria tiene un tope como la del ESP32: concatenar sin fin deja de crecer sin romper', { timeout: 60_000 }, async () => {
    const { texto, resultado } = await correrSketch(`String s; unsigned long n = 0;
      void setup() { Serial.begin(115200); }
      void loop() { s += "abcdefghij"; if (++n % 20000 == 0) Serial.println(s.length()); }`, { duracionUs: 500_000 });
    expect(resultado.motivo).toBe('tiempo');
    const largos = texto.trim().split('\r\n').map(Number);
    expect(largos.at(-1)).toBe(largos.at(-2));
    expect(largos.at(-1)).toBeGreaterThan(100_000);
    expect(largos.at(-1)).toBeLessThan(512 * 1024);
  });
});
