// Verificación de la lógica pura: `npm run verifica`.
//
// Asserts a mano, agrupados por bloques, sin framework: todo lo que se verifica son
// funciones puras y el script entero tarda un segundo. Las migraciones se prueban con
// el `node:sqlite` de Node. Lo que NO se puede probar aquí es nativo y va en el móvil:
// SQLCipher, los archivos enlazados (SAF) y abrirlos con el visor.

import { DatabaseSync } from 'node:sqlite';

import { comunidad, COMUNIDADES, TAREAS, TIPOS_DOC } from '../src/lib/catalogo';
import { aTextoPct, euros, parseImporte, parsePct, pct } from '../src/lib/dinero';
import { AJUSTES_DEFECTO, COMPRA_DEFECTO, migrar, TABLAS, TITULAR_DEFECTO, VERSION_ESQUEMA } from '../src/lib/esquema';
import { addDias, fechaCorta, relativa } from '../src/lib/fechas';
import {
  amortizar,
  avisos,
  capacidad,
  capitalMax,
  casaEnCompra,
  contexto,
  costeCompra,
  cuota,
  faseActual,
  financiable,
  impuestos,
  marginal,
  numerosCasa,
  ordenarHipotecas,
  papeles,
  plazoMax,
  proximos,
  resumenHipoteca,
  siguientePaso,
  tareas,
  tramos,
} from '../src/lib/motor';
import type { Ajustes, Archivo, Casa, Compra, Datos, Hipoteca, Titular } from '../src/types';

let fallos = 0;
let total = 0;
const igual = (nombre: string, real: unknown, esperado: unknown) => {
  total++;
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a !== b) {
    fallos++;
    console.log(`  ✗ ${nombre}\n      esperado ${b}\n      real     ${a}`);
  }
};
const ok = (nombre: string, cond: boolean) => igual(nombre, cond, true);
const cerca = (nombre: string, real: number, esperado: number, margen: number) =>
  ok(`${nombre} (${real} ≈ ${esperado})`, Math.abs(real - esperado) <= margen);
const bloque = (nombre: string) => console.log(`── ${nombre} ──`);

// ── Fábricas ─────────────────────────────────────────────────────────────────

const E = 100; // 1 € en céntimos
const HOY = '2026-10-17';
const aj = (p: Partial<Ajustes> = {}): Ajustes => ({ ...AJUSTES_DEFECTO, ccaa: 'madrid', ...p });
const titular = (p: Partial<Titular> = {}): Titular => ({ ...TITULAR_DEFECTO, id: 't1', nombre: 'Ana', ...p });
const casa = (p: Partial<Casa> = {}): Casa => ({
  id: 'c1',
  nombre: 'Piso',
  zona: '',
  estado: 'interesa',
  precio: 200_000 * E,
  valorReferencia: 0,
  nueva: false,
  m2: 0,
  habitaciones: 0,
  banos: 0,
  planta: '',
  anio: 0,
  energia: '',
  comunidad: 0,
  ibi: 0,
  reforma: 0,
  enlace: '',
  contacto: '',
  telefono: '',
  nota: '',
  puntos: 0,
  creada: '2026-01-01',
  caracteristicas: [],
  checks: {},
  visitas: [],
  negociacion: [],
  compra: null,
  ...p,
});
const compra = (p: Partial<Compra> = {}): Compra => ({ ...COMPRA_DEFECTO, precio: 200_000 * E, ...p });
const hip = (p: Partial<Hipoteca> = {}): Hipoteca => ({
  id: 'h1',
  banco: 'Banco',
  casaId: null,
  importe: 200_000 * E,
  anios: 30,
  tipo: 'fija',
  tin: 3_000,
  aniosFijos: 0,
  diferencial: 0,
  bonificaciones: [],
  tae: 0,
  contacto: '',
  telefono: '',
  nota: '',
  descartada: false,
  ...p,
});
const archivo = (p: Partial<Archivo> = {}): Archivo => ({
  id: `a${Math.random()}`,
  tipo: 'dni',
  personaId: 't1',
  casaId: null,
  uri: 'content://x',
  mime: 'application/pdf',
  emision: null,
  nota: '',
  creado: HOY,
  ...p,
});
const datos = (p: Partial<Datos> = {}): Datos => ({ casas: [], hipotecas: [], archivos: [], titulares: [], marcas: {}, ajustes: aj(), ...p });

