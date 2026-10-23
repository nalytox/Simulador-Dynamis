import { compilar, type ArchivosNucleo } from '../../src/compilador/compilar';

/** Exports dyn_setup/dyn_loop para probar sin el núcleo real. */
export const PEGAMENTO = 'void setup(); void loop();\nextern "C" __attribute__((export_name("dyn_setup"))) void dyn_setup() { setup(); }\nextern "C" __attribute__((export_name("dyn_loop"))) void dyn_loop() { loop(); }\n';

/** Compila archivos para una prueba; lanza con los diagnósticos si falla. */
export async function compilarParaPrueba(archivos: Record<string, string>, nucleo: ArchivosNucleo, nombre = 'prueba'): Promise<WebAssembly.Module> {
  const r = await compilar({ nombre, archivos }, nucleo);
  if (!r.ok) {
    const texto = r.diagnosticos.map(d => `${d.archivo ?? ''}:${d.linea ?? ''}: ${d.mensaje}\n${d.detalle}`).join('\n');
    throw new Error(`No compiló:\n${texto}`);
  }
  return WebAssembly.compile(r.wasm);
}
