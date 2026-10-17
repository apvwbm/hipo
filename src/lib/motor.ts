// TODA la lógica de la app: funciones puras, sin Expo ni React, cubiertas por
// `scripts/verifica.ts`. Las pantallas no hacen cuentas: llaman a esto (vía `hooks.ts`).
//
// Unidades: importes en céntimos, porcentajes en milésimas de punto, plazos en meses
// dentro de las fórmulas y en años en los datos. Lo calculado no se guarda nunca: cada
// número se deriva de los datos cada vez.

import {
  comunidad,
  EDAD_LIMITE,
  RATIO_ENDEUDAMIENTO,
  TAREAS,
  TIPOS_DOC,
  type Contexto,
  type GrupoDoc,
  type Tarea,
  type TipoDoc,
  type Tramo,
  type Comunidad,
} from './catalogo';
import { aplicarPct, euros, eurosRedondos } from './dinero';
import { addDias, diasEntre, fechaCorta } from './fechas';
import type { Ajustes, Archivo, Casa, Datos, Hipoteca, Id, Titular } from '@/types';

const MIL_EUROS = 100_000;

// ── Cuota (sistema francés) ──────────────────────────────────────────────────

const mensual = (tin: number) => tin / 1_200_000;

function cuotaExacta(capital: number, tin: number, meses: number): number {
  if (meses <= 0 || capital <= 0) return 0;
  const i = mensual(tin);
  return i === 0 ? capital / meses : (capital * i) / (1 - (1 + i) ** -meses);
}

/** Cuota mensual en céntimos. TIN 0 → capital / meses. */
export const cuota = (capital: number, tin: number, meses: number): number => Math.round(cuotaExacta(capital, tin, meses));

/** El mayor capital que se paga con esa cuota. */
export function capitalMax(cuotaMes: number, tin: number, meses: number): number {
  if (meses <= 0 || cuotaMes <= 0) return 0;
  const i = mensual(tin);
  return Math.floor(i === 0 ? cuotaMes * meses : (cuotaMes * (1 - (1 + i) ** -meses)) / i);
}

export type TramoHipoteca = { meses: number; tin: number };

/**
 * Fija, variable y mixta con un solo modelo: un tramo inicial al TIN y el resto a
 * Euríbor + diferencial. Una bonificación que no contratas sube el tipo de los dos.
 */
export function tramos(h: Hipoteca, euribor: number): TramoHipoteca[] {
  const n = h.anios * 12;
  const extra = h.bonificaciones.reduce((s, b) => s + (b.activa ? 0 : b.rebaja), 0);
  const inicial = h.tipo === 'fija' ? n : Math.min(n, h.aniosFijos * 12);
  const t: TramoHipoteca[] = [{ meses: inicial, tin: h.tin + extra }];
  if (inicial < n) t.push({ meses: n - inicial, tin: Math.max(0, euribor + h.diferencial + extra) });
  return t.filter((x) => x.meses > 0);
}

/** Cuota de cada tramo (recalculada con lo pendiente), pendiente al acabarlo e intereses. */
export function amortizar(capital: number, ts: TramoHipoteca[]) {
  let pendiente = capital;
  let restantes = ts.reduce((s, t) => s + t.meses, 0);
  let pagado = 0;
  const cuotas: number[] = [];
  const pendientes: number[] = [];
  for (const t of ts) {
    const i = mensual(t.tin);
    const c = cuotaExacta(pendiente, t.tin, restantes);
    for (let m = 0; m < t.meses; m++) pendiente = pendiente * (1 + i) - c;
    pagado += c * t.meses;
    restantes -= t.meses;
    cuotas.push(Math.round(c));
    pendientes.push(Math.max(0, Math.round(pendiente)));
  }
  return { cuotas, pendientes, intereses: Math.max(0, Math.round(pagado - capital)) };
}

