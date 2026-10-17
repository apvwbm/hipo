// Contenido fijo de la app: comunidades e impuestos, documentos, la lista de
// comprobación de las visitas y las fases con sus tareas. Solo datos (y alguna función
// pequeña que lee el contexto); la lógica está en `motor.ts`.
//
// DATOS DE REFERENCIA a octubre de 2026. Fuente principal: Ministerio de Hacienda,
// "Tributación Autonómica. Medidas 2026" (23-09-2026). Todo es editable en la app: un
// tipo reducido (jóvenes, familia numerosa…) se pone en Ajustes. Si cambia la ley, se
// cambia aquí y punto.

import type { Casa, Contrato, Datos, Titular } from '@/types';

// ── Bancos ───────────────────────────────────────────────────────────────────

/**
 * Ratio de endeudamiento: los bancos no suelen dejar que todas las cuotas (hipoteca y
 * otros préstamos) pasen del 35 % de los ingresos netos. Algunos llegan al 40 % con
 * sueldos altos; no es un ajuste porque casi nadie lo cambiaría.
 */
export const RATIO_ENDEUDAMIENTO = 35_000;

/**
 * Edad a la que el banco quiere la hipoteca pagada (la del mayor de los titulares).
 * Solo acorta el plazo a partir de unos 45 años; por eso tampoco es un ajuste.
 */
export const EDAD_LIMITE = 75;

// ── Comunidades ──────────────────────────────────────────────────────────────

/** [hasta (céntimos), tipo (milésimas)]: escala MARGINAL, cada tramo paga lo suyo. */
export type Tramo = [number, number];

export type Comunidad = {
  clave: string;
  nombre: string;
  /** ITP de vivienda usada, tipo general. */
  itp: Tramo[];
  /** AJD de la compra de obra nueva. */
  ajd: number;
  /** IVA de obra nueva; en Canarias es IGIC y en Ceuta y Melilla, IPSI. */
  iva: number;
  nombreIva: string;
  /** El tipo de obra nueva no está confirmado: se pide revisarlo. */
  ivaDudoso?: boolean;
  /** Días naturales mínimos entre la FEIN y la firma. */
  diasFein: number;
};

const K = 100_000; // 1.000 € en céntimos
const SIEMPRE = Number.MAX_SAFE_INTEGER;
const plano = (tipo: number): Tramo[] => [[SIEMPRE, tipo]];

const c = (clave: string, nombre: string, itp: Tramo[], ajd: number, extra: Partial<Comunidad> = {}): Comunidad => ({
  clave,
  nombre,
  itp,
  ajd,
  iva: 10_000,
  nombreIva: 'IVA',
  diasFein: 10,
  ...extra,
});

// ponytail: Baleares cobra 2 % de AJD por encima de 1 M € y la Comunidad Valenciana
// 11 % de ITP sobre TODO el valor por encima de 1 M €; no se modela.
export const COMUNIDADES: Comunidad[] = [
  c('andalucia', 'Andalucía', plano(7_000), 1_200),
  c('aragon', 'Aragón', [[400 * K, 8_000], [450 * K, 8_500], [500 * K, 9_000], [750 * K, 9_500], [SIEMPRE, 10_000]], 1_500),
  c('asturias', 'Asturias', [[300 * K, 8_000], [500 * K, 9_000], [SIEMPRE, 10_000]], 1_200),
  c('baleares', 'Baleares', [[400 * K, 8_000], [600 * K, 9_000], [1000 * K, 10_000], [2000 * K, 12_000], [SIEMPRE, 13_000]], 1_500),
  c('canarias', 'Canarias', plano(6_500), 750, { iva: 7_000, nombreIva: 'IGIC', ivaDudoso: true }),
  c('cantabria', 'Cantabria', plano(9_000), 1_500),
  c('castilla_la_mancha', 'Castilla-La Mancha', plano(9_000), 1_500),
  c('castilla_y_leon', 'Castilla y León', [[250 * K, 8_000], [SIEMPRE, 10_000]], 1_500),
  c('cataluna', 'Cataluña', [[600 * K, 10_000], [900 * K, 11_000], [1500 * K, 12_000], [SIEMPRE, 13_000]], 1_500, { diasFein: 14 }),
  c('valencia', 'Comunidad Valenciana', plano(9_000), 1_400),
  c('extremadura', 'Extremadura', [[360 * K, 8_000], [600 * K, 10_000], [SIEMPRE, 11_000]], 1_500),
  c('galicia', 'Galicia', plano(8_000), 1_500),
  c('madrid', 'Madrid', plano(6_000), 750),
  c('murcia', 'Murcia', plano(7_750), 1_500),
  c('rioja', 'La Rioja', plano(7_000), 1_000),
  c('navarra', 'Navarra', plano(6_000), 500),
  c('alava', 'Álava', plano(4_000), 500),
  c('bizkaia', 'Bizkaia', plano(4_000), 500),
  c('gipuzkoa', 'Gipuzkoa', plano(4_000), 500),
  c('ceuta', 'Ceuta', plano(3_000), 250, { iva: 4_000, nombreIva: 'IPSI', ivaDudoso: true }),
  c('melilla', 'Melilla', plano(3_000), 250, { iva: 4_000, nombreIva: 'IPSI', ivaDudoso: true }),
];

