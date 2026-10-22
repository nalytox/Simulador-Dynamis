const DURACION_MS = 4000;

/** Avisos breves: el logro amarillo (hitos, meta) y un aviso para lo demás. Desaparecen solos. */
export function crearAvisos(raiz: Document): { logro(texto: string): void; aviso(texto: string): void } {
  const $ = (id: string) => raiz.getElementById(id)!;
  const ocultar = new Map<string, ReturnType<typeof setTimeout>>();
  const mostrar = (caja: string, texto: string, destino: string) => {
    $(destino).textContent = texto;
    $(caja).hidden = false;
    clearTimeout(ocultar.get(caja));
    ocultar.set(caja, setTimeout(() => { $(caja).hidden = true; }, DURACION_MS));
  };
  return {
    logro: texto => mostrar('logro', texto, 'txt-logro'),
    aviso: texto => mostrar('toast', texto, 'toast-txt'),
  };
}