export type Resumen = {
  /** Cuota del primer tramo, sin productos. */
  cuota: number;
  /** Cuota del tramo variable (mixta y variable), con el Euríbor de referencia. */
  cuotaDespues: number | null;
  /** Lo pendiente al acabar el tramo inicial. */
  pendienteTramo: number | null;
  intereses: number;
  /** Lo que cuestan los productos contratados en toda la vida del préstamo. */
  vinculaciones: number;
  /** Intereses + vinculaciones: lo que pagas además de devolver el capital. */
  costeTotal: number;
  /** Cuota + productos prorrateados al mes. */
  cuotaConVinculaciones: number;
  /** Cuota del tramo variable con el Euríbor +1 y +2 puntos. */
  estres: [number, number] | null;
  /** Por bonificación: intereses que ahorra tenerla frente a lo que cuesta. */
  bonificaciones: { ahorro: number; coste: number; compensa: boolean }[];
};

// ponytail: los productos cuestan lo mismo todos los años y se mantienen toda la vida;
// el seguro de vida real sube con la edad. Si importa, coste por año.
export function resumenHipoteca(h: Hipoteca, euribor: number): Resumen {
  const ts = tramos(h, euribor);
  const r = amortizar(h.importe, ts);
  const anual = h.bonificaciones.reduce((s, b) => s + (b.activa ? b.coste : 0), 0);
  const vinculaciones = anual * h.anios;
  const variable = ts.length > 1 || (h.tipo !== 'fija' && h.aniosFijos === 0);
  const intereses = (activa: boolean, j: number) =>
    amortizar(h.importe, tramos({ ...h, bonificaciones: h.bonificaciones.map((b, k) => (k === j ? { ...b, activa } : b)) }, euribor))
      .intereses;
  return {
    cuota: r.cuotas[0] ?? 0,
    cuotaDespues: ts.length > 1 ? r.cuotas[1] : null,
    pendienteTramo: ts.length > 1 ? r.pendientes[0] : null,
    intereses: r.intereses,
    vinculaciones,
    costeTotal: r.intereses + vinculaciones,
    cuotaConVinculaciones: (r.cuotas[0] ?? 0) + Math.round(anual / 12),
    estres: variable
      ? [
          amortizar(h.importe, tramos(h, euribor + 1_000)).cuotas.at(-1) ?? 0,
          amortizar(h.importe, tramos(h, euribor + 2_000)).cuotas.at(-1) ?? 0,
        ]
      : null,
    bonificaciones: h.bonificaciones.map((b, j) => {
      const ahorro = intereses(false, j) - intereses(true, j);
      const coste = b.coste * h.anios;
      return { ahorro, coste, compensa: ahorro > coste };
    }),
  };
}

/** Las ofertas por coste total (descartadas al final). */
export function ordenarHipotecas(hs: Hipoteca[], euribor: number) {
  return hs
    .map((h) => ({ h, r: resumenHipoteca(h, euribor) }))
    .sort((a, b) => Number(a.h.descartada) - Number(b.h.descartada) || a.r.costeTotal - b.r.costeTotal);
}

// ── Impuestos y coste de compra ──────────────────────────────────────────────

/** Escala marginal: cada tramo de la base paga su tipo. */
export function marginal(base: number, escala: Tramo[]): number {
  let total = 0;
  let desde = 0;
  for (const [hasta, tipo] of escala) {
    if (base <= desde) break;
    total += ((Math.min(base, hasta) - desde) * tipo) / 100_000;
    desde = hasta;
  }
  return Math.round(total);
}

export type Linea = { clave: string; nombre: string; importe: number };

/**
 * Segunda mano: ITP sobre el mayor de precio y valor de referencia. Obra nueva: IVA
 * (IGIC, IPSI) + AJD sobre el precio. `propio` sustituye al ITP o al IVA.
 */
export function impuestos(precio: number, valorReferencia: number, nueva: boolean, com: Comunidad, propio: number | null): Linea[] {
  if (precio <= 0) return [];
  if (nueva) {
    return [
      { clave: 'iva', nombre: com.nombreIva, importe: aplicarPct(precio, propio ?? com.iva) },
      { clave: 'ajd', nombre: 'AJD', importe: aplicarPct(precio, com.ajd) },
    ];
  }
  const base = Math.max(precio, valorReferencia);
  return [{ clave: 'itp', nombre: 'ITP', importe: propio !== null ? aplicarPct(base, propio) : marginal(base, com.itp) }];
}