// ── dinero y fechas ──────────────────────────────────────────────────────────
bloque('dinero y fechas');
igual('euros sin céntimos', euros(245_000 * E), '245.000 €');
igual('euros con céntimos', euros(123456), '1.234,56 €');
igual('euros exacto', euros(1000, true), '10,00 €');
igual('euros negativo', euros(-1500), '−15 €');
igual('parse importe', parseImporte('1.234,5'), 123450);
igual('parse importe con €', parseImporte('250.000 €'), 25_000_000);
igual('parse importe inválido', parseImporte('12a'), null);
igual('parse pct', parsePct('2,85'), 2850);
igual('parse pct con punto', parsePct('3.247'), 3247);
igual('parse pct demasiados decimales', parsePct('2,8555'), null);
  igual('parse importe: 3 cifras tras un separador son miles', parseImporte('1,500'), 150_000);
igual('pct', pct(2850), '2,85 %');
igual('pct entero', aTextoPct(3000), '3');
igual('fecha corta mismo año', fechaCorta('2026-03-05', HOY), '5 mar');
igual('fecha corta otro año', fechaCorta('2027-01-05', HOY), '5 ene 2027');
igual('relativa', [relativa(HOY, HOY), relativa(addDias(HOY, 1), HOY), relativa(addDias(HOY, 5), HOY), relativa(addDias(HOY, -2), HOY)], [
  'hoy',
  'mañana',
  'en 5 días',
  'hace 2 días',
]);

