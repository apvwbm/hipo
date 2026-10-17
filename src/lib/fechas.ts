// Fechas como 'YYYY-MM-DD' en hora LOCAL, siempre.
//
// Nunca `toISOString()` ni `new Date('2026-01-05')`: los dos pasan por UTC y en España
// desplazan un día cerca de la medianoche. Se construye con `padStart` y se parsea con
// `new Date(y, m - 1, d)`. Sin dependencias y sin `Intl`, para que el resultado sea el
// mismo en cualquier móvil y se pueda verificar en Node.

const dos = (n: number) => String(n).padStart(2, '0');

export const aISO = (d: Date): string =>
  `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

export const desdeISO = (iso: string): Date => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};

export const hoyISO = (): string => aISO(new Date());

export const fecha = (anio: number, mes0: number, dia: number): string =>
  aISO(new Date(anio, mes0, dia));

/** `new Date(2026, 0, 32)` es el 1 de febrero: el propio Date resuelve los meses. */
export function addDias(iso: string, delta: number): string {
  const d = desdeISO(iso);
  return fecha(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

/**
 * Días de `a` a `b`, con signo. Va por `Date.UTC` a propósito: en local, el día del
 * cambio de hora mide 23 o 25 horas y la división no da un entero.
 */
export function diasEntre(a: string, b: string): number {
  const [aa, am, ad] = a.split('-').map(Number);
  const [ba, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ba, bm - 1, bd) - Date.UTC(aa, am - 1, ad)) / 86400000);
}

export const diasDelMes = (anio: number, mes0: number): number =>
  new Date(anio, mes0 + 1, 0).getDate();

/** 1 = lunes … 7 = domingo. */
export const diaSemana = (iso: string): number => ((desdeISO(iso).getDay() + 6) % 7) + 1;

// ── Rótulos ──────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const nombreMes = (mes0: number): string => MESES[mes0];

/** Lunes primero, como `diaSemana`. */
export const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** '5 ene' (y el año si no es el actual: '5 ene 2027'). */
export function fechaCorta(iso: string, hoy = hoyISO()): string {
  const d = desdeISO(iso);
  const base = `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
  return iso.slice(0, 4) === hoy.slice(0, 4) ? base : `${base} ${d.getFullYear()}`;
}

/** 'lunes, 5 de enero de 2026'. */
export function fechaLarga(iso: string): string {
  const d = desdeISO(iso);
  return `${DIAS[diaSemana(iso) - 1]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** 'hoy', 'mañana', 'ayer', 'en 5 días', 'hace 3 días'. */
export function relativa(iso: string, hoy = hoyISO()): string {
  const n = diasEntre(hoy, iso);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
