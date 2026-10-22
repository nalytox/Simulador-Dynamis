import type { Anfitrion } from '../../src/simulacion/puente';

/** Anfitrión que registra cada llamada; serialWrite y salidaEstandar se guardan como texto UTF-8. */
export function crearAnfitrionFalso(): { anfitrion: Anfitrion; llamadas: unknown[][]; texto(): string } {
  const llamadas: unknown[][] = [];
  const decodificador = new TextDecoder();
  let texto = '';
  const registrar = <R>(nombre: string, valor?: R) => (...args: number[]): R => {
    llamadas.push([nombre, ...args]);
    return valor as R;
  };
  const escribir = (nombre: string) => (bytes: Uint8Array) => {
    const trozo = decodificador.decode(bytes, { stream: true });
    texto += trozo;
    llamadas.push([nombre, trozo]);
  };
  const anfitrion: Anfitrion = {
    millis: registrar('millis', 0), micros: registrar('micros', 0),
    delay: registrar('delay'), delayUs: registrar('delayUs'), rendir: registrar('rendir'),
    pinMode: registrar('pinMode'), digitalWrite: registrar('digitalWrite'), digitalRead: registrar('digitalRead', 0),
    analogRead: registrar('analogRead', 0), analogReadResolution: registrar('analogReadResolution'),
    analogWrite: registrar('analogWrite'), analogWriteResolution: registrar('analogWriteResolution'),
    ledcAttach: registrar('ledcAttach', true), ledcWrite: registrar('ledcWrite', true), ledcDetach: registrar('ledcDetach', true),
    serialBegin: registrar('serialBegin'), serialWrite: escribir('serialWrite'), serialAvailable: registrar('serialAvailable', 0),
    aviso: (texto: string) => { llamadas.push(['aviso', texto]); }, vl53Medir: registrar('vl53Medir', 0),
    mpuLeer: () => { llamadas.push(['mpuLeer']); return [0, 0, 0, 0, 0, 0, 0]; },
    tcsLeer: (...args: unknown[]) => { llamadas.push(['tcsLeer', ...args]); return [0, 0, 0, 0]; },
    azarU32: registrar('azarU32', 12345), salidaEstandar: escribir('salidaEstandar'), tiempoNs: () => 0n,
    ajustable: (grupo: string, nombre: string, valor: number) => { llamadas.push(['ajustable', grupo, nombre, valor]); return valor; },
  };
  return { anfitrion, llamadas, texto: () => texto };
}
