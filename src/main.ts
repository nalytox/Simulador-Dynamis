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

registrarPrueba('compilador', new ClienteCompilador());
void iniciarAplicacion(document);
