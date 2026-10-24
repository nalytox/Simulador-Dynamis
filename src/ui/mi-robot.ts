import { confirmar } from './dialogo';
import { dibujarFichaRobot } from './dibujo';
import { CAMPOS_ROBOT, conCampo, escribirRobot, leerCampo, leerRobot, type CampoRobot } from '../robot/archivo';
import { ROBOT_POR_DEFECTO, validarRobot, type AvisoRobot, type ConfigRobot } from '../robot/config';

/** Medio lado del dibujo del robot, en mm: el robot de las bases mide hasta 20 cm. */
const MEDIO_DIBUJO_MM = 170;
const TAMANO_MAXIMO = 1024 * 1024;

const idDe = (ruta: string) => `rb-${ruta.replaceAll('.', '-')}`;
const texto = (v: number | boolean | null) => (v === null || typeof v === 'boolean' ? '' : String(v));

/** Los campos donde se muestra un aviso de validarRobot: el suyo, los pines repetidos o la posición del sensor. */
function camposDelAviso(a: AvisoRobot, r: ConfigRobot): string[] {
  if (CAMPOS_ROBOT.some(c => c.ruta === a.campo)) return [a.campo];
  if (a.campo === 'pines') {
    const pin = Number(/El pin (\d+)/.exec(a.mensaje)?.[1]);
    return CAMPOS_ROBOT.filter(c => c.unidad === 'pin' && leerCampo(r, c.ruta) === pin).map(c => c.ruta);
  }
  return CAMPOS_ROBOT.filter(c => c.grupo === 'Sensores' && c.ruta.startsWith(`${a.campo}.`) && /\.(x|y)$/.test(c.ruta)).map(c => c.ruta);
}

/**
 * La ventana "Mi robot" (spec §8): medidas, sensores y pines del robot, su dibujo desde arriba y
 * los avisos de validarRobot junto a cada campo. Cada cambio se aplica al tiro (el robot nuevo se
 * usa en la próxima prueba). Exporta e importa robot.json y vuelve a los valores del profe.
 */
