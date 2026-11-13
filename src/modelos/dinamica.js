// MODELO DE DINÁMICA DEL ROBOT — lo implementa el profesor.
// Contrato y unidades: ver src/modelos/README.md.
//
// Un modelo de fuerzas, paso a paso:
// - cada motor empuja su rueda según el PWM y su velocidad (un motor de corriente continua: con la
//   rueda frenada da su torque de bloqueo, y a vMaxMmS ya no empuja), sin pasar del roce de la goma;
// - el robot tiene masa e inercia: acelera y frena de a poco;
// - las ruedas tienen su radio: suben un bache rodando sobre él, y subirlo cuesta fuerza según el peso
//   que carga cada rueda (el centro de masa lo reparte entre las ruedas y las ruedas locas);
// - la parte baja del robot (el sensor de línea, los sensores de color, la panza entre las ruedas)
//   choca con un bache más alto que ella y traba al robot;
// - el piso no es perfecto: las baldosas quedan a alturas un poco distintas, la rodadura cambia de
//   una a otra y el agarre de cada rueda varía un poco con el tiempo (con la semilla de la prueba).
import { huellaRobot } from '../robot/config';
import { TAMANO_BALDOSA } from '../pista/tipos';
import { PISO } from './parametros.js';

const G = 9.81; // m/s²
const NM_POR_KG_CM = 0.0980665;
/** Muestras para ver si el suelo bajo una rueda es un plano, y el paso fino cuando no lo es (mm). */
const MUESTRAS_GRUESAS = 8;
const PASO_FINO_MM = 1;
/** Para medir la pendiente que sube el centro de una rueda (mm). */
const DELTA_MM = 0.5;
/** Velocidad bajo la cual la rodadura se suaviza, para que el robot pueda quedar quieto (mm/s). */
const SUAVIZADO_MM_S = 5;
/** Cuánto puede tocar el suelo la parte baja del robot sin trabarse (mm): el piso tiene desniveles. */
const TOLERANCIA_ROCE_MM = 0.2;

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Estado del robot al empezar una ejecución.
 * @param {{ x: number, y: number, yaw: number }} pose mm y rad, en el marco del mundo
 * @param {import('../robot/config').ConfigRobot} robot
 * @param {import('../mundo/tipos').Mundo} mundo
 */
export function estadoInicial(pose, robot, mundo) {
  const f = fisica(robot);
  return { x: pose.x, y: pose.y, yaw: pose.yaw, ...apoyo(pose.x, pose.y, pose.yaw, robot, f, sueloDe(mundo)), v: 0, w: 0, agarreIzq: 0, agarreDer: 0 };
}

/**
 * Avanza el estado del robot un paso de dt segundos.
 * @param {Record<string, any>} estado { x, y, z, yaw, pitch, roll, v (mm/s), w (rad/s), agarreIzq, agarreDer }
 * @param {import('../simulacion/motores').Motores} motores duty ∈ [−1, 1] y modo de cada motor
 * @param {number} dt segundos
 * @param {import('../mundo/tipos').Mundo} mundo
 * @param {import('../robot/config').ConfigRobot} robot
 * @param {() => number} azar números aleatorios en [0, 1) con la semilla de la ejecución
 */
