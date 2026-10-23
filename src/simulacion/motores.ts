import type { ConfigRobot, PinesMotor } from '../robot/config';
import type { Pines } from './pines';

export type ModoMotor = 'avance' | 'retroceso' | 'freno' | 'libre';

/** duty ∈ [−1, 1] (negativo = retroceso); 0 en freno o libre. */
export interface EstadoMotor { duty: number; modo: ModoMotor }
export interface Motores { izq: EstadoMotor; der: EstadoMotor }

const UMBRAL_ALTO = 0.5;

function motor(p: Pines, pines: PinesMotor, habilitado: boolean): EstadoMotor {
  if (!habilitado) return { duty: 0, modo: 'libre' };
  const in1 = p.nivel(pines.in1) >= UMBRAL_ALTO;
  const in2 = p.nivel(pines.in2) >= UMBRAL_ALTO;
  if (in1 && in2) return { duty: 0, modo: 'freno' };
  if (!in1 && !in2) return { duty: 0, modo: 'libre' };
  const avance = pines.invertir ? !in1 : in1;
  const ciclo = p.nivel(pines.pwm);
  return avance ? { duty: ciclo, modo: 'avance' } : { duty: ciclo === 0 ? 0 : -ciclo, modo: 'retroceso' };
}

/** Traduce los pines del driver TB6612 al estado de cada motor. */
export function pinesAMotores(p: Pines, m: ConfigRobot['motores']): Motores {
  const habilitado = m.stby === null || p.nivel(m.stby) >= UMBRAL_ALTO;
  return { izq: motor(p, m.izq, habilitado), der: motor(p, m.der, habilitado) };
}
