import type { LecturaTCS } from '../simulacion/sensores';
import type { EstadoMotor } from '../simulacion/motores';

/** Con menos luz que esto el sensor de color ve negro (con 24 ms y ganancia 4, el blanco da c ≈ 2880). */
const POCA_LUZ = 300;

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** Color para mostrar lo que lee el TCS34725: el canal más alto llega a 255. */
export function colorMuestra(c: LecturaTCS): string {
  if (c.c < POCA_LUZ) return '#000000';
  const maximo = Math.max(c.r, c.g, c.b, 1);
  return `#${hex2((c.r / maximo) * 255)}${hex2((c.g / maximo) * 255)}${hex2((c.b / maximo) * 255)}`;
}

/** Umbrales de QTRSensors: sobre 200 (de 1000) se ve la línea, y bajo 50 un sensor no cuenta. */
const SOBRE_LINEA = 200;
const RUIDO = 50;
const MAXIMO_ADC = 4095;

/** Posición de la línea (0 a 7000) calculada como readLineBlack, o null si ningún sensor la ve. */
export function posicionLinea(qtr: number[]): number | null {
  let sobreLinea = false;
  let ponderado = 0;
  let suma = 0;
  qtr.forEach((crudo, i) => {
    const v = Math.round((Math.min(crudo, MAXIMO_ADC) / MAXIMO_ADC) * 1000);
    if (v > SOBRE_LINEA) sobreLinea = true;
    if (v > RUIDO) {
      ponderado += v * i * 1000;
      suma += v;
    }
  });
  return sobreLinea ? Math.round(ponderado / suma) : null;
}

/** Con el blanco del placeholder a 24 ms y ganancia 4, c ≈ 2880: sobre esto, un color parejo es blanco. */
const LUZ_BLANCO = 1500;
const PAREJO = 0.2;

export function nombreColor(c: LecturaTCS): string {
  if (c.c < POCA_LUZ) return 'Negro';
  const maximo = Math.max(c.r, c.g, c.b);
  const minimo = Math.min(c.r, c.g, c.b);
  if ((maximo - minimo) / maximo < PAREJO) return c.c > LUZ_BLANCO ? 'Blanco' : 'Gris';
  if (maximo === c.g) return 'Verde';
  return maximo === c.r ? 'Rojo' : 'Azul';
}

const GRADOS = 180 / Math.PI;
const sinMenosCero = (n: number) => (n === 0 ? 0 : n);

/** Rumbo del robot en grados enteros, de 0 a 359 (antihorario desde +x, como el yaw). */
export function rumboGrados(yaw: number): number {
  return sinMenosCero(((Math.round(yaw * GRADOS) % 360) + 360) % 360);
}

/** pitch < 0 es nariz arriba (REP-103). */
export function textoInclinacion(pitch: number): string {
  const g = sinMenosCero(Math.round(-pitch * GRADOS));
  if (Math.abs(g) < 2) return 'Plano';
  return g > 0 ? `Inclinación ${g}°, subiendo` : `Inclinación ${-g}°, bajando`;
}

export function porcentajeMotor(m: EstadoMotor): number {
  if (m.modo === 'freno' || m.modo === 'libre') return 0;
  return sinMenosCero(Math.round(m.duty * 100));
}

export function textoDistancia(mm: number): string {
  return mm >= 8190 ? 'Sin objetivo' : `${Math.round(mm)} mm`;
}

const TIEMPO_RONDA_S = 300;

export function textoTiempoRestante(tiempo: number | null): string {
  const resta = Math.max(0, TIEMPO_RONDA_S - (tiempo ?? 0));
  const segundos = Math.floor(resta);
  return `Quedan ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}
