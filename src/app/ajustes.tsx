// Ajustes: lo que cambia las cuentas (comunidad, impuestos, gastos), la seguridad y
// los datos. Cada cambio se guarda al momento.

import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Text } from 'react-native';

import { Ayuda, CampoDinero, CampoPct, Chip, Chips, Fila, Interruptor, Nota, Pantalla, Seccion } from '@/components/ui';
import { useHoy } from '@/hooks';
import { comunidad, COMUNIDADES } from '@/lib/catalogo';
import { estaCifrada } from '@/lib/db';
import { pct } from '@/lib/dinero';
import { fechaCorta } from '@/lib/fechas';
import { borrarTodo, cambiarAjustes, useApp } from '@/store/app';
import { color, typo } from '@/theme';

export default function PantallaAjustes() {
  const a = useApp((s) => s.ajustes);
  const hoy = useHoy();
  const [verComunidades, setVerComunidades] = useState(!a.ccaa);
  const com = comunidad(a.ccaa);
  const itp = com.itp.length === 1 ? pct(com.itp[0][1]) : `${pct(com.itp[0][1])} a ${pct(com.itp[com.itp.length - 1][1])} por tramos`;

  const cambiarBloqueo = async (activar: boolean) => {
    if (!activar) return cambiarAjustes({ bloqueo: false });
    const nivel = await LocalAuthentication.getEnrolledLevelAsync();
    if (nivel === LocalAuthentication.SecurityLevel.NONE) {
      return Alert.alert('Bloqueo', 'Configura antes una huella o un PIN en los ajustes del móvil.');
    }
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear HIPO' });
    if (r.success) cambiarAjustes({ bloqueo: true });
  };

  return (
    <Pantalla titulo="Ajustes" atras>
      <Seccion titulo="Impuestos">
        <Fila titulo="Comunidad autónoma" derecha={a.ccaa ? com.nombre : 'Elegir'} onPress={() => setVerComunidades(!verComunidades)} chevron />
        {verComunidades && (
          <Chips>
            {COMUNIDADES.map((c) => (
              <Chip
                key={c.clave}
                texto={c.nombre}
                activo={a.ccaa === c.clave}
                onPress={() => {
                  cambiarAjustes({ ccaa: c.clave });
                  setVerComunidades(false);
                }}
              />
            ))}
          </Chips>
        )}
        {a.ccaa && (
          <Ayuda>
            Tipos generales en {com.nombre}: ITP {itp} en segunda mano; {com.nombreIva} {pct(com.iva)} + AJD {pct(com.ajd)} en obra nueva.
            {com.ivaDudoso ? ` El ${com.nombreIva} de obra nueva no está confirmado: revísalo.` : ''}
          </Ayuda>
        )}
        <Interruptor
          titulo="Tengo un tipo reducido"
          ayuda="Jóvenes, familia numerosa, discapacidad, VPO… Cada comunidad tiene los suyos. Sustituye al ITP (o al IVA en obra nueva)."
          valor={a.impuestoPropio !== null}
          onCambio={(v) => cambiarAjustes({ impuestoPropio: v ? (com.itp[0][1] ?? 0) : null })}
        />
        {a.impuestoPropio !== null && <CampoPct etiqueta="Tu tipo" valor={a.impuestoPropio} onGuardar={(v) => cambiarAjustes({ impuestoPropio: v })} />}
      </Seccion>

      <Seccion titulo="Gastos de la compra">
        <CampoPct
          etiqueta="Notaría, registro y gestoría"
          ayuda="De la compraventa, sobre el precio: en torno al 1 %. Los de la hipoteca los paga el banco por ley."
          valor={a.gastosPct}
          onGuardar={(gastosPct) => cambiarAjustes({ gastosPct })}
        />
        <CampoDinero etiqueta="Tasación" ayuda="La pagas tú: entre 250 y 500 €." valor={a.tasacion} onGuardar={(tasacion) => cambiarAjustes({ tasacion })} />
      </Seccion>

      <Seccion titulo="Seguridad">
        <Interruptor
          titulo="Bloquear con huella o PIN"
          ayuda="Al abrir la app y al volver tras más de 30 segundos fuera."
          valor={a.bloqueo}
          onCambio={(v) => void cambiarBloqueo(v)}
        />
        {!estaCifrada() && <Nota tono="aviso" texto="Estás en Expo Go: aquí la base de datos NO está cifrada. En la app instalada (APK) sí." />}
      </Seccion>

      <Seccion titulo="Tus datos">
        <Nota
          tono="aviso"
          texto="Todo vive solo en este móvil. Si lo pierdes o lo cambias sin una copia, se pierde. Los documentos y fotos siguen donde estaban: la app solo guarda sus enlaces."
        />
        <Ayuda>{a.ultimaCopia ? `Última copia: ${fechaCorta(a.ultimaCopia, hoy)}.` : 'Aún no has hecho ninguna copia.'}</Ayuda>
        <Fila titulo="Exportar copia cifrada" icono="lock" onPress={() => router.push({ pathname: '/copia', params: { modo: 'exportar' } })} chevron />
        <Fila titulo="Importar copia" icono="download" onPress={() => router.push({ pathname: '/copia', params: { modo: 'importar' } })} chevron />
        <Fila
          titulo="Borrar todo"
          icono="trash-2"
          tinteIcono={color.acento}
          onPress={() =>
            Alert.alert('Borrar todo', 'Se borran todos los datos de la app. Tus documentos y fotos siguen en el móvil. No se puede deshacer.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Borrar todo', style: 'destructive', onPress: borrarTodo },
            ])
          }
        />
      </Seccion>

      <Seccion titulo="Acerca de">
        <Text style={[typo.cuerpo, { color: color.texto }]}>HIPO {Constants.expoConfig?.version ?? ''}</Text>
        <Text style={[typo.apoyo, { color: color.texto2 }]}>
          Sin cuentas, sin anuncios, sin internet: la app ni siquiera tiene permiso para conectarse. Las cifras son estimaciones con los datos
          generales de octubre de 2026; la última palabra es del banco, el notario y Hacienda.
        </Text>
        <Fila titulo="Hecho por Aitor Pérez" subtitulo="apvwbm.com" icono="globe" onPress={() => void Linking.openURL(WEB)} />
        <Fila titulo="Invítame a un café" subtitulo="HIPO es gratis y lo seguirá siendo." icono="coffee" onPress={() => void Linking.openURL(KOFI)} />
      </Seccion>
    </Pantalla>
  );
}

// Abren el navegador: la app sigue sin permiso INTERNET.
const WEB = 'https://apvwbm.com/projects/hipo';
const KOFI = 'https://ko-fi.com/apvwbm';