export type LineaCoste = Linea & { real: number | null };
export type Coste = { precio: number; lineas: LineaCoste[]; total: number };

/**
 * Todo lo que cuesta comprarla. Lo que por ley paga el banco (notaría, registro,
 * gestoría y AJD de la hipoteca) no está. Lo pagado de verdad sustituye a lo estimado.
 */
export function costeCompra(casa: Casa, a: Ajustes): Coste {
  const precio = casa.compra?.precio || casa.precio;
  const estimadas: Linea[] = [
    { clave: 'precio', nombre: 'Precio', importe: precio },
    ...impuestos(precio, casa.valorReferencia, casa.nueva, comunidad(a.ccaa), a.impuestoPropio),
    { clave: 'gastos', nombre: 'Notaría, registro y gestoría', importe: aplicarPct(precio, a.gastosPct) },
    { clave: 'tasacion', nombre: 'Tasación', importe: a.tasacion },
  ];
  if (casa.reforma) estimadas.push({ clave: 'reforma', nombre: 'Reforma', importe: casa.reforma });
  const reales = casa.compra?.reales ?? {};
  const lineas = estimadas.map((l) => ({ ...l, real: l.clave === 'precio' ? null : (reales[l.clave] ?? null) }));
  return { precio, lineas, total: lineas.reduce((s, l) => s + (l.real ?? l.importe), 0) };
}

/** Lo que presta el banco: un % del MENOR entre precio y tasación. */
export const financiable = (precio: number, tasacion: number, financiacion: number): number =>
  aplicarPct(tasacion > 0 ? Math.min(precio, tasacion) : precio, financiacion);

// ── Capacidad ────────────────────────────────────────────────────────────────

export const ingresosMes = (ts: Titular[]): number => ts.reduce((s, t) => s + Math.round((t.neto * t.pagas) / 12), 0);
export const deudasMes = (ts: Titular[]): number => ts.reduce((s, t) => s + t.deudas, 0);

/** El plazo se acorta si el mayor de los titulares pasaría de la edad límite. */
export function plazoMax(ts: Titular[], a: Ajustes, hoy: string): number {
  const nacimientos = ts.map((t) => t.nacimiento).filter((n): n is number => !!n);
  if (!nacimientos.length) return a.plazo;
  const edad = Number(hoy.slice(0, 4)) - Math.min(...nacimientos);
  return Math.max(0, Math.min(a.plazo, EDAD_LIMITE - edad));
}

export type Capacidad = {
  /** Precio máximo, redondeado a la baja a 1.000 €. */
  precio: number;
  prestamo: number;
  cuota: number;
  /** Ahorro que se va en esa compra (entrada + impuestos + gastos). */
  necesario: number;
  ingresos: number;
  cuotaMax: number;
  plazo: number;
  /** Qué frena: los ahorros (no llegan a la entrada) o los ingresos (no da la cuota). */
  limita: 'ahorros' | 'ingresos';
};

/**
 * El precio más alto de una casa de segunda mano que puedes pagar con tus ahorros y tu
 * cuota máxima. Dos límites: el banco presta hasta `financiacion` del precio, y como
 * mucho lo que se paga con el 35 % de los ingresos (ratio de endeudamiento). Lo que te falta (entrada, impuestos,
 * gastos) sale de los ahorros.
 */
