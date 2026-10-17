// Las cuatro pestañas. Sin onboarding: Inicio vacío ya dice por dónde empezar.

import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icono } from '@/components/ui';
import { BORDE, color, typo } from '@/theme';

const PESTANAS = [
  { nombre: 'index', titulo: 'Inicio', icono: 'compass' },
  { nombre: 'casas', titulo: 'Casas', icono: 'home' },
  { nombre: 'hipoteca', titulo: 'Hipoteca', icono: 'percent' },
  { nombre: 'papeles', titulo: 'Papeles', icono: 'folder' },
];

export default function LayoutPestanas() {
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.acento,
        tabBarInactiveTintColor: color.texto3,
        // Alto y margen explícitos: con el alto por defecto la etiqueta de Archivo casi
        // se corta por abajo, sobre todo con la barra de gestos.
        tabBarStyle: {
          backgroundColor: color.fondo,
          borderTopColor: color.linea,
          borderTopWidth: BORDE,
          elevation: 0,
          height: 64 + bottom,
          paddingTop: 6,
          paddingBottom: bottom + 8,
        },
        tabBarLabelStyle: typo.micro,
        sceneStyle: { backgroundColor: color.fondo },
      }}
    >
      {PESTANAS.map(({ nombre, titulo, icono }) => (
        <Tabs.Screen key={nombre} name={nombre} options={{ title: titulo, tabBarIcon: ({ color: tinte }) => <Icono nombre={icono} tinte={String(tinte)} /> }} />
      ))}
    </Tabs>
  );
}