/** Sin comunidad elegida: una estimación media, con aviso. */
export const COMUNIDAD_ESTIMADA = c('', 'Sin elegir', plano(8_000), 1_500);

export const comunidad = (clave: string | null): Comunidad =>
  COMUNIDADES.find((x) => x.clave === clave) ?? COMUNIDAD_ESTIMADA;

// ── Documentos ───────────────────────────────────────────────────────────────
// Solo lo que de verdad hace falta, en el orden en que llega: primero lo que ya tienes
// (fase 1), luego lo de la casa elegida (fase 3) y la tasación con la hipoteca (fase 4).
// Papeles solo enseña los de la fase en que estás o anteriores.

/** De quién es: de cada titular, o de la casa que estás comprando. */
export type GrupoDoc = 'titular' | 'casa';

export type TipoDoc = {
  clave: string;
  nombre: string;
  grupo: GrupoDoc;
  /** Fase en la que aparece. */
  fase: number;
  /** Cuántos hacen falta (las 3 últimas nóminas). */
  cantidad?: number;
  /** Días que vale desde su emisión. */
  vigencia?: number;
  aplica?: (t: Titular) => boolean;
  ayuda?: string;
};

const asalariado = (t: Titular) => t.contrato !== 'autonomo';

export const TIPOS_DOC: TipoDoc[] = [
  { clave: 'contrato', nombre: 'Contrato de trabajo', grupo: 'titular', fase: 1, aplica: asalariado },
  { clave: 'nomina', nombre: 'Nóminas', grupo: 'titular', fase: 1, cantidad: 3, vigencia: 95, aplica: asalariado, ayuda: 'Las 3 últimas.' },
  { clave: 'irpf', nombre: 'Última declaración de la renta', grupo: 'titular', fase: 1, ayuda: 'La descargas en la web de la Agencia Tributaria.' },
  { clave: 'vida_laboral', nombre: 'Vida laboral', grupo: 'titular', fase: 1, vigencia: 30, ayuda: 'Gratis en la web de la Seguridad Social. La quieren de hace menos de un mes: descárgala de nuevo cuando vayas al banco.' },

  { clave: 'nota_simple', nombre: 'Nota simple', grupo: 'casa', fase: 3, vigencia: 90, ayuda: 'En registradores.org por unos 9 €: quién es el dueño y si tiene hipoteca, cargas o embargos. Pídela antes de firmar las arras.' },
  { clave: 'catastro', nombre: 'Catastro', grupo: 'casa', fase: 3, ayuda: 'Consulta gratis en la Sede del Catastro: metros, año y valor de referencia. Compara los metros con los de la nota simple.' },
  { clave: 'energetico', nombre: 'Certificado energético', grupo: 'casa', fase: 3, vigencia: 3650, ayuda: 'Te lo tiene que dar el vendedor.' },
  { clave: 'arras', nombre: 'Contrato de arras', grupo: 'casa', fase: 3 },
  { clave: 'tasacion', nombre: 'Tasación', grupo: 'casa', fase: 4, vigencia: 180, ayuda: 'La encarga el banco y la pagas tú. Vale 6 meses.' },
];

export const tipoDoc = (clave: string): TipoDoc | undefined => TIPOS_DOC.find((t) => t.clave === clave);

export const nombreTipo = (clave: string): string =>
  clave === 'foto' ? 'Foto' : clave === 'otro' ? 'Documento' : (tipoDoc(clave)?.nombre ?? clave);