// ── hipoteca ─────────────────────────────────────────────────────────────────
bloque('hipoteca');
igual('cuota 150.000 € al 3 % a 30 años', cuota(150_000 * E, 3_000, 360), 63241);
igual('cuota 200.000 € al 3 % a 30 años', cuota(200_000 * E, 3_000, 360), 84321);
igual('cuota al 0 %', cuota(120_000 * E, 0, 120), 100_000);
igual('cuota sin capital', cuota(0, 3_000, 360), 0);
cerca('capitalMax es la inversa de cuota', capitalMax(84321, 3_000, 360), 200_000 * E, 200);
igual('capitalMax sin cuota', capitalMax(0, 3_000, 360), 0);
{
  const r = amortizar(200_000 * E, [{ meses: 360, tin: 3_000 }]);
  igual('fija: se acaba de pagar', r.pendientes[0], 0);
  cerca('fija: intereses = cuotas − capital', r.intereses, 84321 * 360 - 200_000 * E, 400);

  const mixta = hip({ tipo: 'mixta', tin: 2_500, aniosFijos: 10, diferencial: 600 });
  igual('mixta: dos tramos', tramos(mixta, 3_247), [
    { meses: 120, tin: 2_500 },
    { meses: 240, tin: 3_847 },
  ]);
  const rm = resumenHipoteca(mixta, 3_247);
  igual('mixta: cuota del tramo fijo', rm.cuota, cuota(200_000 * E, 2_500, 360));
  cerca('mixta: cuota del tramo variable con lo pendiente', rm.cuotaDespues!, cuota(rm.pendienteTramo!, 3_847, 240), 1);
  ok('mixta: el estrés sube la cuota', rm.estres![0] > rm.cuotaDespues! && rm.estres![1] > rm.estres![0]);
  igual('fija: sin estrés ni segundo tramo', [resumenHipoteca(hip(), 3_247).estres, resumenHipoteca(hip(), 3_247).cuotaDespues], [null, null]);
  igual('variable sin tramo inicial: todo a Euríbor + diferencial', tramos(hip({ tipo: 'variable', aniosFijos: 0, diferencial: 500 }), 3_247), [
    { meses: 360, tin: 3_747 },
  ]);
  ok('variable sin tramo inicial: con estrés', resumenHipoteca(hip({ tipo: 'variable', diferencial: 500 }), 3_247).estres !== null);
  igual('el tipo no baja de 0', tramos(hip({ tipo: 'variable', diferencial: 0 }), -500)[0].tin, 0);

  const nomina = { nombre: 'Nómina', rebaja: 500, coste: 0, activa: true };
  const vida = { nombre: 'Vida', rebaja: 500, coste: 300 * E, activa: true };
  const cara = { nombre: 'Hogar', rebaja: 500, coste: 1_000 * E, activa: false };
  const conB = hip({ tin: 2_000, bonificaciones: [nomina, vida, cara] });
  igual('la bonificación no contratada sube el tipo', tramos(conB, 0)[0].tin, 2_500);
  const rb = resumenHipoteca(conB, 0);
  igual('vinculaciones: solo las contratadas, toda la vida', rb.vinculaciones, 300 * E * 30);
  igual('coste total = intereses + vinculaciones', rb.costeTotal, rb.intereses + rb.vinculaciones);
  igual('cuota con productos', rb.cuotaConVinculaciones, rb.cuota + 2_500);
  ok('una bonificación gratis compensa', rb.bonificaciones[0].compensa);
  ok('0,5 puntos por 300 €/año compensa en 200.000 € a 30 años', rb.bonificaciones[1].compensa);
  ok('0,5 puntos por 1.000 €/año no compensa', !rb.bonificaciones[2].compensa);
  cerca('ahorro de 0,5 puntos ≈ diferencia de cuotas × 360', rb.bonificaciones[1].ahorro, (cuota(200_000 * E, 3_000, 360) - cuota(200_000 * E, 2_500, 360)) * 360, 500);

  const orden = ordenarHipotecas([hip({ id: 'cara', tin: 4_000 }), hip({ id: 'desc', tin: 1_000, descartada: true }), hip({ id: 'barata', tin: 2_000 })], 3_247);
  igual('ofertas por coste total, descartadas al final', orden.map((x) => x.h.id), ['barata', 'cara', 'desc']);
}

// ── impuestos y coste ────────────────────────────────────────────────────────
bloque('impuestos y coste');
{
  const madrid = comunidad('madrid');
  igual('21 territorios', COMUNIDADES.length, 21);
  ok('claves únicas en tareas y documentos', new Set(TAREAS.map((t) => t.clave)).size === TAREAS.length && new Set(TIPOS_DOC.map((t) => t.clave)).size === TIPOS_DOC.length);
  igual('marginal Cataluña 700.000 €', marginal(700_000 * E, comunidad('cataluna').itp), 71_000 * E);
  igual('marginal por debajo del primer tramo', marginal(100_000 * E, comunidad('cataluna').itp), 10_000 * E);
  igual('ITP Madrid', impuestos(250_000 * E, 0, false, madrid, null), [{ clave: 'itp', nombre: 'ITP', importe: 15_000 * E }]);
  igual('ITP sobre el valor de referencia si es mayor', impuestos(200_000 * E, 220_000 * E, false, madrid, null)[0].importe, 13_200 * E);
  igual('obra nueva Madrid: IVA + AJD', impuestos(300_000 * E, 0, true, madrid, null).map((l) => l.importe), [30_000 * E, 2_250 * E]);
  igual('obra nueva Canarias: IGIC', impuestos(100_000 * E, 0, true, comunidad('canarias'), null)[0], { clave: 'iva', nombre: 'IGIC', importe: 7_000 * E });
  igual('tipo propio', impuestos(200_000 * E, 0, false, madrid, 4_000)[0].importe, 8_000 * E);
  igual('sin comunidad: estimación del 8 %', impuestos(100_000 * E, 0, false, comunidad(null), null)[0].importe, 8_000 * E);
  igual('Cataluña: 14 días de FEIN', [comunidad('cataluna').diasFein, madrid.diasFein], [14, 10]);

  const c = costeCompra(casa(), aj());
  igual('coste: precio + ITP + 1 % + tasación', c.total, (200_000 + 12_000 + 2_000 + 400) * E);
  const real = costeCompra(casa({ compra: compra({ precio: 190_000 * E, reales: { gastos: 1_500 * E, precio: 1 } }) }), aj());
  igual('coste: precio acordado y lo real sustituye a lo estimado (salvo el precio)', real.total, (190_000 + 11_400 + 1_500 + 400) * E);
  igual('coste: reforma', costeCompra(casa({ reforma: 20_000 * E }), aj()).total, (200_000 + 12_000 + 2_000 + 400 + 20_000) * E);
  igual('financiable sobre la tasación si es menor', financiable(200_000 * E, 190_000 * E, 80_000), 152_000 * E);
  igual('financiable sin tasación', financiable(200_000 * E, 0, 80_000), 160_000 * E);
}