export function crearVentanaRobot(raiz: Document, eventos: { robot(): ConfigRobot; alCambiar(r: ConfigRobot): void }): { abrir(): void } {
  const $ = <E extends HTMLElement>(id: string) => raiz.getElementById(id) as E;
  const ventana = $<HTMLDialogElement>('ventana-robot');
  const lienzo = $<HTMLCanvasElement>('robot-dibujo');
  const listaAvisos = $('robot-avisos');
  const cajaError = $('robot-error');
  const importado = $('robot-importado');
  const entrada = $<HTMLInputElement>('in-robot');
  const contenedores: Record<CampoRobot['grupo'], HTMLElement> = { Medidas: $('robot-medidas'), Sensores: $('robot-sensores'), Pines: $('robot-pines') };
  const entradas = new Map<string, HTMLInputElement>();
  const notas = new Map<string, HTMLElement>();

  const dibujar = (r: ConfigRobot) => {
    const dpr = window.devicePixelRatio || 1;
    const lado = Math.round(lienzo.clientWidth * dpr);
    if (lado === 0) return;
    lienzo.width = lienzo.height = lado;
    const ctx = lienzo.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, lado, lado);
    dibujarFichaRobot(ctx, { escala: lado / (2 * MEDIO_DIBUJO_MM), x0: lado / 2, y0: lado / 2 }, r);
  };

  const mostrarAvisos = (r: ConfigRobot) => {
    const avisos = validarRobot(r);
    const porCampo = new Map<string, string[]>();
    for (const a of avisos) for (const ruta of camposDelAviso(a, r)) porCampo.set(ruta, [...(porCampo.get(ruta) ?? []), a.mensaje]);
    for (const [ruta, input] of entradas) {
      const mensajes = porCampo.get(ruta);
      const nota = notas.get(ruta)!;
      nota.textContent = mensajes?.join(' ') ?? '';
      nota.hidden = !mensajes;
      if (mensajes) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', nota.id);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }
    listaAvisos.replaceChildren(...(avisos.length > 0 ? avisos.map(a => a.mensaje) : ['Todo bien: tu robot cabe en las bases y sus pines no chocan.']).map(m => {
      const li = raiz.createElement('li');
      li.textContent = m;
      if (avisos.length === 0) li.className = 'ok';
      return li;
    }));
  };

  const mostrarValores = (r: ConfigRobot) => {
    for (const [ruta, input] of entradas) {
      const v = leerCampo(r, ruta);
      if (input.type === 'checkbox') input.checked = v === true;
      else input.value = texto(v);
    }
  };

  const aplicar = (r: ConfigRobot) => {
    eventos.alCambiar(r);
    mostrarAvisos(r);
    dibujar(r);
  };

  for (const campo of CAMPOS_ROBOT) {
    const input = raiz.createElement('input');
    input.id = idDe(campo.ruta);
    const etiqueta = raiz.createElement('label');
    etiqueta.className = 'campo-robot';
    etiqueta.htmlFor = input.id;
    const nombre = raiz.createElement('span');
    nombre.textContent = campo.etiqueta;
    const nota = raiz.createElement('span');
    nota.className = 'aviso-campo';
    nota.id = `${input.id}-aviso`;
    nota.hidden = true;
    if (campo.tipo === 'si-no') {
      input.type = 'checkbox';
      input.addEventListener('change', () => aplicar(conCampo(eventos.robot(), campo.ruta, input.checked)));
      etiqueta.classList.add('si-no');
      etiqueta.append(input, nombre);
    } else {
      Object.assign(input, { type: 'number', step: campo.tipo === 'numero' ? 'any' : '1' });
      if (campo.min !== undefined) input.min = String(campo.min);
      if (campo.max !== undefined) input.max = String(campo.max);
      const opcional = campo.tipo === 'pin-opcional' || campo.tipo === 'canal';
      if (opcional) input.placeholder = campo.tipo === 'canal' ? 'sin multiplexor' : 'sin conectar';
      input.addEventListener('change', () => {
        const r = eventos.robot();
        if (opcional && input.value.trim() === '') {
          aplicar(conCampo(r, campo.ruta, null));
          return;
        }
        const v = Number.parseFloat(input.value);
        if (!Number.isFinite(v)) {
          input.value = texto(leerCampo(r, campo.ruta));
          return;
        }
        const nuevo = conCampo(r, campo.ruta, v);
        input.value = texto(leerCampo(nuevo, campo.ruta));
        aplicar(nuevo);
      });
      const unidad = raiz.createElement('span');
      unidad.className = 'unidad';
      unidad.textContent = campo.unidad === 'pin' ? 'GPIO' : campo.unidad ?? '';
      const fila = raiz.createElement('span');
      fila.className = 'entrada';
      fila.append(input, unidad);
      etiqueta.append(nombre, fila);
    }
    const caja = raiz.createElement('div');
    caja.append(etiqueta, nota);
    contenedores[campo.grupo].append(caja);
    entradas.set(campo.ruta, input);
    notas.set(campo.ruta, nota);
  }

  const mostrarError = (errores: string[]) => {
    $('robot-error-lista').replaceChildren(...errores.map(e => {
      const li = raiz.createElement('li');
      li.textContent = e;
      return li;
    }));
    cajaError.hidden = false;
    importado.textContent = '';
  };
  const cargar = (r: ConfigRobot) => {
    cajaError.hidden = true;
    mostrarValores(r);
    aplicar(r);
  };

  $('robot-exportar').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([escribirRobot(eventos.robot())], { type: 'application/json' }));
    const a = raiz.createElement('a');
    a.href = url;
    a.download = 'robot.json';
    a.hidden = true;
    ventana.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('robot-importar').addEventListener('click', () => entrada.click());
  entrada.addEventListener('change', async () => {
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    if (archivo.size > TAMANO_MAXIMO) {
      mostrarError(['El archivo es demasiado grande para ser un robot.']);
      return;
    }
    const r = leerRobot(await archivo.text());
    if (!r.ok) {
      mostrarError(r.errores);
      return;
    }
    // Reemplazar un robot con cambios pide confirmar, como "Volver a los valores del profe".
    const sinCambios = JSON.stringify(eventos.robot()) === JSON.stringify(ROBOT_POR_DEFECTO);
    if (!sinCambios && !(await confirmar(raiz, { titulo: '¿Reemplazar tu robot? Si no lo exportaste, se pierden tus cambios.', boton: 'Reemplazar' }))) return;
    cargar(r.robot);
    importado.textContent = r.avisos.length > 0 ? `Importé tu robot. ${r.avisos.join(' ')}` : 'Importé tu robot.';
  });
  $('robot-profe').addEventListener('click', async () => {
    const seguir = await confirmar(raiz, { titulo: '¿Volver a los valores del profe? Se pierden los cambios de tu robot.', boton: 'Volver a los del profe' });
    if (!seguir) return;
    cargar(structuredClone(ROBOT_POR_DEFECTO));
    importado.textContent = '';
  });
  $('robot-listo').addEventListener('click', () => ventana.close());

  return {
    abrir() {
      const r = eventos.robot();
      cajaError.hidden = true;
      importado.textContent = '';
      mostrarValores(r);
      mostrarAvisos(r);
      ventana.showModal();
      dibujar(r);
    },
  };
}