export const CONTRATOS: { valor: Contrato; texto: string }[] = [
  { valor: 'indefinido', texto: 'Indefinido' },
  { valor: 'temporal', texto: 'Temporal' },
  { valor: 'funcionario', texto: 'Funcionario' },
  { valor: 'autonomo', texto: 'Autónomo' },
];

// ── Casas ────────────────────────────────────────────────────────────────────

export const ESTADOS: { valor: Casa['estado']; texto: string }[] = [
  { valor: 'interesa', texto: 'Me interesa' },
  { valor: 'finalista', texto: 'Finalista' },
  { valor: 'oferta', texto: 'Elegida' },
  { valor: 'arras', texto: 'Arras' },
  { valor: 'comprada', texto: 'Comprada' },
  { valor: 'descartada', texto: 'Descartada' },
];

export const CARACTERISTICAS = [
  'Ascensor', 'Garaje', 'Trastero', 'Terraza', 'Exterior', 'Calefacción', 'Aire acondicionado',
  'Piscina', 'Jardín', 'Amueblado', 'Para reformar',
];

export const ENERGIAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Lo que mirar y preguntar en la visita. La respuesta es de la casa, no de cada visita. */
export const REVISIONES: { clave: string; texto: string; grupo: 'mirar' | 'preguntar' }[] = [
  { clave: 'luz', texto: 'Luz natural y orientación', grupo: 'mirar' },
  { clave: 'ruido', texto: 'Ruido: calle, vecinos, bajantes', grupo: 'mirar' },
  { clave: 'humedad', texto: 'Humedades, grietas, manchas en techos', grupo: 'mirar' },
  { clave: 'ventanas', texto: 'Ventanas y aislamiento', grupo: 'mirar' },
  { clave: 'calefaccion', texto: 'Calefacción y agua caliente', grupo: 'mirar' },
  { clave: 'agua', texto: 'Presión del agua (grifo y ducha a la vez)', grupo: 'mirar' },
  { clave: 'electricidad', texto: 'Cuadro eléctrico y enchufes', grupo: 'mirar' },
  { clave: 'cocina', texto: 'Cocina y baños', grupo: 'mirar' },
  { clave: 'accesos', texto: 'Ascensor y accesibilidad', grupo: 'mirar' },
  { clave: 'edificio', texto: 'Portal, fachada, tejado y zonas comunes', grupo: 'mirar' },
  { clave: 'cobertura', texto: 'Cobertura del móvil', grupo: 'mirar' },
  { clave: 'entorno', texto: 'Barrio: transporte, tiendas, colegios, aparcar', grupo: 'mirar' },
  { clave: 'motivo', texto: '¿Por qué vende y desde cuándo está a la venta?', grupo: 'preguntar' },
  { clave: 'derramas', texto: '¿Hay derramas aprobadas o previstas?', grupo: 'preguntar' },
  { clave: 'ite', texto: '¿ITE pasada? ¿Obras pendientes en el edificio?', grupo: 'preguntar' },
  { clave: 'gastos', texto: 'Comunidad al mes e IBI al año', grupo: 'preguntar' },
  { clave: 'cargas', texto: '¿Tiene hipoteca u otras cargas?', grupo: 'preguntar' },
  { clave: 'ocupacion', texto: '¿Está vacía o alquilada?', grupo: 'preguntar' },
  { clave: 'incluye', texto: '¿Qué se queda: muebles, electrodomésticos?', grupo: 'preguntar' },
  { clave: 'entrega', texto: '¿Cuándo se podría entregar?', grupo: 'preguntar' },
];

// ── Fases y tareas ───────────────────────────────────────────────────────────

/** Lo que una tarea puede mirar para saber si está hecha o si aplica. */
export type Contexto = {
  d: Datos;
  /** La casa que estás comprando (oferta, arras o comprada). */
  compra: Casa | null;
  hoy: string;
  /** Hay un documento de ese tipo (de la casa en compra si es de la casa). */
  tiene: (tipo: string) => boolean;
  /** Todos los papeles de los titulares están al día. */
  papelesTitulares: boolean;
};

export type Tarea = {
  clave: string;
  fase: number;
  texto: string;
  ayuda?: string;
  /** Pantalla a la que lleva. */
  ir?: '/hipoteca' | '/casas' | '/papeles' | '/ajustes' | 'compra';
  hecha?: (x: Contexto) => boolean;
  aplica?: (x: Contexto) => boolean;
};

