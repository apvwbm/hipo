// Quien firma la hipoteca: lo que gana, lo que debe, su edad (el plazo) y su contrato
// (qué papeles le pedirán).

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Ayuda, Boton, Campo, CampoDinero, CampoEntero, Pantalla, Seccion, Segmentado } from '@/components/ui';
import { CONTRATOS } from '@/lib/catalogo';
import { borrarTitular, guardarTitular, nuevoTitular, useApp } from '@/store/app';
import { espacio } from '@/theme';
import type { Titular } from '@/types';

export default function PantallaTitular() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existente = useApp((s) => s.titulares).find((t) => t.id === id);
  const [t, setT] = useState<Titular>(() => existente ?? nuevoTitular());
  const cambiar = (p: Partial<Titular>) => setT((x) => ({ ...x, ...p }));

  return (
    <Pantalla
      titulo={existente ? existente.nombre || 'Titular' : 'Quién compra'}
      atras
      pie={
        <View style={s.pie}>
          {existente && (
            <Boton
              texto="Eliminar"
              variante="peligro"
              icono="trash-2"
              onPress={() => {
                borrarTitular(existente);
                router.back();
              }}
            />
          )}
          <Boton
            texto="Guardar"
            icono="check"
            style={{ flex: 1 }}
            onPress={() => {
              guardarTitular({ ...t, nombre: t.nombre.trim() });
              router.back();
            }}
          />
        </View>
      }
    >
      <Seccion>
        <Campo etiqueta="Nombre" value={t.nombre} onChangeText={(nombre) => cambiar({ nombre })} maxLength={30} autoFocus={!existente} />
        <CampoDinero etiqueta="Sueldo neto de cada paga" valor={t.neto} onGuardar={(neto) => cambiar({ neto })} />
        <Segmentado
          etiqueta="Pagas al año"
          opciones={[
            { valor: 12, texto: '12' },
            { valor: 14, texto: '14' },
          ]}
          valor={t.pagas}
          onCambio={(pagas) => cambiar({ pagas: pagas as 12 | 14 })}
        />
        <CampoDinero
          etiqueta="Otros préstamos al mes"
          ayuda="Coche, tarjetas, estudios… El banco los resta de lo que puedes pagar."
          valor={t.deudas}
          onGuardar={(deudas) => cambiar({ deudas })}
        />
      </Seccion>
      <Seccion>
        <CampoEntero
          etiqueta="Año de nacimiento"
          ayuda="Los bancos quieren la hipoteca pagada antes de los 75: acorta el plazo."
          valor={t.nacimiento ?? 0}
          onGuardar={(n) => cambiar({ nacimiento: n || null })}
        />
        <Segmentado etiqueta="Contrato" opciones={CONTRATOS} valor={t.contrato} onCambio={(contrato) => cambiar({ contrato })} />
        <Ayuda>Cambia los papeles que te pedirán: un autónomo no tiene nóminas, pero sí trimestrales y dos declaraciones.</Ayuda>
      </Seccion>
    </Pantalla>
  );
}

const s = StyleSheet.create({
  pie: { flexDirection: 'row', gap: espacio.md },
});