// ── capacidad ────────────────────────────────────────────────────────────────
bloque('capacidad');
{
  // Ahorros justos e ingresos de sobra: manda la entrada. 0,27 · P + 400 € <= 30.000 €.
  const a1 = capacidad([titular({ neto: 5_000 * E })], aj({ ahorros: 30_000 * E }), HOY);
  igual('limitan los ahorros', [a1.precio, a1.limita], [109_000 * E, 'ahorros']);
  igual('préstamo del 80 %', a1.prestamo, 87_200 * E);
  ok('lo necesario cabe en los ahorros', a1.necesario <= 30_000 * E);

  // Muchos ahorros y poco sueldo: manda la cuota.
  const t2 = [titular({ neto: 2_000 * E })];
  const a2 = capacidad(t2, aj({ ahorros: 200_000 * E }), HOY);
  const tope = capitalMax(700 * E, 3_000, 360);
  igual('limitan los ingresos', a2.limita, 'ingresos');
  igual('precio con el préstamo topado por la cuota', a2.precio, Math.floor((200_000 * E - 400 * E + tope) / 1.07 / (1_000 * E)) * 1_000 * E);
  igual('cuota máxima = 35 % de ingresos', a2.cuotaMax, 700 * E);
  igual('14 pagas se prorratean', capacidad([titular({ neto: 1_200 * E, pagas: 14 })], aj(), HOY).ingresos, 1_400 * E);
  igual('las deudas restan de la cuota', capacidad([titular({ neto: 2_000 * E, deudas: 200 * E })], aj(), HOY).cuotaMax, 500 * E);
  igual('sin nada, 0', capacidad([], aj(), HOY).precio, 0);
  igual('financiando el 100 % solo se pagan impuestos y gastos', capacidad([titular({ neto: 5_000 * E })], aj({ ahorros: 15_000 * E, financiacion: 100_000 }), HOY).precio, 208_000 * E);

  igual('plazo: edad límite', plazoMax([titular({ nacimiento: 1980 })], aj(), HOY), 29);
  igual('plazo: manda el mayor', plazoMax([titular({ nacimiento: 1995 }), titular({ nacimiento: 1970 })], aj(), HOY), 19);
  igual('plazo: sin nacimiento, el de ajustes', plazoMax([titular()], aj(), HOY), 30);
  igual('plazo: nunca negativo', plazoMax([titular({ nacimiento: 1940 })], aj(), HOY), 0);
}