export function capacidad(ts: Titular[], a: Ajustes, hoy: string): Capacidad {
  const com = comunidad(a.ccaa);
  const ingresos = ingresosMes(ts);
  const plazo = plazoMax(ts, a, hoy);
  const cuotaMax = Math.max(0, aplicarPct(ingresos, RATIO_ENDEUDAMIENTO) - deudasMes(ts));
  const tope = capitalMax(cuotaMax, a.tinSupuesto, plazo * 12);
  const prestamo = (p: number) => Math.min(aplicarPct(p, a.financiacion), tope);
  const necesita = (p: number) =>
    p + impuestos(p, 0, false, com, a.impuestoPropio).reduce((s, l) => s + l.importe, 0) + aplicarPct(p, a.gastosPct) + a.tasacion - prestamo(p);

  // `necesita` crece con el precio, así que basta una búsqueda binaria (en miles de
  // euros). Cota: necesita(p) >= p - tope, luego p <= ahorros + tope.
  let lo = 0;
  let hi = Math.floor((a.ahorros + tope) / MIL_EUROS) + 1;
  while (lo < hi) {
    const medio = Math.ceil((lo + hi) / 2);
    if (necesita(medio * MIL_EUROS) <= a.ahorros) lo = medio;
    else hi = medio - 1;
  }
  const precio = lo * MIL_EUROS;
  const p = prestamo(precio);
  return {
    precio,
    prestamo: p,
    cuota: cuota(p, a.tinSupuesto, plazo * 12),
    necesario: precio ? necesita(precio) : 0,
    ingresos,
    cuotaMax,
    plazo,
    limita: aplicarPct(precio, a.financiacion) <= tope ? 'ahorros' : 'ingresos',
  };
}

// ── Una casa en números ──────────────────────────────────────────────────────

export type Numeros = {
  coste: Coste;
  prestamo: number;
  /** Ahorro que hace falta: coste total − préstamo. */
  necesario: number;
  /** Lo que falta sobre tus ahorros (0 si llegas). */
  falta: number;
  cuota: number;
  /** Cuota (con productos si hay hipoteca elegida) + comunidad + IBI / 12. */
  mensual: number;
  /** (cuota + otras deudas) / ingresos; null sin ingresos. */
  esfuerzo: number | null;
};

export function numerosCasa(casa: Casa, d: Datos, hoy: string): Numeros {
  const a = d.ajustes;
  const coste = costeCompra(casa, a);
  const elegida = d.hipotecas.find((h) => h.id === casa.compra?.hipotecaId);
  const prestamo = elegida ? elegida.importe : financiable(coste.precio, casa.compra?.tasacion ?? 0, a.financiacion);
  let c: number;
  let productos = 0;
  if (elegida) {
    const r = resumenHipoteca(elegida, a.euribor);
    c = r.cuota;
    productos = r.cuotaConVinculaciones - r.cuota;
  } else {
    // Con la mejor oferta que tengas (su tipo inicial y su plazo) o con el TIN supuesto.
    const mejor = ordenarHipotecas(d.hipotecas, a.euribor).find((x) => !x.h.descartada)?.h;
    const tin = mejor ? tramos(mejor, a.euribor)[0].tin : a.tinSupuesto;
    const anios = mejor ? mejor.anios : plazoMax(d.titulares, a, hoy) || a.plazo;
    c = cuota(prestamo, tin, anios * 12);
  }
  const ingresos = ingresosMes(d.titulares);
  const necesario = Math.max(0, coste.total - prestamo);
  return {
    coste,
    prestamo,
    necesario,
    falta: Math.max(0, necesario - a.ahorros),
    cuota: c,
    mensual: c + productos + casa.comunidad + Math.round(casa.ibi / 12),
    esfuerzo: ingresos ? (c + deudasMes(d.titulares)) / ingresos : null,
  };
}

// ── Papeles ──────────────────────────────────────────────────────────────────

export type EstadoDoc = 'ok' | 'falta' | 'caducado';
export type ItemDoc = { tipo: TipoDoc; necesita: number; validos: number; estado: EstadoDoc; archivos: Archivo[] };
export type GrupoPapeles = { clave: string; titulo: string; grupo: GrupoDoc; personaId: Id | null; casaId: Id | null; items: ItemDoc[] };

/** Fecha en que deja de valer; null si no caduca. Sin emisión, cuenta desde el alta. */
export const caducaEl = (a: Archivo, vigencia?: number): string | null =>
  vigencia ? addDias(a.emision ?? a.creado, vigencia) : null;

function item(tipo: TipoDoc, archivos: Archivo[], necesita: number, hoy: string): ItemDoc {
  const validos = archivos.filter((a) => {
    const fin = caducaEl(a, tipo.vigencia);
    return !fin || fin >= hoy;
  }).length;
  return { tipo, necesita, validos, archivos, estado: validos >= necesita ? 'ok' : archivos.length > validos ? 'caducado' : 'falta' };
}

