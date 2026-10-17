// La oferta de un banco. El resumen se recalcula al escribir: cuota, lo que cuesta de
// verdad y, por cada bonificación, si compensa lo que cuesta el producto.

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ayuda, Boton, BotonIcono, Campo, CampoDinero, CampoPct, Chip, Chips, Cifra, Fila, Interruptor, Nota, Pantalla, Pasos, Seccion, Segmentado } from '@/components/ui';
import { useDatos, useHoy } from '@/hooks';
import { euros, eurosRedondos, pct } from '@/lib/dinero';
import { casaEnCompra, numerosCasa, resumenHipoteca } from '@/lib/motor';
import { borrarHipoteca, guardarHipoteca, nuevoId } from '@/store/app';
import { BORDE, color, espacio, RADIO, typo } from '@/theme';
import type { Bonificacion, Hipoteca, TipoHipoteca } from '@/types';

const PRODUCTOS = ['Nómina', 'Seguro de vida', 'Seguro de hogar', 'Tarjeta', 'Plan de pensiones', 'Alarma'];

export default function PantallaOferta() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const d = useDatos();
  const hoy = useHoy();
  const existente = d.hipotecas.find((h) => h.id === id);
  const [h, setH] = useState<Hipoteca>(() => {
    if (existente) return existente;
    const compra = casaEnCompra(d.casas);
    return {
      id: nuevoId(),
      banco: '',
      casaId: compra?.id ?? null,
      importe: compra ? numerosCasa(compra, d, hoy).prestamo : 0,
      anios: d.ajustes.plazo,
      tipo: 'fija',
      tin: 0,
      aniosFijos: 0,
      diferencial: 0,
      bonificaciones: [],
      tae: 0,
      contacto: '',
      telefono: '',
      nota: '',
      descartada: false,
    };
  });
  const [error, setError] = useState<string | null>(null);
  const cambiar = (p: Partial<Hipoteca>) => setH((x) => ({ ...x, ...p }));
  const cambiarB = (i: number, p: Partial<Bonificacion>) => cambiar({ bonificaciones: h.bonificaciones.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const r = useMemo(() => resumenHipoteca(h, d.ajustes.euribor), [h, d.ajustes.euribor]);

  const guardar = () => {
    if (!h.banco.trim()) return setError('Escribe el banco.');
    if (!h.importe) return setError('Falta el importe.');
    guardarHipoteca({ ...h, banco: h.banco.trim() });
    router.back();
  };

  return (
    <Pantalla
      titulo={existente ? existente.banco : 'Oferta'}
      atras
      pie={
        <View style={s.pie}>
          {existente && (
            <BotonIcono
              icono="trash-2"
              etiqueta="Eliminar"
              tinte={color.acento}
              onPress={() => {
                borrarHipoteca(existente);
                router.back();
              }}
            />
          )}
          {existente && (
            <Boton
              texto={h.descartada ? 'Recuperar' : 'Descartar'}
              variante="secundario"
              onPress={() => {
                guardarHipoteca({ ...h, descartada: !h.descartada });
                router.back();
              }}
            />
          )}
          <Boton texto="Guardar" icono="check" style={{ flex: 1 }} onPress={guardar} />
        </View>
      }
    >
      <Seccion>
        <Campo etiqueta="Banco" value={h.banco} onChangeText={(banco) => cambiar({ banco })} error={error} maxLength={40} autoFocus={!existente} />
        <CampoDinero etiqueta="Importe" valor={h.importe} onGuardar={(importe) => cambiar({ importe })} />
        <Pasos
          etiqueta="Plazo"
          texto={`${h.anios} años`}
          onMenos={() => cambiar({ anios: Math.max(5, h.anios - 1) })}
          onMas={() => cambiar({ anios: Math.min(40, h.anios + 1) })}
        />
        <Segmentado<TipoHipoteca>
          etiqueta="Tipo"
          opciones={[
            { valor: 'fija', texto: 'Fija' },
            { valor: 'variable', texto: 'Variable' },
            { valor: 'mixta', texto: 'Mixta' },
          ]}
          valor={h.tipo}
          onCambio={(tipo) => cambiar({ tipo, aniosFijos: tipo === 'fija' ? 0 : h.aniosFijos || (tipo === 'variable' ? 1 : 10) })}
        />
        <CampoPct
          etiqueta={h.tipo === 'fija' ? 'TIN con todas las bonificaciones' : h.tipo === 'mixta' ? 'TIN de los años fijos (bonificado)' : 'TIN del primer tramo (bonificado)'}
          ayuda="El tipo más bajo que te ofrecen, contratando todo. Abajo apuntas lo que sube si no contratas cada producto."
          valor={h.tin}
          onGuardar={(tin) => cambiar({ tin })}
        />
        {h.tipo !== 'fija' && (
          <>
            <Pasos
              etiqueta={h.tipo === 'mixta' ? 'Años a tipo fijo' : 'Años a tipo inicial'}
              texto={String(h.aniosFijos)}
              onMenos={() => cambiar({ aniosFijos: Math.max(0, h.aniosFijos - 1) })}
              onMas={() => cambiar({ aniosFijos: Math.min(h.anios, h.aniosFijos + 1) })}
            />
            <CampoPct
              etiqueta="Diferencial sobre el Euríbor (bonificado)"
              ayuda={`Después pagas Euríbor + diferencial. Se calcula con el Euríbor de referencia: ${pct(d.ajustes.euribor)}.`}
              valor={h.diferencial}
              onGuardar={(diferencial) => cambiar({ diferencial })}
            />
          </>
        )}
      </Seccion>

      <Seccion titulo="Bonificaciones">
        <Ayuda>
          Productos que bajan el tipo a cambio de contratarlos. Por ley, el banco también tiene que ofrecerte la hipoteca sin ellos. Apaga los que no
          vayas a contratar.
        </Ayuda>
        {h.bonificaciones.map((b, i) => {
          const res = r.bonificaciones[i];
          return (
            <View key={i} style={s.bonificacion}>
              <View style={s.filaB}>
                <Text style={[typo.cuerpo, { flex: 1 }]}>{b.nombre}</Text>
                <BotonIcono icono="x" etiqueta={`Quitar ${b.nombre}`} tinte={color.texto3} onPress={() => cambiar({ bonificaciones: h.bonificaciones.filter((_, j) => j !== i) })} />
              </View>
              <View style={s.filaB}>
                <View style={{ flex: 1 }}>
                  <CampoPct etiqueta="Rebaja del tipo" valor={b.rebaja} onGuardar={(rebaja) => cambiarB(i, { rebaja })} />
                </View>
                <View style={{ flex: 1 }}>
                  <CampoDinero etiqueta="Coste al año" valor={b.coste} onGuardar={(coste) => cambiarB(i, { coste })} />
                </View>
              </View>
              <Interruptor titulo="La contrato" valor={b.activa} onCambio={(activa) => cambiarB(i, { activa })} />
              {res && b.rebaja > 0 && (
                <Nota
                  tono={res.compensa ? 'bien' : 'aviso'}
                  texto={
                    res.compensa
                      ? `Compensa: ahorras ${eurosRedondos(res.ahorro)} en intereses y te cuesta ${eurosRedondos(res.coste)} en ${h.anios} años.`
                      : `No compensa: ahorras ${eurosRedondos(res.ahorro)} en intereses pero te cuesta ${eurosRedondos(res.coste)} en ${h.anios} años.`
                  }
                />
              )}
            </View>
          );
        })}
        <Chips>
          {PRODUCTOS.filter((p) => !h.bonificaciones.some((b) => b.nombre === p)).map((p) => (
            <Chip
              key={p}
              texto={p}
              icono="plus"
              activo={false}
              onPress={() => cambiar({ bonificaciones: [...h.bonificaciones, { nombre: p, rebaja: 0, coste: 0, activa: true }] })}
            />
          ))}
        </Chips>
      </Seccion>

      <Seccion titulo="Lo que te cuesta">
        <Cifra rotulo={h.tipo === 'fija' ? 'Cuota' : 'Cuota al principio'} valor={`${euros(r.cuota)}/mes`} apoyo={r.cuotaConVinculaciones > r.cuota ? `${euros(r.cuotaConVinculaciones)} con los productos` : undefined} />
        {r.cuotaDespues !== null && (
          <Fila titulo="Cuota después, con el Euríbor de referencia" subtitulo={r.pendienteTramo ? `Te quedarán ${eurosRedondos(r.pendienteTramo)} por pagar` : undefined} derecha={euros(r.cuotaDespues)} />
        )}
        {r.estres && <Fila titulo="Si el Euríbor sube 1 / 2 puntos" derecha={`${euros(r.estres[0])} / ${euros(r.estres[1])}`} />}
        <Fila titulo="Intereses" derecha={eurosRedondos(r.intereses)} />
        {r.vinculaciones > 0 && <Fila titulo="Productos contratados" derecha={eurosRedondos(r.vinculaciones)} />}
        <Fila titulo="Coste total" subtitulo="Lo que pagas además de devolver el préstamo" derecha={eurosRedondos(r.costeTotal)} />
        <Ayuda>Supone que mantienes los productos toda la vida del préstamo y que cuestan lo mismo cada año.</Ayuda>
      </Seccion>

      <Seccion titulo="Más datos">
        <CampoPct etiqueta="TAE de la FEIN (opcional)" ayuda="La TAE incluye comisiones y productos: sirve para comparar ofertas con los mismos productos." valor={h.tae} onGuardar={(tae) => cambiar({ tae })} />
        <Campo etiqueta="Contacto" value={h.contacto} onChangeText={(contacto) => cambiar({ contacto })} maxLength={40} />
        <Campo etiqueta="Teléfono" value={h.telefono} onChangeText={(telefono) => cambiar({ telefono })} keyboardType="phone-pad" maxLength={20} />
        <Campo etiqueta="Nota" value={h.nota} onChangeText={(nota) => cambiar({ nota })} multiline />
        <Ayuda>
          Comisión por amortizar antes de tiempo (máximo legal): en variable, 0,25 % los 3 primeros años o 0,15 % los 5 primeros; en fija, 2 % los
          10 primeros años y 1,5 % después.
        </Ayuda>
      </Seccion>
    </Pantalla>
  );
}

const s = StyleSheet.create({
  pie: { flexDirection: 'row', gap: espacio.md, alignItems: 'center' },
  bonificacion: { borderWidth: BORDE, borderColor: color.linea, borderRadius: RADIO, padding: espacio.md, gap: espacio.sm },
  filaB: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.md },
});
