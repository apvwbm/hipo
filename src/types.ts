// Tipos del dominio.
//
// Importes: ENTEROS en céntimos, siempre >= 0; 0 también significa "sin dato" (m², IBI…).
// Porcentajes: ENTEROS en milésimas de punto (2,85 % → 2850).
// Fechas: 'YYYY-MM-DD' en hora local (ver `lib/fechas.ts`).

export type Id = string;

export type Contrato = 'indefinido' | 'temporal' | 'funcionario' | 'autonomo';

export type Titular = {
  id: Id;
  nombre: string;
  /** Neto de cada paga. */
  neto: number;
  pagas: 12 | 14;
  /** Cuotas de otros préstamos, al mes. */
  deudas: number;
  /** Año de nacimiento, para el plazo máximo. */
  nacimiento: number | null;
  contrato: Contrato;
};

export type EstadoCasa = 'interesa' | 'finalista' | 'oferta' | 'arras' | 'comprada' | 'descartada';

export type Visita = { fecha: string; hora: string };
export type Puja = { fecha: string; importe: number; de: 'yo' | 'vendedor'; nota: string };
export type Revision = 'bien' | 'mal';
export type TipoArras = 'penitenciales' | 'confirmatorias' | 'penales';

/** Lo que pasa desde la oferta hasta la firma. Vive dentro de la casa. */
export type Compra = {
  /** Precio acordado. */
  precio: number;
  /** Reserva o señal a la agencia antes de las arras. */
  senal: number;
  arras: number;
  tipoArras: TipoArras;
  /** Cláusula: si el banco no da la hipoteca, se devuelven las arras. */
  condicion: boolean;
  fechaArras: string | null;
  /** Fecha límite para escriturar que fijan las arras. */
  fechaLimite: string | null;
  /** Valor de tasación; 0 = sin tasar. */
  tasacion: number;
  fechaTasacion: string | null;
  /** Entrega de la FEIN/FiAE. */
  fein: string | null;
  hipotecaId: Id | null;
  acta: string | null;
  firma: string | null;
  notaria: string;
  /** Lo pagado de verdad por concepto; sustituye a la estimación. */
  reales: Record<string, number>;
};

export type Casa = {
  id: Id;
  nombre: string;
  zona: string;
  estado: EstadoCasa;
  precio: number;
  /** Valor de referencia del Catastro: si es mayor que el precio, el ITP va sobre él. */
  valorReferencia: number;
  /** Obra nueva (IVA + AJD) o segunda mano (ITP). */
  nueva: boolean;
  m2: number;
  habitaciones: number;
  banos: number;
  planta: string;
  anio: number;
  /** Letra del certificado energético, '' si no se sabe. */
  energia: string;
  /** Comunidad al mes. */
  comunidad: number;
  /** IBI al año. */
  ibi: number;
  reforma: number;
  enlace: string;
  contacto: string;
  telefono: string;
  nota: string;
  /** 1–5; 0 = sin puntuar. */
  puntos: number;
  creada: string;
  caracteristicas: string[];
  checks: Record<string, Revision>;
  visitas: Visita[];
  negociacion: Puja[];
  compra: Compra | null;
};

export type TipoHipoteca = 'fija' | 'variable' | 'mixta';

/** `rebaja` en milésimas de punto; `coste` al año. Inactiva = no la contratas. */
export type Bonificacion = { nombre: string; rebaja: number; coste: number; activa: boolean };

export type Hipoteca = {
  id: Id;
  banco: string;
  casaId: Id | null;
  importe: number;
  anios: number;
  tipo: TipoHipoteca;
  /** TIN con TODAS las bonificaciones. En variable y mixta, el del tramo inicial. */
  tin: number;
  /** Años del tramo inicial (variable y mixta). */
  aniosFijos: number;
  /** Diferencial sobre el Euríbor, con todas las bonificaciones. */
  diferencial: number;
  bonificaciones: Bonificacion[];
  /** TAE de la FEIN, informativa; 0 = sin dato. */
  tae: number;
  contacto: string;
  telefono: string;
  nota: string;
  descartada: boolean;
};

/**
 * Un archivo del móvil ENLAZADO (no copiado): documentos y fotos. Borrar la fila nunca
 * toca el archivo.
 */
export type Archivo = {
  id: Id;
  /** Clave de `TIPOS_DOC`, 'foto' u 'otro'. */
  tipo: string;
  personaId: Id | null;
  casaId: Id | null;
  uri: string;
  mime: string;
  emision: string | null;
  nota: string;
  creado: string;
};

export type Marca = 'hecho' | 'no-aplica';

export type Ajustes = {
  ccaa: string | null;
  /** Tipo propio (reducido) que sustituye al ITP o al IVA de la tabla. */
  impuestoPropio: number | null;
  /** Notaría + registro + gestoría de la compraventa, sobre el precio. */
  gastosPct: number;
  tasacion: number;
  euribor: number;
  /** Máximo que presta el banco sobre el menor de precio y tasación. */
  financiacion: number;
  plazo: number;
  tinSupuesto: number;
  ahorros: number;
  bloqueo: boolean;
  ultimaCopia: string | null;
};

/** Todos los datos guardados. Lo calculado se deriva de aquí cada vez. */
export type Datos = {
  casas: Casa[];
  hipotecas: Hipoteca[];
  archivos: Archivo[];
  titulares: Titular[];
  marcas: Record<string, Marca>;
  ajustes: Ajustes;
};
