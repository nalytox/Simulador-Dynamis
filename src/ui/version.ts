import { esVersionEsp32, type VersionEsp32 } from '../compilador/version';

/** Qué cambia con cada versión: la forma de usar el PWM. */
const NOTAS: Record<VersionEsp32, string> = {
  '3.x': 'PWM por pin: ledcAttach(pin, frecuencia, bits) y ledcWrite(pin, valor).',
  '2.0.14': 'PWM por canal: ledcSetup(canal, frecuencia, bits), ledcAttachPin(pin, canal) y ledcWrite(canal, valor).',
};

/**
 * El interruptor "Versión de la placa esp32" bajo «Mi programa»: elige con qué versión del core
 * Arduino-ESP32 se compila. Usa la del Arduino IDE con que se sube el programa al robot.
 */
export function crearSelectorVersion(raiz: Document, inicial: VersionEsp32, alCambiar: (v: VersionEsp32) => void): void {
  const opciones = [...raiz.querySelectorAll<HTMLInputElement>('input[name="version-esp32"]')];
  const nota = raiz.getElementById('nota-version')!;
  const mostrar = (v: VersionEsp32) => {
    for (const o of opciones) o.checked = o.value === v;
    nota.textContent = NOTAS[v];
  };
  mostrar(inicial);
  for (const o of opciones) {
    o.addEventListener('change', () => {
      if (!o.checked || !esVersionEsp32(o.value)) return;
      mostrar(o.value);
      alCambiar(o.value);
    });
  }
}
