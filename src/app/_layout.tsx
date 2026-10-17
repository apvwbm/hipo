// Raíz: fuentes, apertura de la base cifrada, bloqueo y navegación.
//
// El splash se mantiene hasta que las fuentes Y los datos están listos, así la
// primera pantalla sale entera y sin parpadeos.

import { Archivo_400Regular, Archivo_600SemiBold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo';
import { useFonts } from 'expo-font';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AvisoFlotante, Boton, Icono } from '@/components/ui';
import { bloquear, desbloquear, iniciar, nuevoDia, useApp } from '@/store/app';
import { color, espacio, typo } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const MARGEN_BLOQUEO_MS = 30_000;
const MODAL = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

export default function Raiz() {
  const [fuentes] = useFonts({ Archivo_400Regular, Archivo_600SemiBold, Archivo_800ExtraBold });
  const cargado = useApp((s) => s.cargado);
  const bloqueado = useApp((s) => s.bloqueado);

  useEffect(() => {
    void iniciar();
  }, []);

  useEffect(() => {
    if (fuentes && cargado) void SplashScreen.hideAsync();
  }, [fuentes, cargado]);

  // Al volver de segundo plano: se bloquea si ha pasado fuera más del margen, y se
  // refresca el día (los plazos y "próximo" dependen de él). El margen existe porque
  // el selector de archivos, el visor y compartir también mandan la app a segundo
  // plano; si se tarda más de eso leyendo un PDF, se pide la huella al volver.
  useEffect(() => {
    let fueraDesde = 0;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'background') fueraDesde = Date.now();
      if (estado !== 'active' || !fueraDesde) return;
      if (Date.now() - fueraDesde > MARGEN_BLOQUEO_MS) bloquear();
      fueraDesde = 0;
      nuevoDia();
    });
    return () => sub.remove();
  }, []);

  if (!fuentes || !cargado) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.fondo }, animation: 'fade' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="nueva" options={MODAL} />
        <Stack.Screen name="oferta" options={MODAL} />
        <Stack.Screen name="titular" options={MODAL} />
        <Stack.Screen name="documento" options={MODAL} />
        <Stack.Screen name="copia" options={MODAL} />
      </Stack>
      <AvisoFlotante />
      {bloqueado && <Bloqueo />}
    </SafeAreaProvider>
  );
}

/**
 * Capa de bloqueo ENCIMA de la navegación, no en su lugar: así al desbloquear se
 * vuelve exactamente a donde se estaba. Usa la huella o, si no, el PIN del móvil.
 */
function Bloqueo() {
  const pidiendo = useRef(false);
  const pedir = useCallback(async () => {
    if (pidiendo.current) return;
    pidiendo.current = true;
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear HIPO' });
      if (r.success) desbloquear();
    } finally {
      pidiendo.current = false;
    }
  }, []);

  // Solo al aparecer. Pedirlo también en cada vuelta a primer plano haría un bucle: el
  // PIN del sistema es otra actividad, y cancelarlo "vuelve" a la app.
  useEffect(() => {
    void pedir();
  }, [pedir]);

  return (
    <View style={[StyleSheet.absoluteFill, s.bloqueo]}>
      <Icono nombre="lock" tam={32} tinte={color.acento} />
      <Text style={[typo.titulo, { color: color.texto, textAlign: 'center' }]}>HIPO está bloqueada</Text>
      <Boton texto="Desbloquear" onPress={pedir} icono="unlock" />
    </View>
  );
}

const s = StyleSheet.create({
  bloqueo: { backgroundColor: color.fondo, alignItems: 'center', justifyContent: 'center', gap: espacio.xl, padding: espacio.pantalla },
});
