// Hipoteca: cuánto te puedes permitir (con quién compra y sus números) y las ofertas
// de los bancos ordenadas por lo que de verdad cuestan.

import { router } from 'expo-router';

import { Ayuda, Boton, CampoDinero, CampoPct, Cifra, Fila, Nota, Pantalla, Pasos, Seccion, Segmentado } from '@/components/ui';
import { useCapacidad, useHipotecas, useHoy } from '@/hooks';
import { CONTRATOS, EDAD_LIMITE, RATIO_ENDEUDAMIENTO } from '@/lib/catalogo';
import { aplicarPct, euros, eurosRedondos, pct } from '@/lib/dinero';
import { fechaCorta } from '@/lib/fechas';
import { cambiarAjustes, useApp } from '@/store/app';
import { color } from '@/theme';

const TIPOS = { fija: 'Fija', variable: 'Variable', mixta: 'Mixta' };

export default function PantallaHipoteca() {
  const cap = useCapacidad();
  const ofertas = useHipotecas();
  const titulares = useApp((s) => s.titulares);
  const a = useApp((s) => s.ajustes);
  const hoy = useHoy();
  const conIngresos = cap.ingresos > 0;
  const mejor = ofertas.find((o) => !o.h.descartada);

  const apoyo = !conIngresos
    ? 'Di quién compra y cuánto ingresa.'
    : !a.ahorros
      ? 'Apunta tus ahorros para calcularlo.'
      : `Hipoteca de ${eurosRedondos(cap.prestamo)} a ${cap.plazo} años: ${euros(cap.cuota)} al mes. De tus ahorros salen ${eurosRedondos(cap.necesario)} (entrada, impuestos y gastos).`;

  return (
    <Pantalla titulo="Hipoteca">
      <Seccion>
        <Cifra heroe rotulo="Puedes permitirte hasta" valor={conIngresos && a.ahorros ? eurosRedondos(cap.precio) : '—'} apoyo={apoyo} />
        {conIngresos && a.ahorros > 0 && (
          <Nota
            tono="neutro"
            icono={cap.limita === 'ahorros' ? 'database' : 'trending-up'}
            texto={
              cap.limita === 'ahorros'
                ? 'Te frenan los ahorros: el banco no presta más del ' + pct(a.financiacion) + ' y el resto, más impuestos y gastos, lo pones tú.'
                : `Te frena la cuota: el banco no suele dejar que tus cuotas pasen del 35 % de lo que cobras, y eso te deja como mucho ${euros(cap.cuotaMax)} al mes para la hipoteca.`
            }
          />
        )}
        <Ayuda>Casa de segunda mano en tu comunidad, al TIN supuesto. Es una estimación: la decisión es del banco.</Ayuda>
      </Seccion>

      <Seccion titulo="Quién compra" derecha={<Boton texto="Añadir" variante="texto" icono="user-plus" onPress={() => router.push('/titular')} />}>
        {titulares.length === 0 && <Ayuda>Añade a cada persona que va a firmar la hipoteca.</Ayuda>}
        {titulares.map((t) => (
          <Fila
            key={t.id}
            titulo={t.nombre || 'Titular'}
            subtitulo={`${euros(t.neto)} × ${t.pagas} pagas · ${CONTRATOS.find((c) => c.valor === t.contrato)?.texto}${t.deudas ? ` · debe ${euros(t.deudas)}/mes` : ''}`}
            derecha={`${euros(Math.round((t.neto * t.pagas) / 12))}`}
            subderecha="al mes"
            icono="user"
            onPress={() => router.push({ pathname: '/titular', params: { id: t.id } })}
            chevron
          />
        ))}
      </Seccion>

      <Seccion titulo="Tus números">
        <CampoDinero
          etiqueta="Ahorros para la compra"
          ayuda="Lo que puedes poner sin quedarte sin colchón para imprevistos."
          valor={a.ahorros}
          onGuardar={(v) => cambiarAjustes({ ahorros: v })}
        />
        <Segmentado
          etiqueta="El banco presta hasta"
          opciones={[80_000, 90_000, 100_000].map((v) => ({ valor: v, texto: pct(v) }))}
          valor={a.financiacion}
          onCambio={(v) => cambiarAjustes({ financiacion: v })}
        />
        <Ayuda>
          Sobre el menor entre precio y tasación. Lo normal es el 80 %. Con el aval del ICO (hasta 35 años o con hijos menores, hasta el 31-12-2027)
          puede llegar al 100 %.
        </Ayuda>
        {conIngresos && (
          <Fila
            titulo="Cuota máxima para la hipoteca"
            subtitulo={`El 35 % de lo que cobráis (${euros(cap.ingresos)} al mes)${cap.cuotaMax < aplicarPct(cap.ingresos, RATIO_ENDEUDAMIENTO) ? ', menos tus otros préstamos' : ''}. Es el ratio de endeudamiento: el banco no suele pasar de ahí.`}
            derecha={`${euros(cap.cuotaMax)}/mes`}
          />
        )}
        <Pasos
          etiqueta="Plazo"
          texto={`${a.plazo} años`}
          onMenos={() => cambiarAjustes({ plazo: Math.max(5, a.plazo - 1) })}
          onMas={() => cambiarAjustes({ plazo: Math.min(40, a.plazo + 1) })}
          ayuda={
            cap.plazo < a.plazo
              ? `Por edad, como mucho ${cap.plazo} años: el banco quiere que termines de pagar antes de cumplir ${EDAD_LIMITE}.`
              : undefined
          }
        />
        <CampoPct
          etiqueta="TIN supuesto"
          ayuda="El tipo con el que calcular hasta que tengas ofertas reales."
          valor={a.tinSupuesto}
          onGuardar={(v) => cambiarAjustes({ tinSupuesto: v })}
        />
      </Seccion>

      <Seccion titulo="Ofertas de los bancos" derecha={<Boton texto="Añadir" variante="texto" icono="plus" onPress={() => router.push('/oferta')} />}>
        {ofertas.length === 0 ? (
          <Ayuda>Pide oferta a 3 bancos o más y apúntalas aquí: la app las ordena por lo que cuestan de verdad.</Ayuda>
        ) : (
          <Ayuda>Ordenadas por coste total: intereses más lo que cuestan los productos que contratas.</Ayuda>
        )}
        {ofertas.map(({ h, r }) => (
          <Fila
            key={h.id}
            titulo={h.banco}
            subtitulo={`${h.descartada ? 'Descartada · ' : h === mejor?.h && ofertas.length > 1 ? 'La más barata · ' : ''}${TIPOS[h.tipo]} · ${pct(h.tin)} · ${h.anios} años`}
            derecha={`${euros(r.cuota)}/mes`}
            subderecha={`cuesta ${eurosRedondos(r.costeTotal)}`}
            tintoDerecha={h.descartada ? color.texto3 : undefined}
            onPress={() => router.push({ pathname: '/oferta', params: { id: h.id } })}
            chevron
          />
        ))}
      </Seccion>

      <Seccion titulo="Euríbor">
        <CampoPct
          etiqueta="Euríbor a 12 meses"
          ayuda={`Dato del ${fechaCorta(a.euriborFecha, hoy)}. La app no tiene internet: actualízalo tú cuando cambie. Lo usan las variables y las mixtas.`}
          valor={a.euribor}
          onGuardar={(v) => cambiarAjustes({ euribor: v, euriborFecha: hoy })}
        />
      </Seccion>
    </Pantalla>
  );
}