/**
 * Lo que pide el banco: de cada titular y, si hay casa elegida, de la casa. Solo los
 * documentos que ya tocan en esta fase: los demás aparecen al llegar a la suya.
 */
export function papeles(d: Datos, compra: Casa | null, fase: number, hoy: string): GrupoPapeles[] {
  const tocan = TIPOS_DOC.filter((x) => x.fase <= fase);
  const grupos: GrupoPapeles[] = d.titulares.map((t) => ({
    clave: t.id,
    titulo: t.nombre || 'Titular',
    grupo: 'titular',
    personaId: t.id,
    casaId: null,
    items: tocan
      .filter((x) => x.grupo === 'titular' && (x.aplica?.(t) ?? true))
      .map((x) => item(x, d.archivos.filter((a) => a.tipo === x.clave && a.personaId === t.id), x.cantidad ?? 1, hoy)),
  }));
  if (compra) {
    grupos.push({
      clave: compra.id,
      titulo: compra.nombre,
      grupo: 'casa',
      personaId: null,
      casaId: compra.id,
      items: tocan
        .filter((x) => x.grupo === 'casa')
        .map((x) => item(x, d.archivos.filter((a) => a.tipo === x.clave && a.casaId === compra.id), x.cantidad ?? 1, hoy)),
    });
  }
  return grupos.filter((g) => g.items.length > 0);
}

// ── Guía: contexto, fase y tareas ────────────────────────────────────────────

const RANGO: Partial<Record<Casa['estado'], number>> = { oferta: 1, arras: 2, comprada: 3 };

/** La casa que estás comprando: la más avanzada entre oferta, arras y comprada. */
export function casaEnCompra(casas: Casa[]): Casa | null {
  let mejor: Casa | null = null;
  for (const c of casas) {
    const r = RANGO[c.estado];
    if (!r) continue;
    const rm = mejor ? RANGO[mejor.estado]! : 0;
    if (r > rm || (r === rm && mejor && c.creada > mejor.creada)) mejor = c;
  }
  return mejor;
}

export function contexto(d: Datos, hoy: string): Contexto {
  const compra = casaEnCompra(d.casas);
  const deCasa = new Set(TIPOS_DOC.filter((t) => t.grupo === 'casa').map((t) => t.clave));
  // Los papeles de los titulares son de la fase 1: no dependen de en cuál estés.
  const grupos = papeles(d, null, 1, hoy);
  return {
    d,
    compra,
    hoy,
    tiene: (tipo) => d.archivos.some((a) => a.tipo === tipo && (!deCasa.has(tipo) || a.casaId === compra?.id)),
    papelesTitulares:
      d.titulares.length > 0 && grupos.filter((g) => g.grupo === 'titular').every((g) => g.items.every((i) => i.estado === 'ok')),
  };
}

const conPerfil = (d: Datos) => d.titulares.some((t) => t.neto > 0) && d.ajustes.ahorros > 0;
const conCasas = (d: Datos) => d.casas.some((k) => k.estado !== 'descartada');

/**
 * Del 1 al 6, según lo más avanzado que tengas: sirve empieces donde empieces. Cada fase
 * se cierra con un hito: tus datos (1), elegir casa (2), firmar las arras (3), FEIN y
 * banco (4), firmar en la notaría (5).
 */
export function faseActual(x: Contexto): number {
  const c = x.compra;
  if (c?.estado === 'comprada') return 6;
  if (c?.estado === 'arras') return c.compra?.fein && c.compra.hipotecaId ? 5 : 4;
  if (c?.estado === 'oferta') return 3;
  if (conCasas(x.d) || conPerfil(x.d)) return 2;
  return 1;
}

export type Paso = {
  texto: string;
  accion: 'titular' | 'ahorros' | 'nueva' | 'elegir' | 'arras' | 'ofertas' | 'compra' | 'comprada';
};