// ── números de una casa ──────────────────────────────────────────────────────
bloque('casa');
{
  const d = datos({ titulares: [titular({ neto: 3_000 * E })], ajustes: aj({ ahorros: 50_000 * E }) });
  const n = numerosCasa(casa({ comunidad: 60 * E, ibi: 600 * E }), d, HOY);
  igual('préstamo 80 % del precio', n.prestamo, 160_000 * E);
  igual('ahorro necesario', n.necesario, (214_400 - 160_000) * E);
  igual('lo que falta sobre los ahorros', n.falta, 4_400 * E);
  igual('cuota con el TIN supuesto', n.cuota, cuota(160_000 * E, 3_000, 360));
  igual('gasto mensual = cuota + comunidad + IBI/12', n.mensual, n.cuota + 60 * E + 50 * E);

  const elegida = hip({ id: 'e', importe: 150_000 * E, bonificaciones: [{ nombre: 'Vida', rebaja: 0, coste: 240 * E, activa: true }] });
  const n2 = numerosCasa(casa({ compra: compra({ hipotecaId: 'e' }) }), { ...d, hipotecas: [elegida] }, HOY);
  igual('con hipoteca elegida: su importe y su cuota', [n2.prestamo, n2.cuota], [150_000 * E, cuota(150_000 * E, 3_000, 360)]);
  igual('con hipoteca elegida: los productos entran en el gasto mensual', n2.mensual, n2.cuota + 20 * E);
  const n3 = numerosCasa(casa(), { ...d, hipotecas: [hip({ tin: 2_000, anios: 25 })] }, HOY);
  igual('sin elegida: con el tipo y el plazo de la mejor oferta', n3.cuota, cuota(160_000 * E, 2_000, 300));
}

// ── papeles ──────────────────────────────────────────────────────────────────
bloque('papeles');
{
  const t = titular();
  const nominas = (dias: number[]) => dias.map((d) => archivo({ tipo: 'nomina', emision: addDias(HOY, -d) }));
  const item = (archivos: Archivo[], tipo: string, ts = [t]) =>
    papeles(datos({ titulares: ts, archivos }), null, 1, HOY)[0]?.items.find((i) => i.tipo.clave === tipo);
  igual(
    'los tuyos, en orden: contrato, nóminas, renta y vida laboral',
    papeles(datos({ titulares: [t] }), null, 1, HOY)[0].items.map((i) => i.tipo.clave),
    ['contrato', 'nomina', 'irpf', 'vida_laboral'],
  );
  igual('2 nóminas de 3: falta', [item(nominas([10, 40]), 'nomina')?.estado, item(nominas([10, 40]), 'nomina')?.validos], ['falta', 2]);
  igual('3 nóminas recientes: ok', item(nominas([10, 40, 70]), 'nomina')?.estado, 'ok');
  igual('una vieja: caducado', item(nominas([10, 40, 120]), 'nomina')?.estado, 'caducado');
  igual('vida laboral de hace 40 días: caducada', item([archivo({ tipo: 'vida_laboral', emision: addDias(HOY, -40) })], 'vida_laboral')?.estado, 'caducado');
  igual('sin emisión cuenta desde el alta', item([archivo({ tipo: 'vida_laboral', creado: addDias(HOY, -10) })], 'vida_laboral')?.estado, 'ok');
  igual('el contrato no caduca', item([archivo({ tipo: 'contrato', emision: '2010-01-01' })], 'contrato')?.estado, 'ok');
  const auto = titular({ contrato: 'autonomo' });
  igual('autónomo: sin contrato ni nóminas', [item([], 'nomina', [auto]), item([], 'contrato', [auto]), item([], 'irpf', [auto])?.necesita], [undefined, undefined, 1]);
  igual('papeles de otro titular no cuentan', item([archivo({ tipo: 'contrato', personaId: 'otro' })], 'contrato')?.estado, 'falta');

  const enCompra = casa({ estado: 'oferta', compra: compra() });
  const d = datos({ titulares: [t], casas: [enCompra], archivos: [archivo({ tipo: 'nota_simple', personaId: null, casaId: 'c1' })] });
  const claves = (fase: number) => papeles(d, enCompra, fase, HOY).flatMap((g) => g.items.map((i) => i.tipo.clave));
  igual('fase 2: solo los tuyos', claves(2), ['contrato', 'nomina', 'irpf', 'vida_laboral']);
  igual('fase 3: y los de la casa', claves(3).slice(4), ['nota_simple', 'catastro', 'energetico', 'arras']);
  igual('fase 4: y la tasación', claves(4).at(-1), 'tasacion');
  const grupos = papeles(d, enCompra, 3, HOY);
  igual('el grupo de la casa lleva su nombre', [grupos[1].grupo, grupos[1].titulo], ['casa', 'Piso']);
  igual('nota simple de la casa', grupos[1].items.find((i) => i.tipo.clave === 'nota_simple')?.estado, 'ok');
  igual('sin titulares ni casa, nada', papeles(datos(), null, 6, HOY), []);
}

