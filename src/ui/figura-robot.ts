import type { ConfigRobot } from '../robot/config';

/** Un rectángulo centrado en (x, y), en mm del marco del robot (x adelante, y a la izquierda). */
export interface Rect { x: number; y: number; largo: number; ancho: number }
export interface Rueda extends Rect { tipo: 'motriz' | 'loca' }

/** Ancho (de lado a lado) de las ruedas motrices y de las locas, solo para el dibujo. */
const ANCHO_MOTRIZ = 22;
const ANCHO_LOCA = 14;
/** Largo de la flecha del eje x del MPU6050. */
const FLECHA_MPU = 28;

/**
 * Las piezas del robot visto desde arriba: las ruedas (motrices y locas), la placa y la flecha del
 * eje x del MPU6050. La placa es un esquema, centrada en el chasis.
 */
export function piezasRobot(robot: ConfigRobot): { ruedas: Rueda[]; placa: Rect; flechaMPU: { desde: { x: number; y: number }; hasta: { x: number; y: number } } } {
  const { chasis, ruedas, ruedasLocas, mpu6050 } = robot;
  const par = (tipo: Rueda['tipo'], x: number, trocha: number, diametro: number, ancho: number): Rueda[] =>
    [1, -1].map(lado => ({ tipo, x, y: lado * trocha / 2, largo: diametro, ancho }));
  const sentido = mpu6050.orientacion === 'z-arriba-x-atras' ? -1 : 1;
  return {
    ruedas: [
      ...par('motriz', ruedas.x, ruedas.trocha, ruedas.diametro, ANCHO_MOTRIZ),
      ...(ruedasLocas?.instalado ? par('loca', ruedasLocas.x, ruedasLocas.trocha, ruedasLocas.diametro, ANCHO_LOCA) : []),
    ],
    placa: { x: chasis.xDelantero - chasis.largo / 2, y: 0, largo: chasis.largo * 0.8, ancho: chasis.ancho * 0.45 },
    flechaMPU: { desde: { x: mpu6050.x, y: mpu6050.y }, hasta: { x: mpu6050.x + sentido * FLECHA_MPU, y: mpu6050.y } },
  };
}