/** El botón grande de cada fase: lo que te lleva a la siguiente. */
export function siguientePaso(x: Contexto, fase: number): Paso | null {
  const k = x.compra?.compra;
  if (fase === 1) {
    return x.d.titulares.some((t) => t.neto > 0) ? { texto: 'Apunta tus ahorros', accion: 'ahorros' } : { texto: 'Di quién compra y cuánto gana', accion: 'titular' };
  }
  if (fase === 2) return conCasas(x.d) ? { texto: 'Ya he elegido casa', accion: 'elegir' } : { texto: 'Apunta la primera casa', accion: 'nueva' };
  if (fase === 3) return { texto: 'Ya he firmado las arras', accion: 'arras' };
  if (fase === 4) {
    if (!x.d.hipotecas.some((h) => !h.descartada)) return { texto: 'Apunta las ofertas de los bancos', accion: 'ofertas' };
    return { texto: k?.fein ? 'Elige banco' : 'Pon la fecha de la FEIN', accion: 'compra' };
  }
  if (fase === 5) return { texto: 'Ya he firmado: es mía', accion: 'comprada' };
  return null;
}

export type EstadoTarea = { tarea: Tarea; estado: 'hecha' | 'pendiente' | 'no-aplica'; auto: boolean };

/** Hecha si se deduce de los datos o si la has marcado; "no aplica" solo a mano. */
export function tareas(x: Contexto): EstadoTarea[] {
  return TAREAS.filter((t) => t.aplica?.(x) ?? true).map((t) => {
    const auto = t.hecha?.(x) ?? false;
    const marca = x.d.marcas[t.clave];
    return { tarea: t, auto, estado: auto || marca === 'hecho' ? 'hecha' : marca === 'no-aplica' ? 'no-aplica' : 'pendiente' };
  });
}

// ── Plazos, próximos y avisos ────────────────────────────────────────────────

/** FEIN + 10 días naturales (14 en Cataluña): antes no se puede firmar. */
export const firmaMinima = (fein: string, dias: number): string => addDias(fein, dias);

/** Pagando el impuesto en 28 días naturales se cumple "1 mes" y "30 días hábiles". */
export const DIAS_IMPUESTO = 28;

const impuestoPendiente = (x: Contexto) => x.d.marcas.impuesto !== 'hecho';

export type Proximo = { fecha: string; texto: string; detalle?: string; casaId?: Id; papeles?: boolean };