// ── guía ─────────────────────────────────────────────────────────────────────
bloque('guía');
{
  const fase = (casas: Casa[], extra: Partial<Datos> = {}) => faseActual(contexto(datos({ casas, ...extra }), HOY));
  igual('sin nada: prepárate', fase([]), 1);
  igual('con tus datos y ahorros: a buscar casa', fase([], { titulares: [titular({ neto: 2_000 * E })], ajustes: aj({ ahorros: 1 }) }), 2);
  igual('sin ahorros sigues preparándote', fase([], { titulares: [titular({ neto: 2_000 * E })] }), 1);
  igual('con casas: buscar', fase([casa()]), 2);
  igual('descartadas no cuentan', fase([casa({ estado: 'descartada' })]), 1);
  igual('elegida: resérvala', fase([casa({ estado: 'oferta' })]), 3);
  igual('arras sin FEIN: hipoteca', fase([casa({ estado: 'arras', compra: compra() })]), 4);
  igual('arras con FEIN y banco: firmar', fase([casa({ estado: 'arras', compra: compra({ fein: HOY, hipotecaId: 'h' }) })]), 5);
  igual('comprada: ya es tuya', fase([casa({ estado: 'comprada', compra: compra() })]), 6);
  igual(
    'casa en compra: la más avanzada',
    casaEnCompra([casa({ id: 'a', estado: 'oferta' }), casa({ id: 'b', estado: 'arras' }), casa({ id: 'c', estado: 'finalista' })])?.id,
    'b',
  );
  igual('sin elegir no hay casa en compra', casaEnCompra([casa({ estado: 'finalista' })]), null);

  const paso = (d: Datos) => {
    const x = contexto(d, HOY);
    return siguientePaso(x, faseActual(x))?.accion ?? null;
  };
  igual('siguiente paso en cada fase', [
    paso(datos()),
    paso(datos({ titulares: [titular({ neto: 1 })] })),
    paso(datos({ titulares: [titular({ neto: 1 })], ajustes: aj({ ahorros: 1 }) })),
    paso(datos({ casas: [casa()] })),
    paso(datos({ casas: [casa({ estado: 'oferta', compra: compra() })] })),
    paso(datos({ casas: [casa({ estado: 'arras', compra: compra() })] })),
    paso(datos({ casas: [casa({ estado: 'arras', compra: compra() })], hipotecas: [hip()] })),
    paso(datos({ casas: [casa({ estado: 'arras', compra: compra({ fein: HOY, hipotecaId: 'h1' }) })], hipotecas: [hip()] })),
    paso(datos({ casas: [casa({ estado: 'comprada', compra: compra() })] })),
  ], ['titular', 'ahorros', 'nueva', 'elegir', 'arras', 'ofertas', 'compra', 'comprada', null]);

  const estado = (d: Datos, clave: string) => tareas(contexto(d, HOY)).find((t) => t.tarea.clave === clave);
  igual('tarea derivada de los datos', [estado(datos({ ajustes: aj({ ccaa: null }) }), 'comunidad')?.estado, estado(datos(), 'comunidad')?.estado], [
    'pendiente',
    'hecha',
  ]);
  igual('marca manual', estado(datos({ marcas: { deudas: 'hecho' } }), 'deudas')?.estado, 'hecha');
  igual('no aplica', estado(datos({ marcas: { quien_paga: 'no-aplica' } }), 'quien_paga')?.estado, 'no-aplica');
  igual('obra nueva: solo si la casa es nueva', [
    !!estado(datos({ casas: [casa({ estado: 'oferta' })] }), 'decenal'),
    !!estado(datos({ casas: [casa({ estado: 'oferta', nueva: true })] }), 'decenal'),
  ], [false, true]);
  igual('acta hecha solo cuando ya pasó', [
    estado(datos({ casas: [casa({ estado: 'arras', compra: compra({ acta: addDias(HOY, 3) }) })] }), 'acta')?.estado,
    estado(datos({ casas: [casa({ estado: 'arras', compra: compra({ acta: HOY }) })] }), 'acta')?.estado,
  ], ['pendiente', 'hecha']);
  igual('arras hechas al pasar a arras', estado(datos({ casas: [casa({ estado: 'arras', compra: compra() })] }), 'arras')?.estado, 'hecha');
  igual(
    'nota simple de la casa elegida: hecha',
    estado(datos({ casas: [casa({ estado: 'oferta', compra: compra() })], archivos: [archivo({ tipo: 'nota_simple', personaId: null, casaId: 'c1' })] }), 'nota_simple')?.estado,
    'hecha',
  );
  igual('papeles de los titulares sin enlazar: pendiente', estado(datos({ titulares: [titular({ contrato: 'autonomo' })] }), 'papeles')?.estado, 'pendiente');
}