export const FASES = ['Prepárate', 'Busca casa', 'Resérvala', 'Consigue la hipoteca', 'Firma', 'Ya es tuya'];

const deCompra = (x: Contexto) => x.compra?.compra ?? null;
const vivo = (casa: Casa) => casa.estado !== 'descartada';

export const TAREAS: Tarea[] = [
  // 1 · Prepárate
  { clave: 'titulares', fase: 1, texto: 'Di quién compra y cuánto gana', ir: '/hipoteca', hecha: (x) => x.d.titulares.some((t) => t.neto > 0) },
  {
    clave: 'ahorros', fase: 1, texto: 'Apunta tus ahorros', ir: '/hipoteca', hecha: (x) => x.d.ajustes.ahorros > 0,
    ayuda: 'Hace falta en torno al 30 % del precio: 20 % de entrada y un 10–12 % de impuestos y gastos. Deja aparte un colchón para imprevistos.',
  },
  { clave: 'comunidad', fase: 1, texto: 'Elige tu comunidad autónoma', ir: '/ajustes', hecha: (x) => x.d.ajustes.ccaa !== null, ayuda: 'El impuesto de la compra depende de ella.' },
  {
    clave: 'papeles', fase: 1, texto: 'Reúne tus papeles', ir: '/papeles', hecha: (x) => x.papelesTitulares,
    ayuda: 'Contrato, nóminas, renta y vida laboral. El banco te los pedirá; así los tienes a mano.',
  },
  {
    clave: 'deudas', fase: 1, texto: 'Revisa tus deudas en la CIRBE (opcional)',
    ayuda: 'La CIRBE es el registro del Banco de España con los préstamos y avales a tu nombre. El banco la mira él mismo; pedirla tú (gratis, en la web del Banco de España con Cl@ve o certificado) sirve para ver lo mismo que él y cazar errores o deudas olvidadas antes. Cancelar préstamos pequeños mejora lo que te prestan.',
  },

  // 2 · Busca casa
  { clave: 'apuntar', fase: 2, texto: 'Apunta las casas que te interesen', ir: '/casas', hecha: (x) => x.d.casas.length > 0 },
  {
    clave: 'visitar', fase: 2, texto: 'Visítalas con la lista de comprobación', ir: '/casas',
    hecha: (x) => x.d.casas.some((c) => c.visitas.some((v) => v.fecha <= x.hoy)),
  },
  {
    clave: 'finalistas', fase: 2, texto: 'Quédate con tus finalistas', ir: '/casas',
    hecha: (x) => x.d.casas.some((c) => vivo(c) && c.estado !== 'interesa'),
    ayuda: 'Ordena la lista por coste total o por cuota: el precio solo no cuenta toda la historia.',
  },
  {
    clave: 'elegir_casa', fase: 2, texto: 'Elige tu casa', hecha: (x) => !!x.compra,
    ayuda: 'Cuando tengas la buena, márcala como elegida: aparecerán los pasos y los papeles para reservarla.',
  },

  // 3 · Resérvala
  { clave: 'ofertar', fase: 3, texto: 'Haz tu oferta y negocia', ir: 'compra', hecha: (x) => !!x.compra && (x.compra.negociacion.length > 0 || x.compra.estado !== 'oferta') },
  {
    clave: 'nota_simple', fase: 3, texto: 'Pide la nota simple', ir: '/papeles', hecha: (x) => x.tiene('nota_simple'),
    ayuda: 'Comprueba que el vendedor es el dueño y que no hay hipotecas, cargas ni embargos sin cancelar.',
  },
  {
    clave: 'catastro', fase: 3, texto: 'Consulta el Catastro', ir: '/papeles', hecha: (x) => x.tiene('catastro'),
    ayuda: 'Apunta el valor de referencia en la ficha de la casa: si es mayor que el precio, el impuesto se paga sobre él.',
  },
  { clave: 'energetico', fase: 3, texto: 'Pide el certificado energético', ir: '/papeles', hecha: (x) => x.tiene('energetico') },
  {
    clave: 'deudas_casa', fase: 3, texto: 'Pregunta por deudas de comunidad, IBI y derramas',
    ayuda: 'Pide al vendedor el certificado de deudas de la comunidad y el último recibo del IBI. Si hay derramas aprobadas, que las pague él.',
  },
  { clave: 'quien_paga', fase: 3, texto: 'Deja claro quién paga la agencia y la plusvalía', ayuda: 'La plusvalía municipal es del vendedor. La comisión de la agencia, normalmente también.' },
  { clave: 'aval_obra', fase: 3, texto: 'Exige aval o seguro de lo que adelantes', aplica: (x) => !!x.compra?.nueva, ayuda: 'En obra nueva, el promotor debe garantizar las cantidades a cuenta (Ley 38/1999).' },
  { clave: 'decenal', fase: 3, texto: 'Pide el seguro decenal y la licencia de primera ocupación', aplica: (x) => !!x.compra?.nueva },
  {
    clave: 'arras', fase: 3, texto: 'Firma las arras', ir: 'compra', hecha: (x) => !!deCompra(x)?.fechaArras || (!!x.compra && x.compra.estado !== 'oferta'),
    ayuda: 'Que digan "penitenciales" (art. 1454 del Código Civil): si te echas atrás pierdes la señal y si se echa atrás el vendedor te devuelve el doble. Pide que te la devuelvan si el banco no te da la hipoteca, y que conste que se entrega vacía.',
  },

  // 4 · Consigue la hipoteca
  {
    clave: 'ofertas', fase: 4, texto: 'Pide ofertas a 3 bancos o más', ir: '/hipoteca', hecha: (x) => x.d.hipotecas.filter((h) => !h.descartada).length >= 3,
    ayuda: 'O a un bróker. Compara el coste total, no solo el tipo: la app te dice si cada producto que te piden compensa.',
  },
  {
    clave: 'tasacion', fase: 4, texto: 'Tasación', ir: 'compra', hecha: (x) => (deCompra(x)?.tasacion ?? 0) > 0 || x.tiene('tasacion'),
    ayuda: 'La pagas tú (250–500 €) y vale 6 meses. El banco presta sobre el MENOR entre precio y tasación: si sale baja, la diferencia sale de tus ahorros.',
  },
  {
    clave: 'fein', fase: 4, texto: 'Recibe la FEIN', ir: 'compra', hecha: (x) => !!deCompra(x)?.fein,
    ayuda: 'Es la oferta vinculante del banco. Desde que te la dan tienen que pasar al menos 10 días naturales (14 en Cataluña) hasta la firma.',
  },
  { clave: 'elegir', fase: 4, texto: 'Elige banco', ir: 'compra', hecha: (x) => !!deCompra(x)?.hipotecaId },

  // 5 · Firma
  {
    clave: 'acta', fase: 5, texto: 'Acta de transparencia en el notario', ir: 'compra',
    hecha: (x) => { const a = deCompra(x)?.acta; return !!a && a <= x.hoy; },
    ayuda: 'Gratis. Vas en persona, como tarde el día antes de firmar: el notario te explica la hipoteca y te hace un pequeño test.',
  },
  { clave: 'fecha_firma', fase: 5, texto: 'Fija la fecha de firma', ir: 'compra', hecha: (x) => !!deCompra(x)?.firma, ayuda: 'Con el vendedor, el banco y la notaría. El notario lo eliges tú.' },
  { clave: 'pago', fase: 5, texto: 'Prepara el pago al vendedor', ayuda: 'Precio menos arras, por transferencia o cheque bancario. Si el vendedor no es residente, se retiene el 3 % para Hacienda.' },
  { clave: 'borrador', fase: 5, texto: 'Revisa el borrador de la escritura', ayuda: 'Que el vendedor cancele su hipoteca en la firma y que esté claro cómo se reparten el IBI y la comunidad del año.' },
  { clave: 'dia_firma', fase: 5, texto: 'El día: DNI, lectura de contadores y llaves' },

  // 6 · Ya es tuya
  {
    clave: 'impuesto', fase: 6, texto: 'Paga el impuesto (modelo 600)',
    ayuda: 'El plazo es de 1 mes o 30 días hábiles según la comunidad: pagándolo en 4 semanas cumples en todas. Lo suele hacer la gestoría.',
  },
  { clave: 'suministros', fase: 6, texto: 'Pon a tu nombre luz, agua, gas e internet, y empadrónate' },
  { clave: 'seguro_hogar', fase: 6, texto: 'Seguro de hogar', ayuda: 'Si no lo tienes ya por la hipoteca. El banco tiene que aceptar uno equivalente de otra aseguradora.' },
  { clave: 'facturas', fase: 6, texto: 'Guarda la escritura y las facturas', ayuda: 'Los gastos de compra suman al valor de adquisición: pagarás menos impuestos cuando vendas.' },
];
