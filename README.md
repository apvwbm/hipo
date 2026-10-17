<p align="center">
  <img src="assets/icon.png" width="112" alt="Icono de HIPO" />
</p>

<h1 align="center">HIPO</h1>

<p align="center">
  <strong>Comprar casa, paso a paso.</strong><br />
  De "quiero comprar" a las llaves, con la hipoteca entendida.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Android-9A4A2C?style=flat-square&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/gratis-9A4A2C?style=flat-square" alt="Gratis" />
  <img src="https://img.shields.io/badge/sin%20anuncios-9A4A2C?style=flat-square" alt="Sin anuncios" />
  <img src="https://img.shields.io/badge/sin%20internet-9A4A2C?style=flat-square" alt="Sin internet" />
</p>

<p align="center">
  <a href="https://ko-fi.com/apvwbm"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Invítame a un café en Ko-fi" /></a>
</p>

---

Comprar una casa en España es un lío de cuentas, papeles y plazos: impuestos que cambian
según la comunidad, notas simples, arras, tasaciones, la FEIN, el notario… HIPO lo ordena
todo en el móvil y te va diciendo qué toca en cada momento.

## Qué puedes hacer

**Saber cuánto te puedes permitir.** Con lo que cobráis, lo que debéis y lo que tenéis
ahorrado, HIPO calcula el precio máximo de casa, la hipoteca, la cuota y qué te frena: la
entrada o la cuota.

**Ver lo que cuesta de verdad cada casa.** No solo el precio: impuestos de tu comunidad,
notaría, registro, gestoría, tasación y reforma. Cuánto sale de tus ahorros, la cuota y lo
que pagarás al mes. Ordénalas por coste total, cuota o €/m² y compáralas de un vistazo.

**Ir a las visitas preparado.** Una lista de qué mirar y qué preguntar, tu nota de cada
casa y sus fotos.

**Elegir la mejor hipoteca.** Apunta las ofertas de los bancos y HIPO las ordena por lo que
cuestan de verdad. Te dice si cada producto que te piden contratar (seguros, nómina,
tarjeta…) compensa lo que cuesta, y cuánto subiría la cuota si sube el Euríbor.

**Tener los papeles bajo control.** La lista de documentos que te pedirá el banco a cada
uno, cuáles te faltan y cuáles han caducado. Los abres o los envías desde la app.

**No perderte ningún plazo.** Arras, tasación, los 10 días desde la FEIN, el acta en el
notario, la firma y el pago del impuesto. Y avisos cuando algo no cuadra: una tasación por
debajo del precio, unas arras sin condición de financiación, un documento caducado…

**Saber siempre por dónde vas.** Una guía en seis fases, de prepararte a después de firmar,
con lo que toca hacer en cada una y una explicación corta de cada cosa.

## Tu privacidad

- Todo se guarda **cifrado en tu móvil**. No hay cuentas ni servidores.
- La app **no tiene permiso para conectarse a internet**: es imposible que envíe tus datos.
- Tus documentos y fotos **se quedan donde están** (Descargas, Drive, galería). HIPO solo
  guarda dónde encontrarlos.
- Puedes protegerla con tu **huella o tu PIN**.
- Sin anuncios y sin rastreo.

## Instalar

1. Descarga `hipo.apk` desde [la última versión](https://github.com/apvwbm/hipo/releases/latest).
2. Ábrelo en el móvil y permite instalar apps de origen desconocido si te lo pide.
3. Para actualizar, instala el APK nuevo encima: tus datos se conservan.

## Preguntas frecuentes

<details>
<summary><strong>¿Sirve fuera de España?</strong></summary>
<br />
No. Las cuentas y los trámites (ITP según la comunidad, nota simple, arras, FEIN, acta de
transparencia…) son los de España, por eso está solo en castellano y en euros.
</details>

<details>
<summary><strong>¿Las cifras son exactas?</strong></summary>
<br />
Son estimaciones con los datos generales de octubre de 2026: impuestos de cada comunidad,
gastos habituales y Euríbor. Todo se puede ajustar en la app (por ejemplo, si tienes un
tipo reducido por joven o familia numerosa). La última palabra es del banco, el notario y
Hacienda.
</details>

<details>
<summary><strong>¿Y si cambio de móvil?</strong></summary>
<br />
Haz una copia cifrada con contraseña (Ajustes → Exportar copia cifrada) e impórtala en el
nuevo. La copia lleva tus datos y los enlaces a los documentos; en el móvil nuevo tendrás
que volver a enlazar los archivos. Si pierdes el móvil sin copia, los datos se pierden: no
están en ningún otro sitio.
</details>

<details>
<summary><strong>¿Podemos usarla los dos?</strong></summary>
<br />
Sí, como titulares de la misma compra: la app suma vuestros ingresos y lleva los papeles de
cada uno. Los datos viven en un móvil; para pasárselos al otro, usad la copia cifrada.
</details>

<details>
<summary><strong>¿Funciona en iPhone?</strong></summary>
<br />
De momento solo en Android.
</details>

## Para desarrolladores

<details>
<summary>Stack, comandos y estructura</summary>
<br />

Expo SDK 57 · React Native 0.86 · TypeScript · expo-router · zustand · SQLite cifrada con
SQLCipher. Sin librerías de gráficos, fechas ni criptografía.

```bash
npm install
npm start           # con Expo Go (ahí la base va sin cifrar)
npm run verifica    # tests de la lógica: cuotas, impuestos, capacidad, papeles, plazos
npm run apk         # compila el APK (Windows + Android SDK) y lo deja en el Escritorio
```

- `src/lib/motor.ts`: todas las cuentas, en funciones puras.
- `src/lib/catalogo.ts`: impuestos por comunidad, documentos, fases y tareas.
- `src/app/`: las pantallas.

</details>

---

<p align="center">
  Hecho por <a href="https://apvwbm.com/projects/hipo">Aitor Pérez</a>.<br />
  HIPO es gratis y lo seguirá siendo. Si te ayuda a comprar tu casa,
  <a href="https://ko-fi.com/apvwbm">invítame a un café</a>.
</p>

<p align="center"><sub>© 2026 Aitor Pérez. Todos los derechos reservados.</sub></p>