// ── próximos y avisos ────────────────────────────────────────────────────────
bloque('próximos y avisos');
{
  const textos = (d: Datos) => {
    const x = contexto(d, HOY);
    const g = papeles(d, x.compra, faseActual(x), HOY);
    return { proximos: proximos(x, g).map((p) => `${p.fecha} ${p.texto}`), avisos: avisos(x, g).map((a) => `${a.tono}: ${a.texto}`) };
  };
  const visitas = textos(datos({ casas: [casa({ visitas: [{ fecha: addDias(HOY, -1), hora: '' }, { fecha: addDias(HOY, 2), hora: '18:00' }] })] }));
  igual('solo visitas futuras', visitas.proximos, ['2026-10-19 Visita: Piso']);

  const cat = textos(datos({ ajustes: aj({ ccaa: 'cataluna' }), casas: [casa({ estado: 'arras', compra: compra({ fein: '2026-10-10' }) })] }));
  ok('Cataluña: se puede firmar 14 días después de la FEIN', cat.proximos.includes('2026-10-24 Ya se puede firmar'));

  const pronto = textos(datos({ casas: [casa({ estado: 'arras', compra: compra({ fein: '2026-10-10', firma: '2026-10-15', acta: '2026-10-15' }) })] }));
  ok('firma antes de FEIN + 10: peligro', pronto.avisos.some((a) => a.startsWith('peligro: No se puede firmar antes del 20 oct')));
  ok('acta el mismo día de la firma: peligro', pronto.avisos.some((a) => a.includes('acta de transparencia tiene que ser')));
  ok('arras sin condición de financiación: aviso', textos(datos({ casas: [casa({ estado: 'arras', compra: compra({ fechaArras: HOY }) })] })).avisos.some((a) => a.includes('condición de financiación')));
  ok('tasación baja: aviso', textos(datos({ casas: [casa({ estado: 'arras', compra: compra({ tasacion: 180_000 * E }) })] })).avisos.some((a) => a.includes('20.000 € por debajo')));

  const firmada = (firma: string, marcas: Datos['marcas'] = {}) => textos(datos({ casas: [casa({ estado: 'comprada', compra: compra({ firma }) })], marcas }));
  ok('tras firmar: plazo del impuesto en 28 días', firmada('2026-10-10').proximos.includes('2026-11-07 Pagar el impuesto (modelo 600)'));
  ok('impuesto vencido: peligro', firmada('2026-09-01').avisos.some((a) => a.startsWith('peligro: Han pasado 4 semanas')));
  igual('con el impuesto marcado como pagado, nada', firmada('2026-09-01', { impuesto: 'hecho' }).avisos, []);
  ok('firma pasada y sin marcar como tuya: aviso', textos(datos({ casas: [casa({ estado: 'arras', compra: compra({ firma: '2026-10-01' }) })] })).avisos.some((a) => a.includes('marca la casa como tuya')));
  ok('sin comunidad: aviso', textos(datos({ ajustes: aj({ ccaa: null }) })).avisos[0].includes('comunidad autónoma'));
  ok(
    'documento que caduca este mes',
    textos(datos({ titulares: [titular()], archivos: [archivo({ tipo: 'vida_laboral', emision: addDias(HOY, -20) })] })).proximos.includes(`${addDias(HOY, 10)} Caduca: Vida laboral`),
  );
  ok('documento caducado: aviso', textos(datos({ titulares: [titular()], archivos: [archivo({ tipo: 'vida_laboral', emision: '2026-01-01' })] })).avisos.some((a) => a.includes('documento caducado')));
}

