// Euros y porcentajes: formato y parseo de lo que se escribe.
//
// Los importes viven como enteros en céntimos y los porcentajes como enteros en
// milésimas de punto (2,85 % → 2850), así que aquí no hay ni una suma en coma flotante:
// formatear es partir el entero y parsear es juntar dos cadenas de dígitos. A mano y sin
// `Intl`: idéntico en todos los móviles y verificable en Node.

/** El menos tipográfico (U+2212): el guion se ve raquítico a tamaño de titular. */
const MENOS = '−';

/** Entero → '1.234'. */
export function formatoEntero(n: number): string {
  const s = String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? MENOS + s : s;
}

/**
 * Céntimos → '1.234,56 €'. Por defecto sin céntimos si son cero ('245.000 €'): en precios
 * de casas los ",00" son ruido. `exacto` los enseña siempre.
 */
export function euros(cent: number, exacto = false): string {
  const c = Math.round(cent);
  const abs = Math.abs(c);
  const resto = abs % 100;
  const cifra = formatoEntero(Math.floor(abs / 100)) + (resto || exacto ? ',' + String(resto).padStart(2, '0') : '');
  return `${c < 0 ? MENOS : ''}${cifra} €`;
}

/** Céntimos → '245.000 €' redondeado al euro (para cifras grandes y estimaciones). */
export const eurosRedondos = (cent: number): string => euros(Math.round(cent / 100) * 100);

/**
 * Texto → entero con `decimales` cifras decimales. Acepta coma o punto como decimal
 * porque el teclado de Android enseña uno u otro según la ROM. Regla: si el separador
 * que aparece el último sale una sola vez, es el decimal y lo demás son miles
 * ('1.234,5', '12.5'); si se repite, todo son miles ('1.234.567'). Devuelve null si no
 * es un número válido o tiene más decimales de los admitidos.
 */
function parseDecimal(texto: string, decimales: number): number | null {
  const limpio = texto.trim().replace(/[\s€%]/g, '');
  if (!/^[\d.,]+$/.test(limpio)) return null;
  const ultimo = Math.max(limpio.lastIndexOf(','), limpio.lastIndexOf('.'));
  let entero = limpio.replace(/[.,]/g, '');
  let fraccion = '';
  if (ultimo >= 0 && limpio.split(limpio[ultimo]).length === 2) {
    entero = limpio.slice(0, ultimo).replace(/[.,]/g, '');
    fraccion = limpio.slice(ultimo + 1);
  }
  // '250.000' en euros: tres cifras tras un único separador que no caben como decimales
  // son miles.
  if (fraccion.length > decimales && fraccion.length === 3) {
    entero += fraccion;
    fraccion = '';
  }
  if (fraccion.length > decimales) return null;
  if (!entero && !fraccion) return null;
  return Number(entero || '0') * 10 ** decimales + Number(fraccion.padEnd(decimales, '0') || '0');
}

/** '1.234,5' → 123450 céntimos. */
export const parseImporte = (texto: string): number | null => parseDecimal(texto, 2);

/** '2,85' → 2850 milésimas de punto. */
export const parsePct = (texto: string): number | null => parseDecimal(texto, 3);

/** Entero con decimales → lo que se escribe en un campo: (2050, 2) → '20,5'. */
function aTextoDecimal(n: number, decimales: number): string {
  const base = 10 ** decimales;
  const entero = Math.trunc(n / base);
  const resto = String(Math.abs(n % base)).padStart(decimales, '0').replace(/0+$/, '');
  return resto ? `${entero},${resto}` : String(entero);
}

export const aTexto = (cent: number): string => aTextoDecimal(cent, 2);
export const aTextoPct = (mil: number): string => aTextoDecimal(mil, 3);

/** 2850 → '2,85 %'. */
export const pct = (mil: number): string => `${aTextoPct(Math.round(mil))} %`;

/** Aplica un porcentaje en milésimas a un importe: (100000 €, 6000) → 6000 €. */
export const aplicarPct = (cent: number, mil: number): number => Math.round((cent * mil) / 100_000);
