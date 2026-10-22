const SIN_AISLAMIENTO = 'Para usar el simulador, recarga la página o usa Chrome, Edge o Firefox recientes.';

function mostrarAvisoGlobal(raiz: Document, texto: string): void {
  raiz.getElementById('aviso-global-txt')!.textContent = texto;
  raiz.getElementById('aviso-global')!.hidden = false;
}

/** Arma la vista Programar sobre el HTML de index.html. */
export async function iniciarAplicacion(raiz: Document): Promise<void> {
  if (!crossOriginIsolated) {
    mostrarAvisoGlobal(raiz, SIN_AISLAMIENTO);
    return;
  }
}
