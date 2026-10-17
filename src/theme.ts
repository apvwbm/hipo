// Tokens de diseño. Solo modo claro: blanco, teja, grises y verdes apagados.
// Ninguna pantalla escribe un color literal: o sale de aquí, o no existe.
//
// **Un solo acento.** La teja es la marca: el botón principal, la cifra que importa y la
// pestaña activa. El verde dice "va bien", el ocre "ojo" y la teja con icono "cuidado".
// Los colores de estado van SIEMPRE con texto o icono.
//
// Plano: bordes de 1 px y espacio en blanco, nunca sombras ni degradados.

import type { TextStyle } from 'react-native';

export const color = {
  fondo: '#FFFFFF',
  superficie: '#F6F5F3',
  linea: '#E7E4E0',
  lineaFuerte: '#1F1D1B',

  texto: '#1F1D1B',
  texto2: '#6F6A65',
  texto3: '#A39E98',

  // Contraste 6,2:1 sobre blanco (AA para texto normal).
  acento: '#9A4A2C',
  acentoSuave: '#F6EAE4',
  sobreAcento: '#FFFFFF',

  verde: '#4A7559',
  verdeSuave: '#E5EEE7',
  ocre: '#966A22',
  ocreSuave: '#F6EEDF',

  velo: 'rgba(31,29,27,0.45)',
} as const;

/** Múltiplos de 4. */
export const espacio = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, pantalla: 20 } as const;

/** Zona táctil mínima (las guías piden 44 pt; 48 es la de Android). */
export const TACTIL = 48;
export const RADIO = 4;
export const BORDE = 1;

export const fuente = {
  regular: 'Archivo_400Regular',
  semi: 'Archivo_600SemiBold',
  display: 'Archivo_800ExtraBold',
} as const;

/** Las cifras van con `tabular-nums`: si no, un importe baila al cambiar un dígito. */
const NUM: TextStyle = { fontVariant: ['tabular-nums'] };

export const typo = {
  heroe: { fontFamily: fuente.display, fontSize: 44, lineHeight: 50, letterSpacing: -1.6, ...NUM },
  cifra: { fontFamily: fuente.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.8, ...NUM },
  titulo: { fontFamily: fuente.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.8, textTransform: 'uppercase' },
  seccion: { fontFamily: fuente.display, fontSize: 13, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  cuerpo: { fontFamily: fuente.semi, fontSize: 16, lineHeight: 22 },
  texto: { fontFamily: fuente.regular, fontSize: 15, lineHeight: 21 },
  apoyo: { fontFamily: fuente.regular, fontSize: 13, lineHeight: 18 },
  dato: { fontFamily: fuente.semi, fontSize: 15, lineHeight: 20, ...NUM },
  micro: { fontFamily: fuente.semi, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;