export function pasoDinamica(estado, motores, dt, mundo, robot, azar) {
  const f = fisica(robot);
  const suelo = sueloDe(mundo);
  const v = estado.v ?? 0;
  const w = estado.w ?? 0;
  const agarreIzq = variarAgarre(estado.agarreIzq ?? 0, dt, azar);
  const agarreDer = variarAgarre(estado.agarreDer ?? 0, dt, azar);
  const c = Math.cos(estado.yaw);
  const s = Math.sin(estado.yaw);

  // Fuerzas hacia adelante (N) y torque de giro (N·m) de cada apoyo.
  let fuerza = 0;
  let torque = 0;
  for (const a of f.apoyos) {
    const px = estado.x + a.x * c - a.y * s;
    const py = estado.y + a.x * s + a.y * c;
    const { pendiente } = alturaApoyo(suelo, px, py, c, s, a.radio);
    const vAdelante = v - w * a.y; // mm/s; a.y > 0 a la izquierda
    let fx = -a.carga * pendiente; // subir (o bajar) por el relieve
    if (a.motriz) {
      const agarre = a.y > 0 ? agarreIzq : agarreDer;
      const empuje = empujeMotor(a.y > 0 ? motores.izq : motores.der, vAdelante, robot, f) * (1 + agarre);
      fx += limitar(empuje, -PISO.mu * a.carga, PISO.mu * a.carga);
    }
    const resistencia = a.carga * a.rodadura * rodaduraDe(px, py);
    fx -= resistencia * Math.tanh(vAdelante / SUAVIZADO_MM_S);
    fuerza += fx;
    torque += (-a.y / 1000) * fx;
    // Al girar, las ruedas locas (y un apoyo que se arrastra) van de lado: también frenan el giro.
    if (!a.motriz) torque -= resistencia * (Math.abs(a.x) / 1000) * Math.tanh((w * Math.abs(a.x)) / SUAVIZADO_MM_S);
  }

  let vNueva = v + (fuerza / f.masa) * 1000 * dt;
  let wNueva = w + (torque / f.inercia) * dt;
  const yaw = estado.yaw + wNueva * dt;
  let x = estado.x + vNueva * Math.cos(yaw) * dt;
  let y = estado.y + vNueva * Math.sin(yaw) * dt;
  let nuevo = { x, y, yaw, ...apoyo(x, y, yaw, robot, f, suelo) };

  // Un obstáculo no deja pasar al chasis; la parte baja que choca con el relieve, tampoco.
  const choca = mundo.colisiona(huellaRobot(x, y, yaw, robot)) !== null;
  const roce = penetracion(nuevo, f, suelo);
  const trabado = roce > TOLERANCIA_ROCE_MM && roce > penetracion(estado, f, suelo) + 1e-9;
  if (trabado) {
    nuevo = { x: estado.x, y: estado.y, yaw: estado.yaw, ...apoyo(estado.x, estado.y, estado.yaw, robot, f, suelo) };
    vNueva = 0;
    wNueva = 0;
  } else if (choca) {
    x = estado.x;
    y = estado.y;
    nuevo = { x, y, yaw, ...apoyo(x, y, yaw, robot, f, suelo) };
    vNueva = 0;
  }
  return { ...estado, ...nuevo, v: vNueva, w: wNueva, agarreIzq, agarreDer };
}

/** La masa, la inercia, el empuje de los motores y los apoyos, con el peso repartido entre ellos. */
function fisica(robot) {
  const masa = robot.chasis.masa / 1000; // kg
  const peso = masa * G; // N
  const radio = robot.ruedas.diametro / 2;
  const fuerzaBloqueo = (robot.motores.torqueKgCm * NM_POR_KG_CM) / (radio / 1000); // N por rueda
  const locas = robot.ruedasLocas?.instalado && robot.ruedasLocas.x !== robot.ruedas.x ? robot.ruedasLocas : null;
  const xc = robot.chasis.xCentroMasa;
  // Sin ruedas locas, el chasis se arrastra por su frente o por su cola, según dónde quede el centro de masa.
  const xApoyo = locas ? locas.x : xc >= robot.ruedas.x ? robot.chasis.xDelantero : robot.chasis.xDelantero - robot.chasis.largo;
  const enApoyo = limitar((xc - robot.ruedas.x) / (xApoyo - robot.ruedas.x), 0, 1);
  const cargaEje = peso * (1 - enApoyo);
  const cargaApoyo = peso * enApoyo;
  const medio = robot.ruedas.trocha / 2;
  const apoyos = [
    { x: robot.ruedas.x, y: medio, radio, carga: cargaEje / 2, motriz: true, rodadura: PISO.rodadura },
    { x: robot.ruedas.x, y: -medio, radio, carga: cargaEje / 2, motriz: true, rodadura: PISO.rodadura },
    ...(locas
      ? [1, -1].map(lado => ({ x: locas.x, y: (lado * locas.trocha) / 2, radio: locas.diametro / 2, carga: cargaApoyo / 2, motriz: false, rodadura: PISO.rodaduraLocas }))
      : [{ x: xApoyo, y: 0, radio: 0, carga: cargaApoyo, motriz: false, rodadura: PISO.muArrastre }]),
  ];
  const { largo, ancho } = robot.chasis;
  const inercia = (masa * ((largo / 1000) ** 2 + (ancho / 1000) ** 2)) / 12; // kg·m²
  return { masa, inercia, fuerzaBloqueo, apoyos, locas, xApoyo, partesBajas: partesBajas(robot, locas) };
}

