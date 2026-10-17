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

/** De quién es: de cada titular, o de la casa que estás comprando. */
export type GrupoDoc = 'titular' | 'casa' | 'hipoteca' | 'despues';

export type TipoDoc = {
  clave: string;
  nombre: string;
  grupo: GrupoDoc;
  /** Cuántos hacen falta (las 3 últimas nóminas). */
  cantidad?: number;
  /** Días que vale desde su emisión. */
  vigencia?: number;
  aplica?: (t: Titular) => boolean;
  /** Para autónomos, si pide otra cantidad. */
  cantidadAutonomo?: number;
  ayuda?: string;
};

const asalariado = (t: Titular) => t.contrato !== 'autonomo';
const autonomo = (t: Titular) => t.contrato === 'autonomo';

export const GRUPOS: Record<GrupoDoc, string> = {
  titular: 'Tuyos',
  casa: 'De la casa',
  hipoteca: 'De la hipoteca',
  despues: 'Después de firmar',
};

export const TIPOS_DOC: TipoDoc[] = [
  { clave: 'dni', nombre: 'DNI o NIE', grupo: 'titular', ayuda: 'Por las dos caras y en vigor.' },
  { clave: 'nomina', nombre: 'Nóminas', grupo: 'titular', cantidad: 3, vigencia: 95, aplica: asalariado, ayuda: 'Las 3 últimas (6 si has cambiado de trabajo hace poco).' },
  { clave: 'contrato', nombre: 'Contrato de trabajo', grupo: 'titular', aplica: asalariado },
  { clave: 'vida_laboral', nombre: 'Vida laboral', grupo: 'titular', vigencia: 30, ayuda: 'Se descarga gratis en la Seguridad Social; la quieren de hace menos de un mes.' },
  { clave: 'irpf', nombre: 'Declaración de la renta', grupo: 'titular', cantidad: 1, cantidadAutonomo: 2, ayuda: 'La última (las dos últimas si eres autónomo).' },
  { clave: 'extractos', nombre: 'Extractos del banco', grupo: 'titular', vigencia: 30, ayuda: 'Movimientos de los últimos 3 a 6 meses.' },
  { clave: 'prestamos', nombre: 'Recibos de otros préstamos', grupo: 'titular', aplica: (t) => t.deudas > 0 },
  { clave: 'cirbe', nombre: 'Informe CIRBE', grupo: 'titular', vigencia: 30, ayuda: 'Gratis en el Banco de España: tus deudas tal como las ve el banco.' },
  { clave: 'trimestrales', nombre: 'Modelos 130 y 303', grupo: 'titular', aplica: autonomo, ayuda: 'Los últimos 4 trimestres.' },
  { clave: 'modelo_390', nombre: 'Resumen anual de IVA (390)', grupo: 'titular', aplica: autonomo },
  { clave: 'reta', nombre: 'Recibos de autónomo', grupo: 'titular', aplica: autonomo },

  { clave: 'nota_simple', nombre: 'Nota simple', grupo: 'casa', vigencia: 90, ayuda: 'En registradores.org por unos 9 €. Dueño, cargas y embargos. El banco la quiere reciente.' },
  { clave: 'arras', nombre: 'Contrato de arras', grupo: 'casa' },
  { clave: 'energetico', nombre: 'Certificado energético', grupo: 'casa', vigencia: 3650 },
  { clave: 'ibi', nombre: 'Último recibo del IBI', grupo: 'casa' },
  { clave: 'comunidad', nombre: 'Certificado de deudas de la comunidad', grupo: 'casa', vigencia: 30, ayuda: 'Lo da el administrador en 7 días. Sin él respondes de las deudas de este año y el anterior.' },
  { clave: 'escritura_vendedor', nombre: 'Escritura del vendedor', grupo: 'casa' },
  { clave: 'cedula', nombre: 'Cédula o licencia de ocupación', grupo: 'casa', ayuda: 'Según la comunidad: cédula de habitabilidad o licencia de primera ocupación.' },
  { clave: 'ite', nombre: 'ITE / IEE del edificio', grupo: 'casa' },

  { clave: 'tasacion', nombre: 'Tasación', grupo: 'hipoteca', vigencia: 180, ayuda: 'Vale 6 meses.' },
  { clave: 'fein', nombre: 'FEIN', grupo: 'hipoteca', ayuda: 'Ficha Europea de Información Normalizada: la oferta vinculante del banco.' },
  { clave: 'fiae', nombre: 'FiAE', grupo: 'hipoteca', ayuda: 'Ficha de Advertencias Estandarizadas: cláusulas e índices.' },
  { clave: 'acta', nombre: 'Acta de transparencia', grupo: 'hipoteca' },
  { clave: 'seguros', nombre: 'Pólizas de seguros', grupo: 'hipoteca' },

  { clave: 'escritura', nombre: 'Escritura de compraventa e hipoteca', grupo: 'despues' },
  { clave: 'modelo_600', nombre: 'Pago del impuesto (modelo 600)', grupo: 'despues' },
  { clave: 'facturas', nombre: 'Facturas de notaría, registro y gestoría', grupo: 'despues', ayuda: 'Guárdalas: suman al valor de compra y pagarás menos cuando vendas.' },
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
  { valor: 'oferta', texto: 'Oferta' },
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

export const FASES = ['Prepararte', 'Buscar y visitar', 'Ofertar y reservar', 'Conseguir la hipoteca', 'Firmar', 'Después de firmar'];

const deCompra = (x: Contexto) => x.compra?.compra ?? null;
const vivo = (casa: Casa) => casa.estado !== 'descartada';

export const TAREAS: Tarea[] = [
  // 1 · Prepararte
  { clave: 'titulares', fase: 1, texto: 'Di quién compra y cuánto ingresa', ir: '/hipoteca', hecha: (x) => x.d.titulares.some((t) => t.neto > 0) },
  {
    clave: 'ahorros', fase: 1, texto: 'Apunta tus ahorros', ir: '/hipoteca', hecha: (x) => x.d.ajustes.ahorros > 0,
    ayuda: 'Hace falta en torno al 30 % del precio: 20 % de entrada y un 10–12 % de impuestos y gastos. Deja aparte un colchón para imprevistos.',
  },
  { clave: 'comunidad', fase: 1, texto: 'Elige tu comunidad autónoma', ir: '/ajustes', hecha: (x) => x.d.ajustes.ccaa !== null, ayuda: 'El impuesto de la compra depende de ella.' },
  {
    clave: 'deudas', fase: 1, texto: 'Revisa tus deudas y pide el informe CIRBE',
    ayuda: 'Es gratis en la web del Banco de España y es lo que verá el banco. Cancelar préstamos pequeños mejora lo que te prestan.',
  },
  { clave: 'preaprobacion', fase: 1, texto: 'Pregunta a tu banco cuánto te prestaría', ayuda: 'Opcional, pero te da una idea real antes de buscar.' },

  // 2 · Buscar y visitar
  { clave: 'apuntar', fase: 2, texto: 'Apunta las casas que te interesen', ir: '/casas', hecha: (x) => x.d.casas.length > 0 },
  {
    clave: 'visitar', fase: 2, texto: 'Visita con la lista de comprobación', ir: '/casas',
    hecha: (x) => x.d.casas.some((c) => c.visitas.some((v) => v.fecha <= x.hoy)),
  },
  {
    clave: 'finalistas', fase: 2, texto: 'Elige finalistas y compáralas', ir: '/casas',
    hecha: (x) => x.d.casas.some((c) => vivo(c) && c.estado !== 'interesa'),
    ayuda: 'Ordena la lista por coste total o por cuota: el precio solo no cuenta toda la historia.',
  },
  {
    clave: 'nota_previa', fase: 2, texto: 'Pide la nota simple de la que te guste', ir: '/papeles',
    hecha: (x) => x.d.archivos.some((a) => a.tipo === 'nota_simple'),
    ayuda: 'En registradores.org por unos 9 €: quién es el dueño y si tiene hipoteca, cargas o embargos. Antes de ofertar.',
  },

  // 3 · Ofertar y reservar
  { clave: 'ofertar', fase: 3, texto: 'Haz tu oferta y negocia', ir: 'compra', hecha: (x) => !!x.compra && (x.compra.negociacion.length > 0 || x.compra.estado !== 'oferta') },
  { clave: 'cargas', fase: 3, texto: 'Comprueba en la nota simple el dueño, las cargas y los embargos' },
  { clave: 'deuda_comunidad', fase: 3, texto: 'Pide el certificado de deudas de la comunidad y pregunta por derramas', ir: '/papeles', hecha: (x) => x.tiene('comunidad') },
  { clave: 'ibi', fase: 3, texto: 'Comprueba que el IBI está pagado', ir: '/papeles', hecha: (x) => x.tiene('ibi') },
  { clave: 'energetico', fase: 3, texto: 'Pide el certificado energético', ir: '/papeles', hecha: (x) => x.tiene('energetico') },
  { clave: 'ite', fase: 3, texto: 'Revisa la ITE del edificio y las obras previstas' },
  { clave: 'cedula', fase: 3, texto: 'Cédula de habitabilidad o licencia de ocupación', ayuda: 'Depende de la comunidad. Sin ella puede haber problemas para dar de alta los suministros.' },
  { clave: 'ocupacion', fase: 3, texto: 'Confirma que se entrega vacía', ayuda: 'Sin inquilinos ni ocupantes. Que conste en las arras.' },
  { clave: 'superficie', fase: 3, texto: 'Compara los m² del Catastro con los de la nota simple' },
  { clave: 'vpo', fase: 3, texto: 'Si es de protección oficial, revisa sus límites', ayuda: 'Precio máximo, requisitos del comprador y permisos para venderla.' },
  { clave: 'quien_paga', fase: 3, texto: 'Deja claro quién paga la agencia y la plusvalía', ayuda: 'La plusvalía municipal es del vendedor. La comisión de la agencia, normalmente también.' },
  {
    clave: 'arras', fase: 3, texto: 'Firma las arras', ir: 'compra', hecha: (x) => !!deCompra(x)?.fechaArras,
    ayuda: 'Que digan "penitenciales" (art. 1454 del Código Civil): si te echas atrás pierdes la señal y si se echa atrás el vendedor te devuelve el doble. Si no lo dicen, se entienden confirmatorias. Pide que te devuelvan el dinero si el banco no te da la hipoteca.',
  },
  { clave: 'aval_obra', fase: 3, texto: 'Exige aval o seguro de lo que adelantes', aplica: (x) => !!x.compra?.nueva, ayuda: 'En obra nueva, el promotor debe garantizar las cantidades a cuenta (Ley 38/1999).' },
  { clave: 'decenal', fase: 3, texto: 'Pide el seguro decenal y la licencia de primera ocupación', aplica: (x) => !!x.compra?.nueva },

  // 4 · Conseguir la hipoteca
  { clave: 'papeles', fase: 4, texto: 'Reúne tus papeles', ir: '/papeles', hecha: (x) => x.papelesTitulares },
  { clave: 'ofertas', fase: 4, texto: 'Pide ofertas a 3 bancos o más', ir: '/hipoteca', hecha: (x) => x.d.hipotecas.filter((h) => !h.descartada).length >= 3, ayuda: 'O a un bróker. Cada uno te pedirá los mismos papeles.' },
  { clave: 'comparar', fase: 4, texto: 'Compara el coste total, no solo el TIN', ir: '/hipoteca', ayuda: 'Las bonificaciones bajan el tipo pero cuestan dinero cada año. La app te dice si cada una compensa.' },
  {
    clave: 'tasacion', fase: 4, texto: 'Tasación', ir: 'compra', hecha: (x) => (deCompra(x)?.tasacion ?? 0) > 0,
    ayuda: 'La pagas tú (250–500 €) y vale 6 meses. El banco presta sobre el MENOR entre precio y tasación: si sale baja, la diferencia sale de tus ahorros.',
  },
  {
    clave: 'fein', fase: 4, texto: 'Recibe la FEIN y la FiAE', ir: 'compra', hecha: (x) => !!deCompra(x)?.fein,
    ayuda: 'Es la oferta vinculante. Desde que te la dan tienen que pasar al menos 10 días naturales (14 en Cataluña) hasta la firma.',
  },
  { clave: 'elegir', fase: 4, texto: 'Elige banco', ir: 'compra', hecha: (x) => !!deCompra(x)?.hipotecaId },
  {
    clave: 'acta', fase: 4, texto: 'Acta de transparencia en el notario', ir: 'compra',
    hecha: (x) => { const a = deCompra(x)?.acta; return !!a && a <= x.hoy; },
    ayuda: 'Gratis. Vas en persona, como tarde el día antes de firmar: el notario te explica la hipoteca y te hace un pequeño test.',
  },

  // 5 · Firmar
  { clave: 'fecha_firma', fase: 5, texto: 'Fija la fecha de firma', ir: 'compra', hecha: (x) => !!deCompra(x)?.firma, ayuda: 'Con el vendedor, el banco y la notaría. El notario lo eliges tú.' },
  { clave: 'pago', fase: 5, texto: 'Prepara el pago al vendedor', ayuda: 'Precio menos arras, por transferencia o cheque bancario. Si el vendedor no es residente, se retiene el 3 % para Hacienda.' },
  { clave: 'cancelacion', fase: 5, texto: 'Que el vendedor cancele su hipoteca en la firma' },
  { clave: 'prorrateo', fase: 5, texto: 'Pacta el reparto del IBI y la comunidad del año' },
  { clave: 'borrador', fase: 5, texto: 'Revisa el borrador de la escritura' },
  { clave: 'dia_firma', fase: 5, texto: 'El día: DNI, lectura de contadores y llaves' },

  // 6 · Después de firmar
  {
    clave: 'impuesto', fase: 6, texto: 'Paga el impuesto (modelo 600)', ir: '/papeles', hecha: (x) => x.tiene('modelo_600'),
    ayuda: 'El plazo es de 1 mes o 30 días hábiles según la comunidad: pagándolo en 4 semanas cumples en todas. Lo suele hacer la gestoría.',
  },
  { clave: 'registro', fase: 6, texto: 'Inscripción en el Registro y escritura', ir: '/papeles', hecha: (x) => x.tiene('escritura') },
  { clave: 'suministros', fase: 6, texto: 'Pon a tu nombre luz, agua, gas e internet' },
  { clave: 'empadronarte', fase: 6, texto: 'Empadrónate' },
  { clave: 'seguro_hogar', fase: 6, texto: 'Seguro de hogar', ayuda: 'Si no lo tienes ya por la hipoteca. El banco tiene que aceptar uno equivalente de otra aseguradora.' },
  { clave: 'comunidad_ibi', fase: 6, texto: 'Avisa a la comunidad y domicilia el IBI' },
  { clave: 'facturas', fase: 6, texto: 'Guarda la escritura y las facturas', ir: '/papeles', hecha: (x) => x.tiene('facturas'), ayuda: 'Los gastos de compra suman al valor de adquisición: pagarás menos impuestos cuando vendas.' },
];