// ── migraciones ──────────────────────────────────────────────────────────────
bloque('migraciones');
{
  const base = new DatabaseSync(':memory:');
  base.exec('PRAGMA foreign_keys = ON');
  const version = () => (base.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  igual('migra de 0 a la última', migrar((sql) => base.exec(sql), version()), VERSION_ESQUEMA);
  igual('user_version actualizada', version(), VERSION_ESQUEMA);
  const tablas = (base.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
  ok('existen todas las tablas', TABLAS.every((t) => tablas.includes(t)));
  let ejecuciones = 0;
  migrar(() => ejecuciones++, version());
  igual('volver a migrar no hace nada', ejecuciones, 0);
  let futura = false;
  try {
    migrar(() => {}, VERSION_ESQUEMA + 1);
  } catch {
    futura = true;
  }
  ok('una base de una versión futura se rechaza', futura);

  const intentar = (sql: string) => {
    try {
      base.exec(sql);
      return true;
    } catch {
      return false;
    }
  };
  ok('casa válida', intentar("INSERT INTO casas (id, nombre, estado, precio, creada) VALUES ('c1', 'Piso', 'interesa', 100, '2026-10-17')"));
  ok('la base rechaza precios negativos', !intentar("INSERT INTO casas (id, nombre, estado, precio, creada) VALUES ('c2', 'x', 'interesa', -1, '2026-10-17')"));
  ok('la base rechaza estados desconocidos', !intentar("INSERT INTO casas (id, nombre, estado, creada) VALUES ('c3', 'x', 'vendida', '2026-10-17')"));
  ok('la base rechaza puntuaciones fuera de 0–5', !intentar("INSERT INTO casas (id, nombre, estado, puntos, creada) VALUES ('c4', 'x', 'interesa', 6, '2026-10-17')"));
  intentar("INSERT INTO archivos (id, tipo, casa_id, uri, creado) VALUES ('a1', 'foto', 'c1', 'content://x', '2026-10-17')");
  intentar("INSERT INTO hipotecas (id, banco, casa_id, importe, anios, tipo, tin) VALUES ('h1', 'B', 'c1', 1, 30, 'fija', 3000)");
  base.exec("DELETE FROM casas WHERE id = 'c1'");
  const n = (sql: string) => (base.prepare(sql).get() as { n: number }).n;
  igual('borrar una casa borra sus enlaces', n('SELECT count(*) AS n FROM archivos'), 0);
  igual('y suelta sus hipotecas', n('SELECT count(*) AS n FROM hipotecas WHERE casa_id IS NULL'), 1);

  const otra = new DatabaseSync(':memory:');
  let fallo = false;
  try {
    migrar((sql) => otra.exec(sql.replace('CREATE TABLE archivos', 'CREATE TABLA archivos')), 0);
  } catch {
    fallo = true;
  }
  const tras = (otra.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number }).n;
  ok('migración rota: falla y no deja tablas a medias', fallo && tras === 0);
}

console.log(fallos ? `\n${fallos} de ${total} asserts FALLAN` : `\n${total} asserts OK`);
process.exit(fallos ? 1 : 0);
