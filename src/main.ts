import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/500.css';
import '@fontsource/lexend/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './ui/tema.css';
import { iniciarAplicacion } from './ui/aplicacion';
import { ClienteCompilador } from './compilador/cliente';
import { registrarPrueba } from './ui/pruebas';
import { prepararAislamiento } from './pwa/registrar';

/** sessionStorage, o uno en memoria si el navegador no deja usarlo. */
function sesion(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return window.sessionStorage;
  } catch {
    const memoria = new Map<string, string>();
    return { getItem: k => memoria.get(k) ?? null, setItem: (k, v) => { memoria.set(k, v); } };
  }
}

registrarPrueba('compilador', new ClienteCompilador());
const estado = await prepararAislamiento({
  aislado: crossOriginIsolated,
  produccion: import.meta.env.PROD,
  sw: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
  sesion: sesion(),
  recargar: () => location.reload(),
});
if (estado !== 'recargando') void iniciarAplicacion(document);
