import { colorMuestra, nombreColor, porcentajeMotor, posicionLinea, rumboGrados, textoDistancia, textoInclinacion } from './lecturas';
import type { LecturasVista } from '../simulacion/simulador';
import type { LecturaTCS } from '../simulacion/sensores';
import type { Instantanea } from '../simulacion/ejecucion';
import type { Motores } from '../simulacion/motores';

const VE_LINEA = 2000;
const MAXIMO_ADC = 4095;
const ALCANCE_MM = 2000;
const MUY_CERCA_MM = 150;
const SIN = '—';
const GRADOS = 180 / Math.PI;

/** "Lo que siente el robot": QTR, distancia, color, giro e inclinación y motores. */
export function crearTarjetas(raiz: Document): { mostrar(l: LecturasVista | null, e: Instantanea['estado'] | null, m: Motores | null): void } {
  const $ = (id: string) => raiz.getElementById(id)!;
  const barras = Array.from({ length: 8 }, () => {
    const barra = raiz.createElement('div');
    barra.className = 'barra';
    barra.append(raiz.createElement('b'));
    return barra;
  });
  const numeros = Array.from({ length: 8 }, () => raiz.createElement('span'));
  $('qtr').replaceChildren(...barras);
  $('qtr-num').replaceChildren(...numeros);

  for (const boton of raiz.querySelectorAll<HTMLButtonElement>('.sensor .como')) {
    const ejemplo = $(boton.dataset.snip!);
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-controls', ejemplo.id);
    boton.addEventListener('click', () => {
      ejemplo.hidden = !ejemplo.hidden;
      boton.setAttribute('aria-expanded', String(!ejemplo.hidden));
    });
  }

  const motor = (lado: 'izq' | 'der', porcentaje: number | null) => {
    const b = $(`m-${lado}`);
    const p = porcentaje ?? 0;
    b.style.left = p >= 0 ? '50%' : `${50 + p / 2}%`;
    b.style.width = `${Math.abs(p / 2)}%`;
    $(`m-${lado}-n`).textContent = porcentaje === null ? SIN : `${porcentaje}%`;
  };

  const mostrarColor = (id: 'color' | 'color2', c: LecturaTCS, prefijo: string) => {
    $(`${id}-muestra`).style.background = colorMuestra(c);
    $(`${id}-nombre`).textContent = `${prefijo}${nombreColor(c)}`;
    $(`${id}-rgbc`).innerHTML = (['r', 'g', 'b', 'c'] as const).map(k => `<span>${k.toUpperCase()} ${c[k]}</span>`).join('');
  };

  return {
    mostrar(l, e, m) {
      barras.forEach((barra, i) => {
        const v = l?.qtr[i] ?? 0;
        barra.querySelector('b')!.style.height = `${(v / MAXIMO_ADC) * 100}%`;
        barra.classList.toggle('ve', v > VE_LINEA);
        numeros[i].textContent = l ? String(v) : SIN;
      });
      const pos = l ? posicionLinea(l.qtr) : null;
      $('qtr-pos-num').textContent = pos === null ? SIN : String(pos);
      $('qtr-pos').style.left = `${((pos ?? 3500) / 7000) * 100}%`;

      if (l) {
        const mm = l.distanciaMm;
        $('tof-val').innerHTML = mm >= 8190 ? textoDistancia(mm) : `${Math.round(mm)} <small>mm</small>`;
        $('tof-bar').style.width = mm >= ALCANCE_MM ? '0%' : `${100 - (mm / ALCANCE_MM) * 100}%`;
        $('tof-sub').textContent = mm < MUY_CERCA_MM ? '¡Hay algo muy cerca!' : 'Alcance hasta 2 m';
        // Con dos TCS34725, cada fila dice de cuál es.
        const dos = l.color2 !== null;
        mostrarColor('color', l.color, dos ? '1: ' : '');
        $('color2').hidden = !dos;
        if (l.color2) mostrarColor('color2', l.color2, '2: ');
      } else {
        $('tof-val').innerHTML = `${SIN} <small>mm</small>`;
        $('tof-bar').style.width = '0%';
        $('color-muestra').style.background = '#FFFFFF';
        $('color-nombre').textContent = SIN;
        $('color-rgbc').replaceChildren();
        $('color2').hidden = true;
      }

      if (e && l) {
        const rumbo = rumboGrados(e.yaw);
        $('aguja').setAttribute('transform', `rotate(${90 - rumbo} 32 32)`);
        $('mpu-rumbo').textContent = `${rumbo}°`;
        $('mpu-sub').textContent = `Girando a ${Math.round(l.mpu.gz * GRADOS)} °/s · ${textoInclinacion(e.pitch)}`;
      } else {
        $('aguja').setAttribute('transform', 'rotate(90 32 32)');
        $('mpu-rumbo').textContent = SIN;
        $('mpu-sub').textContent = 'Giro e inclinación del robot';
      }
      motor('izq', m ? porcentajeMotor(m.izq) : null);
      motor('der', m ? porcentajeMotor(m.der) : null);
    },
  };
}