/**
 * Lo que empuja un motor en su rueda (N), con el promedio del PWM: el driver alterna entre manejar y
 * frenar, así que se comporta como un motor a duty · voltaje. libre: no empuja ni frena.
 */
function empujeMotor(m, vRueda, robot, f) {
  const giro = vRueda / robot.motores.vMaxMmS;
  if (m.modo === 'avance' || m.modo === 'retroceso') return f.fuerzaBloqueo * (m.duty - giro);
  if (m.modo === 'freno') return -f.fuerzaBloqueo * giro;
  return 0;
}

/** El agarre de una rueda (una fracción, alrededor de 0) cambia de a poco al azar. */
function variarAgarre(agarre, dt, azar) {
  const tau = PISO.ruidoAgarreS;
  const normal = Math.sqrt(-2 * Math.log(1 - azar())) * Math.cos(2 * Math.PI * azar());
  return agarre - (agarre / tau) * dt + PISO.ruidoAgarre * Math.sqrt((2 * dt) / tau) * normal;
}

/** Un número entre −1 y 1 que depende solo de la baldosa (c, r): el desnivel y la rodadura de cada una. */
function alAzarPorBaldosa(c, r, k) {
  let h = Math.imul(c, 73856093) ^ Math.imul(r, 19349663) ^ Math.imul(k, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

const baldosa = v => Math.floor(v / TAMANO_BALDOSA);

/** El suelo que pisa el robot: el relieve de la pista más el desnivel entre baldosas. */
function sueloDe(mundo) {
  return (x, y) => mundo.altura(x, y) + PISO.desnivelMm * alAzarPorBaldosa(baldosa(x), baldosa(y), 1);
}

const rodaduraDe = (x, y) => 1 + PISO.variacionRodadura * alAzarPorBaldosa(baldosa(x), baldosa(y), 2);

/**
 * Dónde queda un apoyo de radio R (una rueda; R = 0 es un punto que se arrastra) puesto en (px, py)
 * con rumbo (dx, dy). `altura` es la de su centro menos R: en lo plano, la del suelo; en una rampa, un
 * poco más (la rueda toca la rampa un poco más atrás). `pendiente`: cuánto sube su centro por mm que
 * avanza. Sobre un bache la rueda no salta: rueda sobre él, así que su centro sube de a poco.
 */
function alturaApoyo(suelo, px, py, dx, dy, R) {
  const altura = alturaCentro(suelo, px, py, dx, dy, R);
  const pendiente = (alturaCentro(suelo, px + DELTA_MM * dx, py + DELTA_MM * dy, dx, dy, R) - altura) / DELTA_MM;
  return { altura, pendiente };
}

/** La altura del centro de una rueda de radio R puesta en (px, py), menos R. */
function alturaCentro(suelo, px, py, dx, dy, R) {
  if (R <= 0) return suelo(px, py);
  const h = [];
  for (let i = 0; i <= MUESTRAS_GRUESAS; i++) {
    const s = -R + (2 * R * i) / MUESTRAS_GRUESAS;
    h.push(suelo(px + s * dx, py + s * dy));
  }
  const medio = h[MUESTRAS_GRUESAS / 2];
  const b = (h[MUESTRAS_GRUESAS] - h[0]) / (2 * R);
  const plano = h.every((hi, i) => Math.abs(hi - (medio + b * (-R + (2 * R * i) / MUESTRAS_GRUESAS))) < 1e-6);
  if (plano) return medio + R * (Math.sqrt(1 + b * b) - 1);
  // Desde el punto bajo el centro hacia los dos lados: lo más alto que toca la rueda.
  let mejor = medio;
  for (let s = PASO_FINO_MM; s <= R; s += PASO_FINO_MM) {
    const borde = Math.sqrt(R * R - s * s) - R;
    mejor = Math.max(mejor, suelo(px + s * dx, py + s * dy) + borde, suelo(px - s * dx, py - s * dy) + borde);
  }
  return mejor;
}

/**
 * Altura del eje e inclinación del robot apoyado en el suelo. z es la altura del suelo bajo el eje de
 * las ruedas; el roll sale de cada rueda motriz y el pitch de dos apoyos a lo largo del robot: el eje
 * de las ruedas y el de las ruedas locas, si las tiene; si no, el frente y la cola del chasis.
 */
function apoyo(x, y, yaw, robot, f, suelo) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const en = (adelante, izquierda, R) =>
    alturaApoyo(suelo, x + adelante * c - izquierda * s, y + adelante * s + izquierda * c, c, s, R).altura;
  const medio = robot.ruedas.trocha / 2;
  const radio = robot.ruedas.diametro / 2;
  const izq = en(robot.ruedas.x, medio, radio);
  const der = en(robot.ruedas.x, -medio, radio);
  const roll = Math.atan2(izq - der, 2 * medio);
  let z;
  let pitch;
  if (f.locas) {
    const rl = f.locas.diametro / 2;
    const delante = (en(f.locas.x, f.locas.trocha / 2, rl) + en(f.locas.x, -f.locas.trocha / 2, rl)) / 2;
    z = (izq + der) / 2;
    pitch = -Math.atan2(delante - z, f.locas.x - robot.ruedas.x);
  } else {
    const frente = robot.chasis.xDelantero;
    const cola = frente - robot.chasis.largo;
    const hFrente = en(frente, 0, 0);
    const hCola = en(cola, 0, 0);
    z = hCola + ((hFrente - hCola) * (robot.ruedas.x - cola)) / (frente - cola);
    pitch = -Math.atan2(hFrente - hCola, frente - cola);
  }
  return { z, pitch: pitch === 0 ? 0 : pitch, roll: roll === 0 ? 0 : roll };
}

/**
 * Los puntos más bajos del robot, en su marco (mm): la barra del sensor de línea, los sensores de
 * color y la panza (la base entre las ruedas y las ruedas locas, lejos de ellas).
 */
function partesBajas(robot, locas) {
  const puntos = [];
  const { qtr } = robot;
  const lado = ((qtr.pines.length - 1) / 2) * qtr.separacion + 4;
  for (const dx of [-5, 0, 5]) for (const dy of [-lado, 0, lado]) puntos.push([qtr.x + dx, dy, qtr.altura]);
  for (const color of [robot.tcs34725, ...(robot.tcs34725b?.instalado ? [robot.tcs34725b] : [])]) {
    for (const [dx, dy] of [[0, 0], [-8, -8], [-8, 8], [8, -8], [8, 8]]) puntos.push([color.x + dx, color.y + dy, color.z]);
  }
  const desde = robot.ruedas.x + robot.ruedas.diametro / 2;
  const hasta = locas ? locas.x - locas.diametro / 2 : robot.chasis.xDelantero;
  const ancho = robot.ruedas.trocha / 2 - 15;
  if (hasta > desde && ancho > 0) {
    for (const px of [desde, (desde + hasta) / 2, hasta]) for (const py of [-ancho, 0, ancho]) puntos.push([px, py, robot.chasis.alturaLibre]);
  }
  return puntos;
}

/** Cuánto se mete en el suelo la parte más baja del robot (mm; 0 o menos si no lo toca). */
function penetracion(estado, f, suelo) {
  const [cr, sr] = [Math.cos(estado.roll), Math.sin(estado.roll)];
  const [cp, sp] = [Math.cos(estado.pitch), Math.sin(estado.pitch)];
  const [cy, sy] = [Math.cos(estado.yaw), Math.sin(estado.yaw)];
  let peor = -Infinity;
  for (const [lx, ly, lz] of f.partesBajas) {
    const y1 = ly * cr - lz * sr;
    const z1 = ly * sr + lz * cr;
    const x2 = lx * cp + z1 * sp;
    const z2 = -lx * sp + z1 * cp;
    const px = estado.x + x2 * cy - y1 * sy;
    const py = estado.y + x2 * sy + y1 * cy;
    const dentro = suelo(px, py) - (estado.z + z2);
    if (dentro > peor) peor = dentro;
  }
  return peor;
}