export function proximos(x: Contexto, grupos: GrupoPapeles[]): Proximo[] {
  const { d, hoy } = x;
  const out: Proximo[] = [];
  for (const c of d.casas) {
    if (c.estado === 'descartada') continue;
    for (const v of c.visitas) if (v.fecha >= hoy) out.push({ fecha: v.fecha, texto: `Visita: ${c.nombre}`, detalle: v.hora || undefined, casaId: c.id });
  }
  const casa = x.compra;
  const k = casa?.compra;
  if (casa && k) {
    const poner = (fecha: string | null, texto: string) => {
      if (fecha && fecha >= hoy) out.push({ fecha, texto, casaId: casa.id });
    };
    if (casa.estado !== 'comprada') {
      poner(k.fechaLimite, 'Fecha límite de las arras');
      if (k.fein && !k.firma) poner(firmaMinima(k.fein, comunidad(d.ajustes.ccaa).diasFein), 'Ya se puede firmar');
      if (k.fechaTasacion) poner(addDias(k.fechaTasacion, 180), 'Caduca la tasación');
      poner(k.acta, 'Acta de transparencia');
      poner(k.firma, 'Firma en la notaría');
    }
    if (k.firma && k.firma <= hoy && impuestoPendiente(x)) poner(addDias(k.firma, DIAS_IMPUESTO), 'Pagar el impuesto (modelo 600)');
  }
  // Documentos que dejan de valer este mes. Las nóminas no: se renuevan solas cada mes.
  for (const g of grupos) {
    for (const i of g.items) {
      if (i.necesita > 1) continue;
      for (const a of i.archivos) {
        const fin = caducaEl(a, i.tipo.vigencia);
        if (fin && fin >= hoy && diasEntre(hoy, fin) <= 30) {
          out.push({ fecha: fin, texto: `Caduca: ${i.tipo.nombre}`, detalle: g.grupo === 'titular' ? g.titulo : undefined, papeles: true });
        }
      }
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export type Aviso = { tono: 'aviso' | 'peligro'; texto: string; ir?: 'compra' | '/papeles' | '/ajustes' };

export function avisos(x: Contexto, grupos: GrupoPapeles[]): Aviso[] {
  const { d, hoy } = x;
  const out: Aviso[] = [];
  if (!d.ajustes.ccaa) out.push({ tono: 'aviso', texto: 'Elige tu comunidad autónoma: sin ella el impuesto es una estimación.', ir: '/ajustes' });

  const casa = x.compra;
  const k = casa?.compra;
  if (casa && k && casa.estado !== 'comprada') {
    const n = numerosCasa(casa, d, hoy);
    const dias = comunidad(d.ajustes.ccaa).diasFein;
    if (k.tasacion && k.tasacion < n.coste.precio) {
      out.push({ tono: 'aviso', ir: 'compra', texto: `La tasación sale ${euros(n.coste.precio - k.tasacion)} por debajo del precio: el banco presta sobre la tasación y esa diferencia sale de tus ahorros.` });
    }
    if (n.falta > 0) out.push({ tono: 'peligro', ir: 'compra', texto: `Te faltan ${eurosRedondos(n.falta)} de ahorros para esta compra.` });
    if (n.esfuerzo !== null && n.esfuerzo * 100_000 > RATIO_ENDEUDAMIENTO) {
      out.push({ tono: 'aviso', texto: `La cuota y tus otras deudas se llevan el ${Math.round(n.esfuerzo * 100)} % de los ingresos: el banco puede poner pegas.` });
    }
    if (k.fein && k.firma && k.firma < firmaMinima(k.fein, dias)) {
      out.push({ tono: 'peligro', ir: 'compra', texto: `No se puede firmar antes del ${fechaCorta(firmaMinima(k.fein, dias), hoy)}: la ley exige ${dias} días naturales desde la FEIN.` });
    }
    if (k.acta && k.firma && k.acta >= k.firma) out.push({ tono: 'peligro', ir: 'compra', texto: 'El acta de transparencia tiene que ser como tarde el día antes de la firma.' });
    if (k.firma && !k.acta && k.firma >= hoy && diasEntre(hoy, k.firma) <= 7) out.push({ tono: 'aviso', ir: 'compra', texto: 'Falta el acta de transparencia: como tarde el día antes de firmar.' });
    if (k.fechaArras && !k.condicion) out.push({ tono: 'aviso', ir: 'compra', texto: 'Tus arras no tienen condición de financiación: si el banco no te da la hipoteca, podrías perder la señal.' });
    if (k.fechaLimite && k.fechaLimite < hoy && !(k.firma && k.firma <= k.fechaLimite)) out.push({ tono: 'peligro', ir: 'compra', texto: 'Ha pasado la fecha límite de las arras para firmar.' });
    if (k.fechaTasacion && k.firma && addDias(k.fechaTasacion, 180) < k.firma) out.push({ tono: 'aviso', ir: 'compra', texto: 'La tasación caduca antes de la firma: vale 6 meses.' });
    if (casa.estado === 'arras' && k.firma && k.firma < hoy) out.push({ tono: 'aviso', ir: 'compra', texto: 'Si ya has firmado, marca la casa como tuya y verás lo que toca después.' });
  }
  if (k?.firma && addDias(k.firma, DIAS_IMPUESTO) < hoy && impuestoPendiente(x)) {
    out.push({ tono: 'peligro', texto: 'Han pasado 4 semanas desde la firma: si ya has pagado el impuesto, márcalo como hecho; si no, revisa el plazo de tu comunidad.' });
  }
  const caducados = grupos.flatMap((g) => g.items).filter((i) => i.estado === 'caducado').length;
  if (caducados) out.push({ tono: 'aviso', ir: '/papeles', texto: caducados === 1 ? 'Tienes un documento caducado.' : `Tienes ${caducados} documentos caducados.` });
  return out;
}
